import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../app/api/company/candidates/route';
import { listCandidates, inviteCandidate, resolveBrowserAuthUrl } from '../lib/api-client';

describe('Company Candidates BFF Route & Client (BUG-07)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (globalThis as any).window = {};
  });

  afterEach(() => {
    delete (globalThis as any).window;
  });

  it('maps /candidates to /api/company/candidates in browser environment', () => {
    const url = resolveBrowserAuthUrl('/candidates');
    expect(url).toBe('/api/company/candidates');
  });

  it('GET /api/company/candidates proxies to backend with session credentials', async () => {
    const mockCandidates = [
      {
        id: 'candidate-1',
        name: 'Jane Doe',
        email: 'jane@example.com',
        status: 'invited',
        createdAt: '2026-10-30T10:00:00Z',
      },
    ];

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockCandidates), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const req = new NextRequest('http://localhost:3000/api/company/candidates', {
      method: 'GET',
      headers: {
        cookie: 'hs_session=test-session-token',
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(mockCandidates);

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/candidates'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Cookie: expect.stringContaining('hs_session=test-session-token'),
        }),
      }),
    );
  });

  it('POST /api/company/candidates enforces CSRF header and proxies creation', async () => {
    const newCandidate = {
      id: 'candidate-2',
      name: 'John Smith',
      email: 'john@example.com',
      status: 'invited',
      createdAt: '2026-10-30T10:05:00Z',
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(newCandidate), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const req = new NextRequest('http://localhost:3000/api/company/candidates', {
      method: 'POST',
      headers: {
        cookie: 'hs_session=test-session-token',
        'x-hs-csrf': '1',
        origin: 'http://localhost:3000',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'John Smith', email: 'john@example.com' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.email).toBe('john@example.com');

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/candidates'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-HS-CSRF': '1',
          Cookie: expect.stringContaining('hs_session=test-session-token'),
        }),
      }),
    );
  });

  it('listCandidates fetches from /api/company/candidates and returns data', async () => {
    const mockList = [
      { id: '1', name: 'Alice', email: 'alice@example.com', status: 'active', createdAt: '2026-10-30T00:00:00Z' },
    ];
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(mockList), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    const result = await listCandidates(mockFetch as any);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/company/candidates',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result).toEqual(mockList);
  });

  it('inviteCandidate sends POST with CSRF header and returns created candidate', async () => {
    const created = {
      id: '2',
      name: 'Bob',
      email: 'bob@example.com',
      status: 'invited',
      createdAt: '2026-10-30T00:00:00Z',
    };
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(created), { status: 201, headers: { 'Content-Type': 'application/json' } }),
    );

    const result = await inviteCandidate({ name: 'Bob', email: 'bob@example.com' }, mockFetch as any);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/company/candidates',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-HS-CSRF': '1',
        }),
      }),
    );
    expect(result.email).toBe('bob@example.com');
  });
});
