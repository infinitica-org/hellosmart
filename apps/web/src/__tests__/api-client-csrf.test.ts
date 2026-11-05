import { describe, it, expect, vi } from 'vitest';
import {
  apiFetch,
  attachCsrfHeader,
  getCsrfHeaders,
  CSRF_HEADER_NAME,
  CSRF_HEADER_VALUE,
  login,
  acceptInvitation,
  logout,
  changePassword,
  validateInvitation,
  getMe,
} from '../lib/api-client';

describe('API Client CSRF & Contract Tests (S0-T14-2 & S0-T14-1 Integration)', () => {
  describe('getCsrfHeaders & attachCsrfHeader helpers', () => {
    it('returns X-HS-CSRF: 1 for state-changing HTTP methods', () => {
      expect(getCsrfHeaders('POST')).toEqual({ [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE });
      expect(getCsrfHeaders('post')).toEqual({ [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE });
      expect(getCsrfHeaders('PUT')).toEqual({ [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE });
      expect(getCsrfHeaders('PATCH')).toEqual({ [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE });
      expect(getCsrfHeaders('DELETE')).toEqual({ [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE });
    });

    it('returns empty headers for safe HTTP methods', () => {
      expect(getCsrfHeaders('GET')).toEqual({});
      expect(getCsrfHeaders('HEAD')).toEqual({});
      expect(getCsrfHeaders('OPTIONS')).toEqual({});
      expect(getCsrfHeaders(undefined)).toEqual({});
    });

    it('attaches CSRF header onto Headers instance while preserving existing headers', () => {
      const headers = attachCsrfHeader({ Authorization: 'Bearer token123' }, 'POST');
      expect(headers.get(CSRF_HEADER_NAME)).toBe(CSRF_HEADER_VALUE);
      expect(headers.get('Authorization')).toBe('Bearer token123');
    });
  });

  describe('apiFetch wrapper', () => {
    it('automatically injects X-HS-CSRF on POST requests and defaults credentials to include', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));

      await apiFetch('http://localhost:4000/api/v1/resource', { method: 'POST' }, mockFetch as unknown as typeof fetch);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = (mockFetch.mock.calls[0] ?? []) as [RequestInfo | URL, RequestInit];
      expect(url).toBe('http://localhost:4000/api/v1/resource');
      expect(init.credentials).toBe('include');

      const headers = new Headers(init.headers);
      expect(headers.get(CSRF_HEADER_NAME)).toBe(CSRF_HEADER_VALUE);
      expect(headers.get('Idempotency-Key')).toBeTruthy();
    });

    it('does not inject X-HS-CSRF on GET requests', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));

      await apiFetch('http://localhost:4000/api/v1/resource', { method: 'GET' }, mockFetch as unknown as typeof fetch);

      const [, init] = (mockFetch.mock.calls[0] ?? []) as [RequestInfo | URL, RequestInit];
      const headers = new Headers(init.headers);
      expect(headers.get(CSRF_HEADER_NAME)).toBeNull();
    });
  });

  describe('High-level API client methods', () => {
    it('login sends X-HS-CSRF: 1 and throws generic message on 401', async () => {
      const mockFetch401 = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Unauthorized' }),
      });

      await expect(
        login({ email: 'user@test.com', password: 'wrong' }, mockFetch401 as unknown as typeof fetch),
      ).rejects.toThrow('Invalid email or password, or account not found.');

      const [, init] = (mockFetch401.mock.calls[0] ?? []) as [string, RequestInit & { headers: Record<string, string> }];
      expect(init.headers[CSRF_HEADER_NAME]).toBe(CSRF_HEADER_VALUE);
      expect(init.credentials).toBe('include');
    });

    it('acceptInvitation sends X-HS-CSRF: 1', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      await acceptInvitation(
        { token: 'tok_123', password: 'ValidPassword123!' },
        mockFetch as unknown as typeof fetch,
      );

      const [, init] = (mockFetch.mock.calls[0] ?? []) as [string, RequestInit & { headers: Record<string, string> }];
      expect(init.headers[CSRF_HEADER_NAME]).toBe(CSRF_HEADER_VALUE);
    });

    it('logout sends X-HS-CSRF: 1', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      await logout(mockFetch as unknown as typeof fetch);

      const [, init] = (mockFetch.mock.calls[0] ?? []) as [string, RequestInit & { headers: Record<string, string> }];
      expect(init.headers[CSRF_HEADER_NAME]).toBe(CSRF_HEADER_VALUE);
    });

    it('changePassword sends X-HS-CSRF: 1', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      await changePassword(
        { currentPassword: 'old', newPassword: 'new' },
        mockFetch as unknown as typeof fetch,
      );

      const [, init] = (mockFetch.mock.calls[0] ?? []) as [string, RequestInit & { headers: Record<string, string> }];
      expect(init.headers[CSRF_HEADER_NAME]).toBe(CSRF_HEADER_VALUE);
    });

    it('validateInvitation and getMe do not attach X-HS-CSRF', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: '1' }),
      });

      await validateInvitation('tok_abc', mockFetch as unknown as typeof fetch);
      const [, initValidate] = (mockFetch.mock.calls[0] ?? []) as [string, RequestInit & { headers: Record<string, string> }];
      expect(initValidate.headers[CSRF_HEADER_NAME]).toBeUndefined();

      await getMe(mockFetch as unknown as typeof fetch);
      const [, initMe] = (mockFetch.mock.calls[1] ?? []) as [string, RequestInit & { headers: Record<string, string> }];
      expect(initMe.headers[CSRF_HEADER_NAME]).toBeUndefined();
    });
  });
});
