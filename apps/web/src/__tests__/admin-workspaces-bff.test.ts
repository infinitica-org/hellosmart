import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getWorkspaces } from '@/app/api/admin/workspaces/route';
import { GET as getWorkspaceById } from '@/app/api/admin/workspaces/[id]/route';
import { POST as destroyWorkspace } from '@/app/api/admin/workspaces/[id]/destroy/route';
import { resetMockWorkspaces } from '@/lib/workspaces-data';

function makeRequest(
  url: string,
  method: 'GET' | 'POST',
  body?: any,
  role: string = 'platform_admin',
  csrf: boolean = true,
): NextRequest {
  const token = role === 'platform_admin' ? 'sess_admin_test_123' : 'sess_company_test_123';

  const headers: Record<string, string> = {
    cookie: `hs_session=${token}`,
    'content-type': 'application/json',
  };

  if (method === 'POST' && csrf) {
    headers['x-hs-csrf'] = '1';
    headers['origin'] = 'http://localhost:3000';
  }

  const init: RequestInit = {
    method,
    headers,
  };

  if (body) {
    init.body = JSON.stringify(body);
  }

  return new NextRequest(url, init as any);
}

describe('Admin Workspaces BFF Routes (S1B-T05-3)', () => {
  const testWorkspaceId = '88888888-8888-4888-8888-888888888881';

  beforeEach(() => {
    vi.restoreAllMocks();
    resetMockWorkspaces();
  });

  describe('GET /api/admin/workspaces', () => {
    it('blocks unauthenticated requests with 401', async () => {
      const anonReq = new NextRequest('http://localhost:3000/api/admin/workspaces', { method: 'GET' });
      const res = await getWorkspaces(anonReq);
      expect(res.status).toBe(401);
    });

    it('blocks non-admin users with 403', async () => {
      const companyReq = makeRequest(
        'http://localhost:3000/api/admin/workspaces',
        'GET',
        undefined,
        'company_admin',
      );
      const res = await getWorkspaces(companyReq);
      expect(res.status).toBe(403);
    });

    it('returns workspace list with metrics for platform admin', async () => {
      const adminReq = makeRequest('http://localhost:3000/api/admin/workspaces', 'GET');
      const res = await getWorkspaces(adminReq);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.items).toBeDefined();
      expect(Array.isArray(json.items)).toBe(true);
      expect(json.items.length).toBeGreaterThan(0);
      expect(json.metrics).toBeDefined();
      expect(json.metrics.totalWorkspaces).toBeGreaterThan(0);

      // Verify honest spend representation
      const item = json.items[0];
      expect(item.spendInfo.meteringStatus).toBe('unconnected');
      expect(item.spendInfo.meteringNotice).toBe('AI proxy runtime metering unconnected');
    });

    it('filters workspaces by status', async () => {
      const req = makeRequest('http://localhost:3000/api/admin/workspaces?status=connected', 'GET');
      const res = await getWorkspaces(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.items.every((i: any) => i.status === 'connected')).toBe(true);
    });

    it('fails closed with 503 in production when upstream service is unreachable and never returns mock data', async () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        const req = makeRequest('http://localhost:3000/api/admin/workspaces', 'GET');
        const res = await getWorkspaces(req);
        expect(res.status).toBe(503);
        const json = await res.json();
        expect(json.title).toBe('Service Unavailable');
        expect(res.headers.get('x-hellosmart-mock')).toBeNull();
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('forwards upstream 5xx error status without replacing it with mock data', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => ({
          type: 'about:blank',
          title: 'Bad Gateway',
          status: 502,
          detail: 'Upstream cluster error',
        }),
      } as any);

      const req = makeRequest('http://localhost:3000/api/admin/workspaces', 'GET');
      const res = await getWorkspaces(req);
      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.title).toBe('Bad Gateway');
      expect(json.detail).toBe('Upstream cluster error');
      expect(res.headers.get('x-hellosmart-mock')).toBeNull();
    });
  });

  describe('GET /api/admin/workspaces/[id]', () => {
    it('returns 422 for non-UUID parameter', async () => {
      const req = makeRequest('http://localhost:3000/api/admin/workspaces/invalid-id', 'GET');
      const res = await getWorkspaceById(req, { params: { id: 'invalid-id' } });
      expect(res.status).toBe(422);
    });

    it('returns 404 for non-existent workspace UUID', async () => {
      const req = makeRequest(
        'http://localhost:3000/api/admin/workspaces/00000000-0000-0000-0000-000000000000',
        'GET',
      );
      const res = await getWorkspaceById(req, {
        params: { id: '00000000-0000-0000-0000-000000000000' },
      });
      expect(res.status).toBe(404);
    });

    it('returns workspace detail with recent events and allocation info', async () => {
      const req = makeRequest(
        `http://localhost:3000/api/admin/workspaces/${testWorkspaceId}`,
        'GET',
      );
      const res = await getWorkspaceById(req, { params: { id: testWorkspaceId } });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.id).toBe(testWorkspaceId);
      expect(json.recentEvents).toBeDefined();
      expect(json.spendInfo).toBeDefined();
    });

    it('fails closed with 503 in production when upstream service is unreachable and never returns mock data', async () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        const req = makeRequest(`http://localhost:3000/api/admin/workspaces/${testWorkspaceId}`, 'GET');
        const res = await getWorkspaceById(req, { params: { id: testWorkspaceId } });
        expect(res.status).toBe(503);
        const json = await res.json();
        expect(json.title).toBe('Service Unavailable');
        expect(res.headers.get('x-hellosmart-mock')).toBeNull();
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('forwards upstream 5xx error status without replacing it with mock data', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          type: 'about:blank',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Database unreachable',
        }),
      } as any);

      const req = makeRequest(`http://localhost:3000/api/admin/workspaces/${testWorkspaceId}`, 'GET');
      const res = await getWorkspaceById(req, { params: { id: testWorkspaceId } });
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.title).toBe('Internal Server Error');
      expect(json.detail).toBe('Database unreachable');
      expect(res.headers.get('x-hellosmart-mock')).toBeNull();
    });
  });

  describe('POST /api/admin/workspaces/[id]/destroy', () => {
    it('blocks mutation if X-HS-CSRF header is missing', async () => {
      const req = makeRequest(
        `http://localhost:3000/api/admin/workspaces/${testWorkspaceId}/destroy`,
        'POST',
        { reason: 'Security anomaly' },
        'platform_admin',
        false, // no csrf
      );
      const res = await destroyWorkspace(req, { params: { id: testWorkspaceId } });
      expect(res.status).toBe(403);
    });

    it('blocks mutation with reason under 5 characters with 422', async () => {
      const req = makeRequest(
        `http://localhost:3000/api/admin/workspaces/${testWorkspaceId}/destroy`,
        'POST',
        { reason: 'kill' },
      );
      const res = await destroyWorkspace(req, { params: { id: testWorkspaceId } });
      expect(res.status).toBe(422);
    });

    it('successfully emergency destroys an active workspace', async () => {
      const reason = 'Emergency termination requested due to network anomaly';
      const req = makeRequest(
        `http://localhost:3000/api/admin/workspaces/${testWorkspaceId}/destroy`,
        'POST',
        { reason },
      );
      const res = await destroyWorkspace(req, { params: { id: testWorkspaceId } });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.workspaceId).toBe(testWorkspaceId);
      expect(json.status).toBe('destroyed');
      expect(json.assignmentRevoked).toBe(true);
      expect(json.reason).toBe(reason);
      expect(json.limitations).toBeDefined();
    });

    it('rejects duplicate destruction with 409 Conflict', async () => {
      const reason = 'First kill request';
      const req1 = makeRequest(
        `http://localhost:3000/api/admin/workspaces/${testWorkspaceId}/destroy`,
        'POST',
        { reason },
      );
      await destroyWorkspace(req1, { params: { id: testWorkspaceId } });

      const req2 = makeRequest(
        `http://localhost:3000/api/admin/workspaces/${testWorkspaceId}/destroy`,
        'POST',
        { reason: 'Second kill request' },
      );
      const res2 = await destroyWorkspace(req2, { params: { id: testWorkspaceId } });
      expect(res2.status).toBe(409);
    });

    it('forwards upstream 409 Conflict without masking with mock destroy', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          type: 'about:blank',
          title: 'Conflict',
          status: 409,
          detail: 'Cannot destroy workspace: workspace is already in terminal state "destroyed"',
          code: 'WORKSPACE_ALREADY_TERMINATED',
        }),
      } as any);

      const req = makeRequest(
        `http://localhost:3000/api/admin/workspaces/${testWorkspaceId}/destroy`,
        'POST',
        { reason: 'Emergency kill duplicate test' },
      );
      const res = await destroyWorkspace(req, { params: { id: testWorkspaceId } });
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.code).toBe('WORKSPACE_ALREADY_TERMINATED');
      expect(res.headers.get('x-hellosmart-mock')).toBeNull();
    });

    it('forwards upstream 403 Forbidden without masking with mock destroy', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          type: 'about:blank',
          title: 'Forbidden',
          status: 403,
          detail: 'Super admin authorization required',
          code: 'FORBIDDEN',
        }),
      } as any);

      const req = makeRequest(
        `http://localhost:3000/api/admin/workspaces/${testWorkspaceId}/destroy`,
        'POST',
        { reason: 'Emergency kill forbidden test' },
      );
      const res = await destroyWorkspace(req, { params: { id: testWorkspaceId } });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.code).toBe('FORBIDDEN');
      expect(res.headers.get('x-hellosmart-mock')).toBeNull();
    });

    it('forwards upstream 500 Internal Server Error without masking with mock destroy', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          type: 'about:blank',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to revoke assignment',
          code: 'ASSIGNMENT_REVOCATION_FAILED',
        }),
      } as any);

      const req = makeRequest(
        `http://localhost:3000/api/admin/workspaces/${testWorkspaceId}/destroy`,
        'POST',
        { reason: 'Emergency kill server error test' },
      );
      const res = await destroyWorkspace(req, { params: { id: testWorkspaceId } });
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.code).toBe('ASSIGNMENT_REVOCATION_FAILED');
      expect(res.headers.get('x-hellosmart-mock')).toBeNull();
    });

    it('fails closed with 503 in production when upstream service is unreachable and never invokes mock fallback', async () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        const req = makeRequest(
          `http://localhost:3000/api/admin/workspaces/${testWorkspaceId}/destroy`,
          'POST',
          { reason: 'Emergency kill production network failure' },
        );
        const res = await destroyWorkspace(req, { params: { id: testWorkspaceId } });
        expect(res.status).toBe(503);
        const json = await res.json();
        expect(json.title).toBe('Service Unavailable');
        expect(res.headers.get('x-hellosmart-mock')).toBeNull();
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });
});

