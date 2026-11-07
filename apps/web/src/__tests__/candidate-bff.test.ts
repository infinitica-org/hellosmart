import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getAssessments } from '@/app/api/candidate/assessments/route';
import { GET as getAssignments } from '@/app/api/candidate/assignments/route';
import { GET as getAssessmentDetail } from '@/app/api/candidate/assessments/[id]/route';
import { GET as getAssessmentTiming } from '@/app/api/candidate/assessments/[id]/timing/route';
import { POST as acceptConsent } from '@/app/api/candidate/workspace/[id]/consent/route';
import { POST as acceptAssessmentConsent } from '@/app/api/candidate/assessments/[id]/consent/route';
import { POST as saveDraft } from '@/app/api/candidate/workspace/[id]/draft/route';
import { GET as getAssessmentDraft } from '@/app/api/candidate/assessments/[id]/draft/route';
import { POST as submitAssessment } from '@/app/api/candidate/workspace/[id]/submit/route';
import { POST as recordHeartbeat } from '@/app/api/candidate/workspace/[id]/heartbeat/route';

describe('Candidate Portal BFF Routes (BUG-CAN-03, BUG-CAN-09)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('GET /api/candidate/assessments proxies to backend candidate assessments endpoint with session cookie', async () => {
    let capturedUrl: string | undefined;
    let capturedCookie: string | null = null;

    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (req: any, init?: any) => {
      capturedUrl = typeof req === 'string' ? req : req.url;
      const headers = init?.headers || (typeof req !== 'string' ? req.headers : null);
      capturedCookie = headers?.Cookie || headers?.cookie || (headers?.get ? headers.get('cookie') : null);
      return new Response(
        JSON.stringify([
          {
            id: 'assign-1',
            assessmentId: 'asm-1',
            title: 'Cloud Distributed Systems',
            companyName: 'Acme Corp',
            workspaceMode: 'cloud',
            status: 'invited',
            durationMinutes: 90,
          },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const req = new NextRequest('http://localhost:3000/api/candidate/assessments', {
      method: 'GET',
      headers: {
        cookie: 'hs_session=sess-candidate-123',
      },
    });

    const res = await getAssessments(req);
    expect(res.status).toBe(200);
    expect(capturedUrl).toContain('/candidate/assessments');
    expect(capturedCookie).toContain('hs_session=sess-candidate-123');

    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data[0].title).toBe('Cloud Distributed Systems');
  });

  it('GET /api/candidate/assignments proxies to backend candidate assessments endpoint', async () => {
    let capturedUrl: string | undefined;

    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (req: any) => {
      capturedUrl = typeof req === 'string' ? req : req.url;
      return new Response(
        JSON.stringify([
          {
            id: 'assign-1',
            title: 'Cloud Distributed Systems',
            status: 'invited',
          },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const req = new NextRequest('http://localhost:3000/api/candidate/assignments', {
      method: 'GET',
      headers: {
        cookie: 'hs_session=sess-candidate-123',
      },
    });

    const res = await getAssignments(req);
    expect(res.status).toBe(200);
    expect(capturedUrl).toContain('/candidate/assessments');

    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data[0].id).toBe('assign-1');
  });

  it('GET /api/candidate/assessments/:id proxies assignment detail taking request', async () => {
    let capturedUrl: string | undefined;

    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (req: any) => {
      capturedUrl = typeof req === 'string' ? req : req.url;
      return new Response(
        JSON.stringify({
          id: 'assign-1',
          title: 'Cloud Distributed Systems',
          status: 'invited',
          timing: { durationMinutes: 90 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const req = new NextRequest('http://localhost:3000/api/candidate/assessments/assign-1', {
      method: 'GET',
      headers: {
        cookie: 'hs_session=sess-candidate-123',
      },
    });

    const res = await getAssessmentDetail(req, { params: Promise.resolve({ id: 'assign-1' }) });
    expect(res.status).toBe(200);
    expect(capturedUrl).toContain('/candidate/assessments/assign-1');
  });

  it('GET /api/candidate/assessments/:id/timing proxies timing synchronization request', async () => {
    let capturedUrl: string | undefined;

    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (req: any) => {
      capturedUrl = typeof req === 'string' ? req : req.url;
      return new Response(
        JSON.stringify({
          assessmentId: 'assign-1',
          remainingMs: 5400000,
          durationMinutes: 90,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const req = new NextRequest('http://localhost:3000/api/candidate/assessments/assign-1/timing', {
      method: 'GET',
      headers: {
        cookie: 'hs_session=sess-candidate-123',
      },
    });

    const res = await getAssessmentTiming(req, { params: Promise.resolve({ id: 'assign-1' }) });
    expect(res.status).toBe(200);
    expect(capturedUrl).toContain('/candidate/assessments/assign-1/timing');
  });

  it('GET /api/candidate/assessments/:id/draft proxies draft loading request', async () => {
    let capturedUrl: string | undefined;

    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (req: any) => {
      capturedUrl = typeof req === 'string' ? req : req.url;
      return new Response(
        JSON.stringify({
          assessmentId: 'assign-1',
          branchName: 'main',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const req = new NextRequest('http://localhost:3000/api/candidate/assessments/assign-1/draft', {
      method: 'GET',
      headers: {
        cookie: 'hs_session=sess-candidate-123',
      },
    });

    const res = await getAssessmentDraft(req, { params: Promise.resolve({ id: 'assign-1' }) });
    expect(res.status).toBe(200);
    expect(capturedUrl).toContain('/candidate/workspace/assign-1/draft');
  });

  it('POST /api/candidate/workspace/:id/consent proxies pre-connect consent agreement', async () => {
    let capturedUrl: string | undefined;

    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (req: any) => {
      capturedUrl = typeof req === 'string' ? req : req.url;
      return new Response(
        JSON.stringify({ success: true, status: 'in_progress' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const req = new NextRequest('http://localhost:3000/api/candidate/workspace/assign-1/consent', {
      method: 'POST',
      headers: {
        cookie: 'hs_session=sess-candidate-123',
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
        'x-hs-csrf': '1',
      },
      body: JSON.stringify({ textVersion: 'v1.0' }),
    });

    const res = await acceptConsent(req, { params: Promise.resolve({ id: 'assign-1' }) });
    expect(res.status).toBe(200);
    expect(capturedUrl).toContain('/candidate/workspace/assign-1/consent');
  });

  it('POST /api/candidate/assessments/:id/consent proxies pre-connect consent agreement', async () => {
    let capturedUrl: string | undefined;

    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (req: any) => {
      capturedUrl = typeof req === 'string' ? req : req.url;
      return new Response(
        JSON.stringify({ success: true, status: 'in_progress' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const req = new NextRequest('http://localhost:3000/api/candidate/assessments/assign-1/consent', {
      method: 'POST',
      headers: {
        cookie: 'hs_session=sess-candidate-123',
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
        'x-hs-csrf': '1',
      },
      body: JSON.stringify({ textVersion: 'v1.0' }),
    });

    const res = await acceptAssessmentConsent(req, { params: Promise.resolve({ id: 'assign-1' }) });
    expect(res.status).toBe(200);
    expect(capturedUrl).toContain('/candidate/workspace/assign-1/consent');
  });

  it('POST /api/candidate/workspace/:id/draft proxies autosave draft state', async () => {
    let capturedUrl: string | undefined;

    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (req: any) => {
      capturedUrl = typeof req === 'string' ? req : req.url;
      return new Response(
        JSON.stringify({ success: true, savedAt: new Date().toISOString() }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const req = new NextRequest('http://localhost:3000/api/candidate/workspace/assign-1/draft', {
      method: 'POST',
      headers: {
        cookie: 'hs_session=sess-candidate-123',
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
        'x-hs-csrf': '1',
      },
      body: JSON.stringify({ files: { 'app.ts': 'console.log("autosaved");' } }),
    });

    const res = await saveDraft(req, { params: Promise.resolve({ id: 'assign-1' }) });
    expect(res.status).toBe(200);
    expect(capturedUrl).toContain('/candidate/workspace/assign-1/draft');
  });

  it('POST /api/candidate/workspace/:id/submit proxies final evaluation submission', async () => {
    let capturedUrl: string | undefined;

    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (req: any) => {
      capturedUrl = typeof req === 'string' ? req : req.url;
      return new Response(
        JSON.stringify({ submissionId: 'sub-assign-1', status: 'submitted', submittedAt: new Date().toISOString() }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const req = new NextRequest('http://localhost:3000/api/candidate/workspace/assign-1/submit', {
      method: 'POST',
      headers: {
        cookie: 'hs_session=sess-candidate-123',
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
        'x-hs-csrf': '1',
      },
      body: JSON.stringify({ artifacts: [] }),
    });

    const res = await submitAssessment(req, { params: Promise.resolve({ id: 'assign-1' }) });
    expect(res.status).toBe(200);
    expect(capturedUrl).toContain('/candidate/workspace/assign-1/submit');
  });

  it('POST /api/candidate/workspace/:id/heartbeat proxies workspace activity heartbeat (I174)', async () => {
    let capturedUrl: string | undefined;
    let capturedCookie: string | null = null;

    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (req: any, init?: any) => {
      capturedUrl = typeof req === 'string' ? req : req.url;
      const headers = init?.headers || (typeof req !== 'string' ? req.headers : null);
      capturedCookie = headers?.Cookie || headers?.cookie || (headers?.get ? headers.get('cookie') : null);
      return new Response(
        JSON.stringify({
          success: true,
          serverTimeUtc: new Date().toISOString(),
          workspaceStatus: 'connected',
          assignmentStatus: 'in_progress',
          remainingMs: 3500000,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const req = new NextRequest('http://localhost:3000/api/candidate/workspace/assign-1/heartbeat', {
      method: 'POST',
      headers: {
        cookie: 'hs_session=sess-candidate-123',
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
        'x-hs-csrf': '1',
      },
    });

    const res = await recordHeartbeat(req, { params: Promise.resolve({ id: 'assign-1' }) });
    expect(res.status).toBe(200);
    expect(capturedUrl).toContain('/candidate/workspace/assign-1/heartbeat');
    expect(capturedCookie).toContain('hs_session=sess-candidate-123');

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.workspaceStatus).toBe('connected');
  });

  it('POST /api/candidate/workspace/:id/heartbeat rejects invalid workspace ID', async () => {
    const req = new NextRequest('http://localhost:3000/api/candidate/workspace/%20/heartbeat', {
      method: 'POST',
      headers: {
        cookie: 'hs_session=sess-candidate-123',
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
        'x-hs-csrf': '1',
      },
    });

    const res = await recordHeartbeat(req, { params: Promise.resolve({ id: '   ' }) });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe('INVALID_WORKSPACE_ID');
  });
});
