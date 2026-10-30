import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../app/api/candidate/assignments/route';
import { POST as startPOST } from '../app/api/candidate/assignments/[id]/start/route';
import { POST as submitPOST } from '../app/api/candidate/assignments/[id]/submit/route';
import {
  listCandidateAssignments,
  startCandidateAssignment,
  submitCandidateAssignment,
  resolveBrowserAuthUrl,
} from '../lib/api-client';

describe('Candidate Assignments BFF Routes & Client (BUG-08)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (globalThis as any).window = {};
  });

  afterEach(() => {
    delete (globalThis as any).window;
  });

  it('maps candidate assignment URLs correctly in browser environment', () => {
    expect(resolveBrowserAuthUrl('/candidate/assignments')).toBe('/api/candidate/assignments');
    expect(resolveBrowserAuthUrl('/candidate/assignments/test-id-1/start')).toBe(
      '/api/candidate/assignments/test-id-1/start',
    );
    expect(resolveBrowserAuthUrl('/candidate/assignments/test-id-1/submit')).toBe(
      '/api/candidate/assignments/test-id-1/submit',
    );
  });

  it('GET /api/candidate/assignments proxies to backend with session credentials', async () => {
    const mockAssignments = [
      {
        id: 'assignment-1',
        assessmentId: 'assessment-1',
        title: 'Acme Simulation Academy Technical Simulation',
        companyName: 'Acme Simulation Academy',
        status: 'ready',
        durationMinutes: 60,
        mode: 'cloud',
        aiEnabled: true,
        pauseTimerOnDisconnect: false,
        invitedAt: '2026-10-30T10:00:00Z',
      },
    ];

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockAssignments), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const req = new NextRequest('http://localhost:3000/api/candidate/assignments', {
      method: 'GET',
      headers: {
        cookie: 'hs_session=candidate-session-token',
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(mockAssignments);

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/candidate/assignments'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Cookie: 'hs_session=candidate-session-token',
        }),
      }),
    );
  });

  it('POST /api/candidate/assignments/:id/start attaches CSRF and forwards consent', async () => {
    const started = {
      id: 'assignment-1',
      status: 'in_progress',
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(started), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const req = new NextRequest('http://localhost:3000/api/candidate/assignments/assignment-1/start', {
      method: 'POST',
      headers: {
        cookie: 'hs_session=candidate-session-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        consent: {
          textVersion: 'v1.0',
          acceptedAt: '2026-10-30T10:05:00Z',
        },
      }),
    });

    const res = await startPOST(req, { params: Promise.resolve({ id: 'assignment-1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('in_progress');

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/candidate/assignments/assignment-1/start'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-HS-CSRF': '1',
          Cookie: 'hs_session=candidate-session-token',
        }),
      }),
    );
  });

  it('POST /api/candidate/assignments/:id/submit attaches CSRF and finalizes submission', async () => {
    const submitted = {
      id: 'assignment-1',
      status: 'submitted',
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(submitted), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const req = new NextRequest('http://localhost:3000/api/candidate/assignments/assignment-1/submit', {
      method: 'POST',
      headers: {
        cookie: 'hs_session=candidate-session-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const res = await submitPOST(req, { params: Promise.resolve({ id: 'assignment-1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('submitted');

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/candidate/assignments/assignment-1/submit'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-HS-CSRF': '1',
          Cookie: 'hs_session=candidate-session-token',
        }),
      }),
    );
  });

  it('client helper methods list, start, and submit assignments', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 'a1', title: 'Task 1', status: 'ready' }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'a1', status: 'in_progress' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'a1', status: 'submitted' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    const list = await listCandidateAssignments(mockFetch as any);
    expect(list.length).toBe(1);
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      '/api/candidate/assignments',
      expect.objectContaining({ method: 'GET' }),
    );

    const started = await startCandidateAssignment(
      'a1',
      { textVersion: 'v1.0', acceptedAt: '2026-10-30T10:00:00Z' },
      mockFetch as any,
    );
    expect(started.status).toBe('in_progress');
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      '/api/candidate/assignments/a1/start',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-HS-CSRF': '1' }),
      }),
    );

    const submitted = await submitCandidateAssignment('a1', mockFetch as any);
    expect(submitted.status).toBe('submitted');
    expect(mockFetch).toHaveBeenNthCalledWith(
      3,
      '/api/candidate/assignments/a1/submit',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-HS-CSRF': '1' }),
      }),
    );
  });
});
