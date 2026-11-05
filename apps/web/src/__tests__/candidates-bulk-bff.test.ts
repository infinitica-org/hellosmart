import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../app/api/company/candidates/bulk/route';

describe('BFF Candidate Bulk Upload Route (CSRF, Fail-Closed Origin & Auth Forwarding)', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('rejects unauthenticated requests with 401 when hs_session cookie is missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/company/candidates/bulk', {
      method: 'POST',
      headers: {
        'x-hs-csrf': '1',
        origin: 'http://localhost:3000',
        'content-type': 'text/csv',
      },
      body: 'name,email\nAlice,alice@example.com\n',
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.code).toBe('AUTH_REQUIRED');
  });

  it('fails closed with 403 CSRF_ORIGIN_MISSING when both Origin and Referer headers are missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/company/candidates/bulk', {
      method: 'POST',
      headers: {
        cookie: 'hs_session=valid_session_token_123',
        'x-hs-csrf': '1',
        'content-type': 'text/csv',
      },
      body: 'name,email\nAlice,alice@example.com\n',
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.code).toBe('CSRF_ORIGIN_MISSING');
    expect(data.detail).toContain('missing Origin and Referer');
  });

  it('fails closed with 403 CSRF_INVALID_ORIGIN when Origin is literal "null"', async () => {
    const req = new NextRequest('http://localhost:3000/api/company/candidates/bulk', {
      method: 'POST',
      headers: {
        cookie: 'hs_session=valid_session_token_123',
        'x-hs-csrf': '1',
        origin: 'null',
        'content-type': 'text/csv',
      },
      body: 'name,email\nAlice,alice@example.com\n',
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.code).toBe('CSRF_INVALID_ORIGIN');
    expect(data.detail).toContain('Origin null is not permitted');
  });

  it('fails closed with 403 CSRF_INVALID_ORIGIN when Origin is malformed', async () => {
    const req = new NextRequest('http://localhost:3000/api/company/candidates/bulk', {
      method: 'POST',
      headers: {
        cookie: 'hs_session=valid_session_token_123',
        'x-hs-csrf': '1',
        origin: 'not-a-valid-url:::80',
        'content-type': 'text/csv',
      },
      body: 'name,email\nAlice,alice@example.com\n',
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.code).toBe('CSRF_INVALID_ORIGIN');
    expect(data.detail).toContain('malformed Origin');
  });

  it('fails closed with 403 CSRF_INVALID_REFERER when Referer is malformed', async () => {
    const req = new NextRequest('http://localhost:3000/api/company/candidates/bulk', {
      method: 'POST',
      headers: {
        cookie: 'hs_session=valid_session_token_123',
        'x-hs-csrf': '1',
        referer: 'malformed://!@#$',
        'content-type': 'text/csv',
      },
      body: 'name,email\nAlice,alice@example.com\n',
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.code).toBe('CSRF_INVALID_REFERER');
  });

  it('rejects requests from untrusted browser origins with 403 CSRF_INVALID_ORIGIN', async () => {
    const req = new NextRequest('http://localhost:3000/api/company/candidates/bulk', {
      method: 'POST',
      headers: {
        cookie: 'hs_session=valid_session_token_123',
        'x-hs-csrf': '1',
        origin: 'https://malicious-attacker.com',
        'content-type': 'text/csv',
      },
      body: 'name,email\nAttacker,attacker@example.com\n',
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.code).toBe('CSRF_INVALID_ORIGIN');
    expect(data.detail).toContain('untrusted origin');
  });

  it('rejects cross-site requests with 403 CSRF_CROSS_SITE_BLOCKED when sec-fetch-site is cross-site', async () => {
    const req = new NextRequest('http://localhost:3000/api/company/candidates/bulk', {
      method: 'POST',
      headers: {
        cookie: 'hs_session=valid_session_token_123',
        'x-hs-csrf': '1',
        'sec-fetch-site': 'cross-site',
        origin: 'http://localhost:3000',
        'content-type': 'text/csv',
      },
      body: 'name,email\nAlice,alice@example.com\n',
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.code).toBe('CSRF_CROSS_SITE_BLOCKED');
  });

  it('rejects requests missing the X-HS-CSRF header with 403 CSRF_TOKEN_MISSING', async () => {
    const req = new NextRequest('http://localhost:3000/api/company/candidates/bulk', {
      method: 'POST',
      headers: {
        cookie: 'hs_session=valid_session_token_123',
        origin: 'http://localhost:3000',
        'content-type': 'text/csv',
      },
      body: 'name,email\nAlice,alice@example.com\n',
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.code).toBe('CSRF_TOKEN_MISSING');
  });

  it('accepts same-origin Referer when Origin header is omitted and forwards validated origin', async () => {
    const mockApiResponse = new Response(
      JSON.stringify({ totalRows: 1, processedRows: 1, successfulRows: 1, failedRows: 0 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
    const mockFetch = vi.fn().mockResolvedValue(mockApiResponse);
    global.fetch = mockFetch;

    const req = new NextRequest('http://localhost:3000/api/company/candidates/bulk', {
      method: 'POST',
      headers: {
        cookie: 'hs_session=valid_session_token_123',
        'x-hs-csrf': '1',
        referer: 'http://localhost:3000/company/candidates/upload',
        'content-type': 'text/csv',
      },
      body: 'name,email\nAlice,alice@example.com\n',
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const forwardedHeaders = init.headers as Record<string, string>;
    expect(forwardedHeaders['Origin']).toBe('http://localhost:3000');
  });

  it('validates same-origin browser request and forwards stream, CSRF, Cookie, and Authorization headers', async () => {
    const mockApiResponse = new Response(
      JSON.stringify({
        totalRows: 1,
        processedRows: 1,
        successfulRows: 1,
        failedRows: 0,
        errorsTruncated: false,
        errors: [],
        createdSample: [],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );

    const mockFetch = vi.fn().mockResolvedValue(mockApiResponse);
    global.fetch = mockFetch;

    const req = new NextRequest('http://localhost:3000/api/company/candidates/bulk?assessment_id=33333333-4444-5555-6666-777777777777', {
      method: 'POST',
      headers: {
        cookie: 'hs_session=session_token_abc_123',
        'x-hs-csrf': '1',
        origin: 'http://localhost:3000',
        'content-type': 'text/csv',
      },
      body: 'name,email\nAlice,alice@example.com\n',
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [targetUrl, init] = mockFetch.mock.calls[0] as [string, RequestInit & { duplex?: string }];
    expect(targetUrl).toContain('/company/candidates/bulk?assessment_id=33333333-4444-5555-6666-777777777777');
    expect(init.method).toBe('POST');
    expect(init.duplex).toBe('half');

    const forwardedHeaders = init.headers as Record<string, string>;
    expect(forwardedHeaders['X-HS-CSRF']).toBe('1');
    expect(forwardedHeaders['Origin']).toBe('http://localhost:3000');
    expect(forwardedHeaders['Cookie']).toBe('hs_session=session_token_abc_123');
    expect(forwardedHeaders['Authorization']).toBe('Bearer session_token_abc_123');
    expect(forwardedHeaders['Content-Type']).toBe('text/csv');
  });
});
