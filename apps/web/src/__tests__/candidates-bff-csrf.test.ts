import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as candidatesGET, POST as candidatesPOST } from '../app/api/company/candidates/route';
import { PATCH as candidatePATCH, DELETE as candidateDELETE } from '../app/api/company/candidates/[id]/route';
import { POST as resendPOST } from '../app/api/company/candidates/[id]/resend-invite/route';
import { POST as assignmentResendPOST } from '../app/api/company/candidates/[id]/assignments/[assignmentId]/resend-invite/route';

describe('Candidate Management BFF Security & CSRF Enforcement (S1-T05-4)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  describe('A. Candidate Creation (POST /api/company/candidates)', () => {
    it('rejects unauthenticated requests with 401 AUTH_REQUIRED', async () => {
      const req = new NextRequest('http://localhost:3000/api/company/candidates', {
        method: 'POST',
        headers: {
          'x-hs-csrf': '1',
          origin: 'http://localhost:3000',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: 'Bruce Wayne', email: 'bruce@example.com' }),
      });

      const res = await candidatesPOST(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.code).toBe('AUTH_REQUIRED');
    });

    it('rejects cross-site request with 403 CSRF_CROSS_SITE_BLOCKED', async () => {
      const req = new NextRequest('http://localhost:3000/api/company/candidates', {
        method: 'POST',
        headers: {
          cookie: 'hs_session=valid_token',
          'x-hs-csrf': '1',
          origin: 'http://localhost:3000',
          'sec-fetch-site': 'cross-site',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: 'Bruce Wayne', email: 'bruce@example.com' }),
      });

      const res = await candidatesPOST(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.code).toBe('CSRF_CROSS_SITE_BLOCKED');
    });

    it('rejects missing Origin and Referer with 403 CSRF_ORIGIN_MISSING', async () => {
      const req = new NextRequest('http://localhost:3000/api/company/candidates', {
        method: 'POST',
        headers: {
          cookie: 'hs_session=valid_token',
          'x-hs-csrf': '1',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: 'Bruce Wayne', email: 'bruce@example.com' }),
      });

      const res = await candidatesPOST(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.code).toBe('CSRF_ORIGIN_MISSING');
    });

    it('rejects untrusted origin with 403 CSRF_INVALID_ORIGIN', async () => {
      const req = new NextRequest('http://localhost:3000/api/company/candidates', {
        method: 'POST',
        headers: {
          cookie: 'hs_session=valid_token',
          'x-hs-csrf': '1',
          origin: 'https://evil-attacker.com',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: 'Bruce Wayne', email: 'bruce@example.com' }),
      });

      const res = await candidatesPOST(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.code).toBe('CSRF_INVALID_ORIGIN');
    });

    it('rejects missing or invalid X-HS-CSRF header with 403 CSRF_TOKEN_MISSING', async () => {
      const req = new NextRequest('http://localhost:3000/api/company/candidates', {
        method: 'POST',
        headers: {
          cookie: 'hs_session=valid_token',
          origin: 'http://localhost:3000',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: 'Bruce Wayne', email: 'bruce@example.com' }),
      });

      const res = await candidatesPOST(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.code).toBe('CSRF_TOKEN_MISSING');
    });

    it('forwards valid POST request upstream and returns 201 response', async () => {
      const mockCandidate = { id: 'c-100', name: 'Bruce Wayne', email: 'bruce@example.com', status: 'invited' };
      (global.fetch as any).mockResolvedValueOnce(
        new Response(JSON.stringify(mockCandidate), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        }),
      );

      const req = new NextRequest('http://localhost:3000/api/company/candidates', {
        method: 'POST',
        headers: {
          cookie: 'hs_session=valid_token',
          'x-hs-csrf': '1',
          origin: 'http://localhost:3000',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: 'Bruce Wayne', email: 'bruce@example.com' }),
      });

      const res = await candidatesPOST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBe('c-100');

      const [targetUrl, fetchInit] = (global.fetch as any).mock.calls[0];
      expect(targetUrl).toContain('/candidates');
      expect(fetchInit.method).toBe('POST');
      expect(fetchInit.headers['X-HS-CSRF']).toBe('1');
      expect(fetchInit.headers.Cookie).toContain('hs_session=valid_token');
    });
  });

  describe('B. Candidate Update (PATCH /api/company/candidates/:id)', () => {
    it('rejects update when CSRF header is missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/company/candidates/c-123', {
        method: 'PATCH',
        headers: {
          cookie: 'hs_session=valid_token',
          origin: 'http://localhost:3000',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: 'Updated Name' }),
      });

      const res = await candidatePATCH(req, { params: Promise.resolve({ id: 'c-123' }) });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.code).toBe('CSRF_TOKEN_MISSING');
    });

    it('forwards valid update with ID parameter', async () => {
      (global.fetch as any).mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'c-123', name: 'Updated Name' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

      const req = new NextRequest('http://localhost:3000/api/company/candidates/c-123', {
        method: 'PATCH',
        headers: {
          cookie: 'hs_session=valid_token',
          'x-hs-csrf': '1',
          origin: 'http://localhost:3000',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: 'Updated Name' }),
      });

      const res = await candidatePATCH(req, { params: Promise.resolve({ id: 'c-123' }) });
      expect(res.status).toBe(200);

      const [targetUrl] = (global.fetch as any).mock.calls[0];
      expect(targetUrl).toContain('/candidates/c-123');
    });
  });

  describe('C. Candidate Deletion (DELETE /api/company/candidates/:id)', () => {
    it('rejects delete when Origin is missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/company/candidates/c-123', {
        method: 'DELETE',
        headers: {
          cookie: 'hs_session=valid_token',
          'x-hs-csrf': '1',
        },
      });

      const res = await candidateDELETE(req, { params: Promise.resolve({ id: 'c-123' }) });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.code).toBe('CSRF_ORIGIN_MISSING');
    });

    it('forwards valid delete request upstream', async () => {
      (global.fetch as any).mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

      const req = new NextRequest('http://localhost:3000/api/company/candidates/c-123', {
        method: 'DELETE',
        headers: {
          cookie: 'hs_session=valid_token',
          'x-hs-csrf': '1',
          origin: 'http://localhost:3000',
        },
      });

      const res = await candidateDELETE(req, { params: Promise.resolve({ id: 'c-123' }) });
      expect(res.status).toBe(200);

      const [targetUrl] = (global.fetch as any).mock.calls[0];
      expect(targetUrl).toContain('/candidates/c-123');
    });
  });

  describe('D. Candidate Resend Invite (POST /api/company/candidates/:id/resend-invite)', () => {
    it('rejects resend when CSRF is missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/company/candidates/c-123/resend-invite', {
        method: 'POST',
        headers: {
          cookie: 'hs_session=valid_token',
          origin: 'http://localhost:3000',
        },
      });

      const res = await resendPOST(req, { params: Promise.resolve({ id: 'c-123' }) });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.code).toBe('CSRF_TOKEN_MISSING');
    });

    it('forwards valid resend request and propagates 409 conflict when candidate already connected', async () => {
      (global.fetch as any).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            title: 'Conflict',
            status: 409,
            detail: 'Candidate has already started or submitted the assessment.',
            code: 'ASSIGNMENT_ALREADY_CONNECTED',
          }),
          {
            status: 409,
            headers: { 'content-type': 'application/problem+json' },
          },
        ),
      );

      const req = new NextRequest('http://localhost:3000/api/company/candidates/c-123/resend-invite', {
        method: 'POST',
        headers: {
          cookie: 'hs_session=valid_token',
          'x-hs-csrf': '1',
          origin: 'http://localhost:3000',
        },
      });

      const res = await resendPOST(req, { params: Promise.resolve({ id: 'c-123' }) });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.code).toBe('ASSIGNMENT_ALREADY_CONNECTED');

      const [targetUrl] = (global.fetch as any).mock.calls[0];
      expect(targetUrl).toContain('/candidates/c-123/resend-invite');
    });

    it('forwards explicit assignment resend request to /candidates/:id/assignments/:assignmentId/resend-invite', async () => {
      (global.fetch as any).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            deliveryStatus: 'sent',
            processedAt: '2026-11-02T10:00:00.000Z',
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      );

      const req = new NextRequest(
        'http://localhost:3000/api/company/candidates/c-123/assignments/a-456/resend-invite',
        {
          method: 'POST',
          headers: {
            cookie: 'hs_session=valid_token',
            'x-hs-csrf': '1',
            origin: 'http://localhost:3000',
          },
        },
      );

      const res = await assignmentResendPOST(req, {
        params: Promise.resolve({ id: 'c-123', assignmentId: 'a-456' }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.deliveryStatus).toBe('sent');

      const [targetUrl, fetchInit] = (global.fetch as any).mock.calls[0];
      expect(targetUrl).toContain('/candidates/c-123/assignments/a-456/resend-invite');
      expect(fetchInit.headers['X-HS-CSRF']).toBe('1');
      expect(fetchInit.headers.Cookie).toContain('hs_session=valid_token');
    });

    it('rejects explicit assignment resend when CSRF header is missing', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/company/candidates/c-123/assignments/a-456/resend-invite',
        {
          method: 'POST',
          headers: {
            cookie: 'hs_session=valid_token',
            origin: 'http://localhost:3000',
          },
        },
      );

      const res = await assignmentResendPOST(req, {
        params: Promise.resolve({ id: 'c-123', assignmentId: 'a-456' }),
      });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.code).toBe('CSRF_TOKEN_MISSING');
    });
  });

  describe('E. Candidate Listing (GET /api/company/candidates)', () => {
    it('allows safe GET requests without requiring X-HS-CSRF header', async () => {
      (global.fetch as any).mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [], total: 0 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

      const req = new NextRequest('http://localhost:3000/api/company/candidates?search=test&page=1&limit=10', {
        method: 'GET',
        headers: {
          cookie: 'hs_session=valid_token',
        },
      });

      const res = await candidatesGET(req);
      expect(res.status).toBe(200);

      const [targetUrl] = (global.fetch as any).mock.calls[0];
      expect(targetUrl).toContain('/candidates?search=test&page=1&limit=10');
    });
  });
});

