import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getKeys, POST as createKey } from '@/app/api/admin/ai-keys/route';
import {
  GET as getKeyById,
  PATCH as updateKey,
  DELETE as deleteKey,
} from '@/app/api/admin/ai-keys/[id]/route';
import { POST as testKey } from '@/app/api/admin/ai-keys/[id]/test/route';
import {
  GET as getAllocations,
  POST as createAllocation,
} from '@/app/api/admin/ai-allocations/route';
import {
  GET as getAllocationById,
  PATCH as adjustAllocation,
} from '@/app/api/admin/ai-allocations/[id]/route';
import { POST as revokeAllocation } from '@/app/api/admin/ai-allocations/[id]/revoke/route';
import { GET as getStats } from '@/app/api/admin/ai-vault/stats/route';

function makeRequest(
  url: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  body?: any,
  role: string = 'platform_admin',
  csrf: boolean = true,
): NextRequest {
  const token = role === 'platform_admin' ? 'sess_admin_test_123' : 'sess_company_test_123';

  const headers: Record<string, string> = {
    cookie: `hs_session=${token}`,
    'content-type': 'application/json',
  };

  if ((method === 'POST' || method === 'PATCH' || method === 'DELETE') && csrf) {
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

describe('Admin AI Keys & Credit Allocations BFF Routes (S1B-T05-2)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('AI Keys Vault BFF Routes', () => {
    it('GET /api/admin/ai-keys blocks unauthenticated requests with 401', async () => {
      const anonReq = new NextRequest('http://localhost:3000/api/admin/ai-keys', { method: 'GET' });
      const res = await getKeys(anonReq);
      expect(res.status).toBe(401);
    });

    it('POST /api/admin/ai-keys rejects request missing X-HS-CSRF with 403', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({ id: 'admin-1', role: 'platform_admin', email: 'admin@hellosmart.ai' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const reqNoCsrf = makeRequest(
        'http://localhost:3000/api/admin/ai-keys',
        'POST',
        { provider: 'openai', name: 'Key', apiKey: 'sk-test12345678' },
        'platform_admin',
        false, // No CSRF
      );
      const res = await createKey(reqNoCsrf);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.detail).toContain('Missing or invalid CSRF token');
    });

    it('POST /api/admin/ai-keys proxies request upstream with CSRF header', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, init: any) => {
        const urlStr = String(url);
        if (urlStr.includes('/admin/ai-keys') && init?.method === 'POST') {
          return new Response(
            JSON.stringify({
              id: '11111111-1111-1111-1111-111111111111',
              provider: 'openai',
              name: 'Master Key',
              maskedKey: 'sk-...4821',
              keyLast4: '4821',
              status: 'active',
              isActive: true,
              totalAllocatedCents: 0,
              activeAllocationsCount: 0,
              createdAt: '2026-11-06T12:00:00Z',
              updatedAt: '2026-11-06T12:00:00Z',
            }),
            { status: 201, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response(
          JSON.stringify({ id: 'admin-1', role: 'platform_admin', email: 'admin@hellosmart.ai' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      });

      const req = makeRequest('http://localhost:3000/api/admin/ai-keys', 'POST', {
        provider: 'openai',
        name: 'Master Key',
        apiKey: 'sk-test123456784821',
      });
      const res = await createKey(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.maskedKey).toBe('sk-...4821');
    });

    it('GET /api/admin/ai-keys returns 503 in production on network failure without falling back', async () => {
      const origEnv = process.env.NODE_ENV;
      (process.env as any).NODE_ENV = 'production';

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('/me')) {
          return new Response(
            JSON.stringify({ id: 'admin-1', role: 'platform_admin', email: 'admin@hellosmart.ai' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        throw new Error('Connection refused to backend API');
      });

      try {
        const req = makeRequest('http://localhost:3000/api/admin/ai-keys', 'GET');
        const res = await getKeys(req);
        expect(res.status).toBe(503);
        const data = await res.json();
        expect(data.title).toBe('Service Unavailable');
      } finally {
        (process.env as any).NODE_ENV = origEnv;
      }
    });

    it('POST /api/admin/ai-keys returns 503 in production on network failure without falling back', async () => {
      const origEnv = process.env.NODE_ENV;
      (process.env as any).NODE_ENV = 'production';

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('/me')) {
          return new Response(
            JSON.stringify({ id: 'admin-1', role: 'platform_admin', email: 'admin@hellosmart.ai' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        throw new Error('Connection refused to backend API');
      });

      try {
        const req = makeRequest('http://localhost:3000/api/admin/ai-keys', 'POST', {
          provider: 'openai',
          name: 'Master Key',
          apiKey: 'sk-test123456784821',
        });
        const res = await createKey(req);
        expect(res.status).toBe(503);
        const data = await res.json();
        expect(data.title).toBe('Service Unavailable');
      } finally {
        (process.env as any).NODE_ENV = origEnv;
      }
    });

    it('POST /api/admin/ai-keys/[id]/test verifies envelope and proxies test', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('/test')) {
          return new Response(
            JSON.stringify({
              success: true,
              message: 'Cryptographic envelope and decryption verified successfully.',
              testedAt: '2026-11-06T12:00:00Z',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response(
          JSON.stringify({ id: 'admin-1', role: 'platform_admin', email: 'admin@hellosmart.ai' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      });

      const req = makeRequest(
        'http://localhost:3000/api/admin/ai-keys/11111111-1111-1111-1111-111111111111/test',
        'POST',
      );
      const res = await testKey(req, {
        params: Promise.resolve({ id: '11111111-1111-1111-1111-111111111111' }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Cryptographic envelope and decryption verified successfully.');
    });
  });

  describe('Credit Allocations BFF Routes', () => {
    it('GET /api/admin/ai-allocations blocks unauthenticated requests with 401', async () => {
      const anonReq = new NextRequest('http://localhost:3000/api/admin/ai-allocations', {
        method: 'GET',
      });
      const res = await getAllocations(anonReq);
      expect(res.status).toBe(401);
    });

    it('GET /api/admin/ai-allocations returns 503 in production on network failure without falling back', async () => {
      const origEnv = process.env.NODE_ENV;
      (process.env as any).NODE_ENV = 'production';

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('/me')) {
          return new Response(
            JSON.stringify({ id: 'admin-1', role: 'platform_admin', email: 'admin@hellosmart.ai' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        throw new Error('Connection refused to backend API');
      });

      try {
        const req = makeRequest('http://localhost:3000/api/admin/ai-allocations', 'GET');
        const res = await getAllocations(req);
        expect(res.status).toBe(503);
        const data = await res.json();
        expect(data.title).toBe('Service Unavailable');
      } finally {
        (process.env as any).NODE_ENV = origEnv;
      }
    });

    it('POST /api/admin/ai-allocations rejects missing CSRF with 403', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({ id: 'admin-1', role: 'platform_admin', email: 'admin@hellosmart.ai' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const reqNoCsrf = makeRequest(
        'http://localhost:3000/api/admin/ai-allocations',
        'POST',
        {
          orgId: '33333333-3333-3333-3333-333333333333',
          platformKeyId: '11111111-1111-1111-1111-111111111111',
          allocatedAmountCents: 10000,
        },
        'platform_admin',
        false,
      );
      const res = await createAllocation(reqNoCsrf);
      expect(res.status).toBe(403);
    });

    it('PATCH /api/admin/ai-allocations/[id] proxies adjustment with CSRF', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, init: any) => {
        const urlStr = String(url);
        if (urlStr.includes('/admin/ai-allocations/') && init?.method === 'PATCH') {
          return new Response(
            JSON.stringify({
              id: '22222222-2222-2222-2222-222222222222',
              orgId: '33333333-3333-3333-3333-333333333333',
              allocatedAmountCents: 15000,
              usedAmountCents: 2500,
              balanceCents: 12500,
              status: 'active',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response(
          JSON.stringify({ id: 'admin-1', role: 'platform_admin', email: 'admin@hellosmart.ai' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      });

      const req = makeRequest(
        'http://localhost:3000/api/admin/ai-allocations/22222222-2222-2222-2222-222222222222',
        'PATCH',
        {
          adjustmentAmountCents: 5000,
          reason: 'Customer requested top-up',
        },
      );
      const res = await adjustAllocation(req, {
        params: Promise.resolve({ id: '22222222-2222-2222-2222-222222222222' }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.balanceCents).toBe(12500);
    });

    it('POST /api/admin/ai-allocations/[id]/revoke proxies revocation with CSRF', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, init: any) => {
        const urlStr = String(url);
        if (urlStr.includes('/revoke')) {
          return new Response(
            JSON.stringify({
              id: '22222222-2222-2222-2222-222222222222',
              status: 'revoked',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response(
          JSON.stringify({ id: 'admin-1', role: 'platform_admin', email: 'admin@hellosmart.ai' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      });

      const req = makeRequest(
        'http://localhost:3000/api/admin/ai-allocations/22222222-2222-2222-2222-222222222222/revoke',
        'POST',
        { reason: 'Subscription cancellation' },
      );
      const res = await revokeAllocation(req, {
        params: Promise.resolve({ id: '22222222-2222-2222-2222-222222222222' }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('revoked');
    });

    it('GET /api/admin/ai-vault/stats returns aggregate metrics', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('/stats')) {
          return new Response(
            JSON.stringify({
              totalKeys: 4,
              activeKeys: 3,
              totalAllocations: 12,
              totalAllocatedCents: 150000,
              totalUsedCents: 45000,
              totalRemainingBalanceCents: 105000,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response(
          JSON.stringify({ id: 'admin-1', role: 'platform_admin', email: 'admin@hellosmart.ai' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      });

      const req = makeRequest('http://localhost:3000/api/admin/ai-vault/stats', 'GET');
      const res = await getStats(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.totalKeys).toBe(4);
      expect(data.totalRemainingBalanceCents).toBe(105000);
    });
  });
});
