import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/admin/quotes/route';

function makeRequest(
  method: 'GET' | 'POST',
  body?: any,
  role: string = 'platform_admin'
): NextRequest {
  const token = role === 'platform_admin' ? 'sess_123_admin' : 'sess_123_company';

  const headers: Record<string, string> = {
    cookie: `hs_session=${token}`,
    'content-type': 'application/json',
  };

  if (method === 'POST') {
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

  return new NextRequest('http://localhost:3000/api/admin/quotes', init as any);
}

describe('Admin Quotes BFF Route (BUG-SA-09)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('blocks unauthenticated requests with 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const anonReq = new NextRequest('http://localhost:3000/api/admin/quotes', {
      method: 'GET',
    });
    const anonRes = await GET(anonReq);
    expect(anonRes.status).toBe(401);
  });

  it('forwards authorization and proxies backend 403 for unauthorized roles', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const companyAdminReq = makeRequest('GET', undefined, 'company_admin');
    const companyRes = await GET(companyAdminReq);
    expect(companyRes.status).toBe(403);
  });

  it('returns quotes array with 200 for platform_admin', async () => {
    const mockQuotes = [
      {
        id: 'quote_001',
        organizationId: 'org_acme',
        amount: 1499,
        currency: 'USD',
        status: 'sent',
      },
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockQuotes), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const req = makeRequest('GET');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(1);
    expect(data[0].id).toBe('quote_001');
    expect(data[0].organizationId).toBe('org_acme');
  });

  it('validates quote payload on POST and proxies validation error with 400', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Organization ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const invalidReq = makeRequest('POST', { amount: 1000, currency: 'USD' });
    const res = await POST(invalidReq);
    expect(res.status).toBe(400);
  });

  it('successfully creates a draft quote on valid POST', async () => {
    const createdQuote = {
      id: 'quote_test_new',
      organizationId: 'org_test_new',
      amount: 4500,
      currency: 'USD',
      status: 'draft',
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(createdQuote), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const validReq = makeRequest('POST', {
      organizationId: 'org_test_new',
      amount: 4500,
      currency: 'usd',
    });
    const res = await POST(validReq);
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.organizationId).toBe('org_test_new');
    expect(data.amount).toBe(4500);
    expect(data.currency).toBe('USD');
    expect(data.status).toBe('draft');
  });
});
