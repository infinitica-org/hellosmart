import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  CSRF_HEADER_NAME,
  CSRF_HEADER_VALUE,
  getQuoteByToken,
  acceptQuote,
} from '../lib/api-client';
import { GET as getQuoteRoute } from '../app/api/quotes/[token]/route';
import { POST as acceptQuoteRoute } from '../app/api/quotes/[token]/accept/route';

describe('Customer Quote BFF & API Client Integration (PHS-I128 / SP-010)', () => {
  describe('api-client quote helpers', () => {
    it('getQuoteByToken dispatches GET without CSRF header and returns minimized quote', async () => {
      const mockQuote = {
        id: '11111111-1111-1111-1111-111111111111',
        quoteNumber: 'HS-QT-20261103-TEST',
        currency: 'INR',
        status: 'issued',
        subtotal: 10000,
        discountTotal: 0,
        taxableAmount: 10000,
        cgstTotal: 900,
        sgstTotal: 900,
        igstTotal: 0,
        taxTotal: 1800,
        grandTotal: 11800,
        taxClassification: 'intra_state',
        sellerJurisdiction: { country: 'IN', state: 'KA' },
        customerJurisdiction: { country: 'IN', state: 'KA' },
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        lines: [],
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockQuote,
      });

      const result = await getQuoteByToken('test-token-123', mockFetch as unknown as typeof fetch);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/quotes/test-token-123');
      expect(init.method).toBe('GET');
      expect(init.credentials).toBe('include');
      expect((init.headers as any)[CSRF_HEADER_NAME]).toBeUndefined();
      expect(result).toEqual(mockQuote);
    });

    it('acceptQuote dispatches POST with X-HS-CSRF: 1 and credentials', async () => {
      const mockResponse = {
        success: true,
        alreadyAccepted: false,
        message: 'Quotation approved successfully.',
        quote: { id: '11111111-1111-1111-1111-111111111111', status: 'accepted' },
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await acceptQuote(
        'test-token-456',
        {
          acceptedByName: 'Jane Signer',
          confirmationAcknowledged: true,
        },
        mockFetch as unknown as typeof fetch,
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/quotes/test-token-456/accept');
      expect(init.method).toBe('POST');
      expect(init.credentials).toBe('include');
      expect((init.headers as any)[CSRF_HEADER_NAME]).toBe(CSRF_HEADER_VALUE);
      expect(JSON.parse(init.body as string)).toEqual({
        acceptedByName: 'Jane Signer',
        confirmationAcknowledged: true,
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('Next.js BFF route handlers — CSRF & Origin Validation', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('rejects missing X-HS-CSRF header with 400 Bad Request', async () => {
      const req = new NextRequest('http://localhost:3000/api/quotes/token123/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
          // Omitting X-HS-CSRF
        },
        body: JSON.stringify({ confirmationAcknowledged: true }),
      });

      const context = { params: Promise.resolve({ token: 'token123' }) };
      const response = await acceptQuoteRoute(req, context);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.code).toBe('CSRF_VALIDATION_FAILED');
      expect(json.detail).toContain('X-HS-CSRF');
    });

    it('rejects invalid X-HS-CSRF header value with 400 Bad Request', async () => {
      const req = new NextRequest('http://localhost:3000/api/quotes/token123/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
          'X-HS-CSRF': '0',
        },
        body: JSON.stringify({ confirmationAcknowledged: true }),
      });

      const context = { params: Promise.resolve({ token: 'token123' }) };
      const response = await acceptQuoteRoute(req, context);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.code).toBe('CSRF_VALIDATION_FAILED');
    });

    it('rejects missing Origin header with 403 Forbidden', async () => {
      const req = new NextRequest('http://localhost:3000/api/quotes/token123/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-HS-CSRF': '1',
          // Omitting Origin
        },
        body: JSON.stringify({ confirmationAcknowledged: true }),
      });

      const context = { params: Promise.resolve({ token: 'token123' }) };
      const response = await acceptQuoteRoute(req, context);

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.code).toBe('CSRF_INVALID_ORIGIN');
      expect(json.detail).toContain('Origin');
    });

    it('rejects null Origin header ("null") with 403 Forbidden', async () => {
      const req = new NextRequest('http://localhost:3000/api/quotes/token123/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-HS-CSRF': '1',
          Origin: 'null',
        },
        body: JSON.stringify({ confirmationAcknowledged: true }),
      });

      const context = { params: Promise.resolve({ token: 'token123' }) };
      const response = await acceptQuoteRoute(req, context);

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.code).toBe('CSRF_INVALID_ORIGIN');
    });

    it('rejects malformed Origin header with 403 Forbidden', async () => {
      const req = new NextRequest('http://localhost:3000/api/quotes/token123/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-HS-CSRF': '1',
          Origin: 'not-a-valid-url',
        },
        body: JSON.stringify({ confirmationAcknowledged: true }),
      });

      const context = { params: Promise.resolve({ token: 'token123' }) };
      const response = await acceptQuoteRoute(req, context);

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.code).toBe('CSRF_INVALID_ORIGIN');
      expect(json.detail).toContain('Malformed Origin');
    });

    it('rejects untrusted third-party Origin with 403 Forbidden', async () => {
      const req = new NextRequest('http://localhost:3000/api/quotes/token123/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-HS-CSRF': '1',
          Origin: 'https://evil-attacker.example.com',
        },
        body: JSON.stringify({ confirmationAcknowledged: true }),
      });

      const context = { params: Promise.resolve({ token: 'token123' }) };
      const response = await acceptQuoteRoute(req, context);

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.code).toBe('CSRF_INVALID_ORIGIN');
      expect(json.detail).toContain('Untrusted Origin');
    });

    it('accepts valid canonical Origin with X-HS-CSRF: 1 and proxies upstream', async () => {
      const mockApiResponse = {
        success: true,
        alreadyAccepted: false,
        message: 'Quotation approved successfully.',
        quote: { id: '11111111-1111-1111-1111-111111111111', status: 'accepted' },
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(mockApiResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const req = new NextRequest('http://localhost:3000/api/quotes/token123/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-HS-CSRF': '1',
          Origin: 'http://localhost:3000',
        },
        body: JSON.stringify({ confirmationAcknowledged: true, acceptedByName: 'Alice' }),
      });

      const context = { params: Promise.resolve({ token: 'token123' }) };
      const response = await acceptQuoteRoute(req, context);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.message).toContain('approved');
    });
  });
});
