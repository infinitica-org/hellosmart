import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/admin/audit/route';
import { POST } from '@/app/api/admin/audit/verify-chain/route';

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

describe('Admin Audit BFF Routes (S1B-T05-4)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/admin/audit', () => {
    it('blocks unauthenticated requests with 401', async () => {
      const anonReq = new NextRequest('http://localhost:3000/api/admin/audit', {
        method: 'GET',
      });
      const res = await GET(anonReq);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.detail).toContain('Authentication required');
    });

    it('forwards query parameters and returns paginated audit records', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('/admin/audit')) {
          return new Response(
            JSON.stringify({
              items: [
                {
                  id: '1',
                  action: 'org.provisioned',
                  entity: 'organization',
                  actor_role: 'platform_admin',
                  hash: 'abcd',
                },
              ],
              total: 1,
              page: 1,
              page_size: 25,
              total_pages: 1,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        // auth validation endpoint
        return new Response(
          JSON.stringify({ id: 'admin-1', role: 'platform_admin', email: 'admin@hellosmart.ai' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      });

      const req = makeRequest('http://localhost:3000/api/admin/audit?page=1&action=org.provisioned', 'GET');
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.items).toHaveLength(1);
      expect(data.items[0].action).toBe('org.provisioned');
    });
  });

  describe('POST /api/admin/audit/verify-chain', () => {
    it('blocks unauthenticated requests with 401', async () => {
      const anonReq = new NextRequest('http://localhost:3000/api/admin/audit/verify-chain', {
        method: 'POST',
      });
      const res = await POST(anonReq);
      expect(res.status).toBe(401);
    });

    it('rejects POST request without X-HS-CSRF header with 403', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({ id: 'admin-1', role: 'platform_admin', email: 'admin@hellosmart.ai' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const reqNoCsrf = makeRequest(
        'http://localhost:3000/api/admin/audit/verify-chain',
        'POST',
        undefined,
        'platform_admin',
        false, // NO CSRF
      );
      const res = await POST(reqNoCsrf);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.detail).toContain('Missing or invalid CSRF token');
    });

    it('forwards verify-chain request with valid CSRF and returns verification result', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('/admin/audit/verify-chain')) {
          return new Response(
            JSON.stringify({
              valid: true,
              verified_at: '2026-11-06T11:00:00.000Z',
              records_checked: 42,
              chain_start: '1',
              chain_end: '42',
              tamper_type: 'none',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response(
          JSON.stringify({ id: 'admin-1', role: 'platform_admin', email: 'admin@hellosmart.ai' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      });

      const req = makeRequest('http://localhost:3000/api/admin/audit/verify-chain', 'POST');
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.valid).toBe(true);
      expect(data.records_checked).toBe(42);
    });
  });
});
