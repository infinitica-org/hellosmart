import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/admin/organizations/[id]/route';
import { PATCH } from '@/app/api/admin/organizations/[id]/entitlements/route';
import { PATCH as PATCH_STATUS } from '@/app/api/admin/organizations/route';
import * as orgData from '@/lib/organizations-data';

function makeRequest(
  url: string,
  method: 'GET' | 'PATCH',
  body?: any,
  role: string = 'platform_admin',
  csrf: boolean = true,
): NextRequest {
  const token = role === 'platform_admin' ? 'sess_123_admin' : 'sess_123_company';

  const headers: Record<string, string> = {
    cookie: `hs_session=${token}`,
    'content-type': 'application/json',
  };

  if (method === 'PATCH' && csrf) {
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

describe('Admin Organizations BFF Routes (S1B-T05-1)', () => {
  const testOrgId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/admin/organizations/[id]', () => {
    it('blocks unauthenticated requests with 401', async () => {
      const anonReq = new NextRequest(
        `http://localhost:3000/api/admin/organizations/${testOrgId}`,
        { method: 'GET' },
      );
      const res = await GET(anonReq, { params: Promise.resolve({ id: testOrgId }) });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.detail).toContain('Authentication required');
    });

    it('returns organization details and entitlements for authenticated platform admin', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('/admin/organizations/')) {
          return new Response(
            JSON.stringify({
              id: testOrgId,
              name: 'Acme Test Corp',
              slug: 'acme-test',
              status: 'paid_active',
              planId: 'plan_pro',
              whiteLabel: false,
              retentionDays: 90,
              createdAt: '2026-10-01T10:00:00.000Z',
              updatedAt: '2026-10-01T10:00:00.000Z',
              entitlements: {
                orgId: testOrgId,
                maxTemplates: 10,
                maxCandidates: 50,
                trialEndsAt: null,
                pendingInviteMultiplier: 2.0,
                flags: { cloud: true, chat: true },
                updatedAt: '2026-10-01T10:00:00.000Z',
              },
              primaryAdmin: {
                id: 'admin-1',
                name: 'Jane Admin',
                email: 'jane@acme.com',
              },
              stats: {
                candidateCount: 12,
                assessmentCount: 3,
                activeWorkspacesCount: 1,
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        // auth validation
        return new Response(
          JSON.stringify({ id: 'admin-1', role: 'platform_admin', email: 'admin@hellosmart.ai' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      });

      const req = makeRequest(`http://localhost:3000/api/admin/organizations/${testOrgId}`, 'GET');
      const res = await GET(req, { params: Promise.resolve({ id: testOrgId }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe(testOrgId);
      expect(data.name).toBe('Acme Test Corp');
      expect(data.entitlements.maxTemplates).toBe(10);
      expect(data.entitlements.maxCandidates).toBe(50);
      expect(data.stats.candidateCount).toBe(12);
    });

    it('returns 404 when organization is not found in backend or test store', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('/admin/organizations/')) {
          return new Response(
            JSON.stringify({ title: 'Not Found', detail: 'Organization not found', status: 404 }),
            { status: 404, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response(
          JSON.stringify({ id: 'admin-1', role: 'platform_admin', email: 'admin@hellosmart.ai' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      });

      const unknownId = '99999999-9999-4999-8999-999999999999';
      const req = makeRequest(`http://localhost:3000/api/admin/organizations/${unknownId}`, 'GET');
      const res = await GET(req, { params: Promise.resolve({ id: unknownId }) });
      expect(res.status).toBe(404);
    });

    it('returns 503 Service Unavailable when upstream fetch fails in production mode without calling in-memory fallback', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalDevAccounts = process.env.ENABLE_DEV_ACCOUNTS;
      (process.env as any).NODE_ENV = 'production';
      delete process.env.ENABLE_DEV_ACCOUNTS;

      const getOrgSpy = vi.spyOn(orgData, 'getOrganizationById');

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.endsWith('/me') || urlStr.includes('/me')) {
          return new Response(
            JSON.stringify({ id: 'admin-1', role: 'platform_admin', email: 'admin@hellosmart.ai' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        throw new Error('Network failure: backend unreachable');
      });

      try {
        const req = makeRequest(`http://localhost:3000/api/admin/organizations/${testOrgId}`, 'GET');
        const res = await GET(req, { params: Promise.resolve({ id: testOrgId }) });

        expect(res.status).toBe(503);
        const data = await res.json();
        expect(data).toEqual({
          title: 'Service Unavailable',
          detail: 'Backend service unreachable',
          status: 503,
        });
        expect(getOrgSpy).not.toHaveBeenCalled();
      } finally {
        (process.env as any).NODE_ENV = originalNodeEnv;
        if (originalDevAccounts !== undefined) {
          process.env.ENABLE_DEV_ACCOUNTS = originalDevAccounts;
        }
      }
    });

    it('falls back to test store when fetch fails in test mode', async () => {
      orgData.resetOrganizationsStore();
      const seeded = orgData.createOrganization({
        name: 'Fallback Test Corp',
        slug: 'fallback-test',
        adminEmail: 'admin@fallback.com',
        adminName: 'Fallback Admin',
        plan: 'pro',
        maxTemplates: 8,
        maxCandidates: 40,
        trialDays: 14,
      });

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('/auth/me')) {
          return new Response(
            JSON.stringify({ id: 'admin-1', role: 'platform_admin', email: 'admin@hellosmart.ai' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        throw new Error('Backend offline in test');
      });

      const req = makeRequest(`http://localhost:3000/api/admin/organizations/${seeded.id}`, 'GET');
      const res = await GET(req, { params: Promise.resolve({ id: seeded.id }) });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe(seeded.id);
      expect(data.name).toBe('Fallback Test Corp');
    });
  });

  describe('PATCH /api/admin/organizations/[id]/entitlements', () => {
    it('blocks unauthenticated requests with 401', async () => {
      const anonReq = new NextRequest(
        `http://localhost:3000/api/admin/organizations/${testOrgId}/entitlements`,
        { method: 'PATCH', body: JSON.stringify({ maxTemplates: 10 }) },
      );
      const res = await PATCH(anonReq, { params: Promise.resolve({ id: testOrgId }) });
      expect(res.status).toBe(401);
    });

    it('rejects requests missing CSRF token with 403', async () => {
      const reqWithoutCsrf = makeRequest(
        `http://localhost:3000/api/admin/organizations/${testOrgId}/entitlements`,
        'PATCH',
        { maxTemplates: 10 },
        'platform_admin',
        false, // no csrf header
      );
      const res = await PATCH(reqWithoutCsrf, { params: Promise.resolve({ id: testOrgId }) });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.detail).toContain('CSRF');
    });

    it('validates bounds and rejects out-of-range maxTemplates with 400', async () => {
      const req = makeRequest(
        `http://localhost:3000/api/admin/organizations/${testOrgId}/entitlements`,
        'PATCH',
        { maxTemplates: 150 }, // > 100 max
      );
      const res = await PATCH(req, { params: Promise.resolve({ id: testOrgId }) });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.detail).toContain('100');
    });

    it('successfully forwards valid entitlement update to backend with CSRF and auth headers', async () => {
      let forwardedBody: any = null;
      let forwardedCsrf: string | null = null;

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, init?: any) => {
        const urlStr = String(url);
        if (urlStr.includes('/entitlements')) {
          forwardedBody = JSON.parse(init.body);
          forwardedCsrf = init.headers['X-HS-CSRF'] || init.headers['x-hs-csrf'];
          return new Response(
            JSON.stringify({
              id: testOrgId,
              name: 'Acme Test Corp',
              entitlements: {
                orgId: testOrgId,
                maxTemplates: 20,
                maxCandidates: 200,
                flags: { cloud: true, chat: true, white_label: true },
                updatedAt: '2026-10-01T12:00:00.000Z',
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response(
          JSON.stringify({ id: 'admin-1', role: 'platform_admin', email: 'admin@hellosmart.ai' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      });

      const updatePayload = {
        maxTemplates: 20,
        maxCandidates: 200,
        flags: { cloud: true, chat: true, white_label: true },
      };

      const req = makeRequest(
        `http://localhost:3000/api/admin/organizations/${testOrgId}/entitlements`,
        'PATCH',
        updatePayload,
      );

      const res = await PATCH(req, { params: Promise.resolve({ id: testOrgId }) });
      expect(res.status).toBe(200);
      expect(forwardedBody).toEqual(updatePayload);
      expect(forwardedCsrf).toBe('1');
    });

    it('returns 503 Service Unavailable when upstream fetch fails in production mode without updating in-memory store', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalDevAccounts = process.env.ENABLE_DEV_ACCOUNTS;
      (process.env as any).NODE_ENV = 'production';
      delete process.env.ENABLE_DEV_ACCOUNTS;

      const updateOrgSpy = vi.spyOn(orgData, 'updateOrganizationEntitlements');

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.endsWith('/me') || urlStr.includes('/me')) {
          return new Response(
            JSON.stringify({ id: 'admin-1', role: 'platform_admin', email: 'admin@hellosmart.ai' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        throw new Error('Connection timeout: backend unreachable');
      });

      try {
        const req = makeRequest(
          `http://localhost:3000/api/admin/organizations/${testOrgId}/entitlements`,
          'PATCH',
          { maxTemplates: 15 },
        );
        const res = await PATCH(req, { params: Promise.resolve({ id: testOrgId }) });

        expect(res.status).toBe(503);
        const data = await res.json();
        expect(data).toEqual({
          title: 'Service Unavailable',
          detail: 'Backend service unreachable',
          status: 503,
        });
        expect(updateOrgSpy).not.toHaveBeenCalled();
      } finally {
        (process.env as any).NODE_ENV = originalNodeEnv;
        if (originalDevAccounts !== undefined) {
          process.env.ENABLE_DEV_ACCOUNTS = originalDevAccounts;
        }
      }
    });

    it('falls back to test store when fetch fails in test mode', async () => {
      orgData.resetOrganizationsStore();
      const seeded = orgData.createOrganization({
        name: 'Fallback Patch Corp',
        slug: 'fallback-patch',
        adminEmail: 'patch@fallback.com',
        adminName: 'Patch Admin',
        plan: 'pro',
        maxTemplates: 5,
        maxCandidates: 25,
        trialDays: 14,
      });

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('/auth/me')) {
          return new Response(
            JSON.stringify({ id: 'admin-1', role: 'platform_admin', email: 'admin@hellosmart.ai' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        throw new Error('Backend offline in test');
      });

      const req = makeRequest(
        `http://localhost:3000/api/admin/organizations/${seeded.id}/entitlements`,
        'PATCH',
        { maxTemplates: 12, maxCandidates: 80 },
      );
      const res = await PATCH(req, { params: Promise.resolve({ id: seeded.id }) });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.entitlements.maxTemplates).toBe(12);
      expect(data.entitlements.maxCandidates).toBe(80);
    });
  });

  describe('PATCH /api/admin/organizations (Organization Status Governance)', () => {
    it('blocks unauthenticated requests with 401', async () => {
      const anonReq = new NextRequest(
        'http://localhost:3000/api/admin/organizations',
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: testOrgId, status: 'suspended' }),
        },
      );
      const res = await PATCH_STATUS(anonReq);
      expect(res.status).toBe(401);
    });

    it('successfully forwards status update to backend when fetch succeeds', async () => {
      let forwardedBody: any = null;

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, init?: any) => {
        const urlStr = String(url);
        if (urlStr.includes('/status')) {
          forwardedBody = JSON.parse(init.body);
          return new Response(
            JSON.stringify({
              id: testOrgId,
              name: 'Acme Test Corp',
              slug: 'acme-test',
              status: 'suspended',
              planId: 'plan_pro',
              createdAt: '2026-10-01T10:00:00.000Z',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        if (urlStr.endsWith('/me') || urlStr.includes('/me')) {
          return new Response(
            JSON.stringify({ id: 'admin-1', role: 'platform_admin', email: 'admin@hellosmart.ai' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response('{}', { status: 200 });
      });

      const req = makeRequest(
        'http://localhost:3000/api/admin/organizations',
        'PATCH',
        { id: testOrgId, status: 'suspended', reason: 'Non-payment' },
      );

      const res = await PATCH_STATUS(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.organization.status).toBe('suspended');
      expect(forwardedBody.status).toBe('suspended');
      expect(forwardedBody.reason).toBe('Non-payment');
    });

    it('returns 503 Service Unavailable when upstream fetch fails in production mode without mutating in-memory store', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalDevAccounts = process.env.ENABLE_DEV_ACCOUNTS;
      (process.env as any).NODE_ENV = 'production';
      delete process.env.ENABLE_DEV_ACCOUNTS;

      const updateStatusSpy = vi.spyOn(orgData, 'updateOrganizationStatus');

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.endsWith('/me') || urlStr.includes('/me')) {
          return new Response(
            JSON.stringify({ id: 'admin-1', role: 'platform_admin', email: 'admin@hellosmart.ai' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        throw new Error('Connection refused: NestJS backend offline');
      });

      try {
        const req = makeRequest(
          'http://localhost:3000/api/admin/organizations',
          'PATCH',
          { id: testOrgId, status: 'suspended' },
        );
        const res = await PATCH_STATUS(req);

        expect(res.status).toBe(503);
        const data = await res.json();
        expect(data).toEqual({
          title: 'Service Unavailable',
          detail: 'Backend service unreachable',
          status: 503,
        });
        expect(updateStatusSpy).not.toHaveBeenCalled();
      } finally {
        (process.env as any).NODE_ENV = originalNodeEnv;
        if (originalDevAccounts !== undefined) {
          process.env.ENABLE_DEV_ACCOUNTS = originalDevAccounts;
        }
      }
    });

    it('falls back to test store when fetch fails in test mode', async () => {
      orgData.resetOrganizationsStore();
      const seeded = orgData.createOrganization({
        name: 'Fallback Status Corp',
        slug: 'fallback-status',
        adminEmail: 'status@fallback.com',
        adminName: 'Status Admin',
        plan: 'pro',
        maxTemplates: 5,
        maxCandidates: 25,
        trialDays: 14,
      });

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.endsWith('/me') || urlStr.includes('/me')) {
          return new Response(
            JSON.stringify({ id: 'admin-1', role: 'platform_admin', email: 'admin@hellosmart.ai' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        throw new Error('Backend offline in test');
      });

      const req = makeRequest(
        'http://localhost:3000/api/admin/organizations',
        'PATCH',
        { id: seeded.id, status: 'suspended' },
      );
      const res = await PATCH_STATUS(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.organization.status).toBe('suspended');
    });
  });
});
