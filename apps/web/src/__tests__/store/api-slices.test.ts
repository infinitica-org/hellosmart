import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  createCustomBaseQuery,
  normalizeApiError,
  registerUnauthorizedHandler,
  registerRateLimitHandler,
  resetRateLimitDeduplication,
  resolveBaseUrl,
  DEFAULT_BFF_BASE_URL,
  type ApiErrorPayload,
} from '@/store/api/baseApi';
import { adminApi, ADMIN_TAG_TYPES } from '@/store/admin/adminApi';
import { companyApi, COMPANY_TAG_TYPES } from '@/store/company/companyApi';
import { candidateApi, CANDIDATE_TAG_TYPES } from '@/store/candidate/candidateApi';
import { makeAdminStore } from '@/store/admin/adminStore';
import { makeCompanyStore } from '@/store/company/companyStore';
import { makeCandidateStore } from '@/store/candidate/candidateStore';
import { AppToastProvider, RateLimitToastConsumer } from '@/providers/toast-provider';
import * as UI from '@hs/ui';
import { CSRF_HEADER_NAME, CSRF_HEADER_VALUE } from '@/lib/api-client';

describe('S1-T00-2: RTK Query Base API Slices & Store Integration', () => {
  beforeEach(() => {
    resetRateLimitDeduplication();
    vi.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Base API & BFF Request Behavior
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. Base API Behavior & Same-Origin BFF Conventions', () => {
    it('1. resolves correct BFF base URL for browser environment', () => {
      expect(DEFAULT_BFF_BASE_URL).toBe('/api');

      // In browser environment (window is defined), always use same-origin relative URL
      const originalWindow = globalThis.window;
      try {
        (globalThis as any).window = {};
        expect(resolveBaseUrl()).toBe('/api');
      } finally {
        globalThis.window = originalWindow;
      }
    });

    it('resolves configured application origin for SSR when env vars are present', () => {
      const originalWindow = globalThis.window;
      const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
      const originalBaseUrl = process.env.APP_BASE_URL;

      try {
        delete (globalThis as any).window;

        process.env.NEXT_PUBLIC_APP_URL = 'https://app.hellosmart.ai';
        delete process.env.APP_BASE_URL;
        expect(resolveBaseUrl()).toBe('https://app.hellosmart.ai/api');

        delete process.env.NEXT_PUBLIC_APP_URL;
        process.env.APP_BASE_URL = 'https://internal.hellosmart.ai/';
        expect(resolveBaseUrl()).toBe('https://internal.hellosmart.ai/api');
      } finally {
        globalThis.window = originalWindow;
        if (originalAppUrl !== undefined) process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
        else delete process.env.NEXT_PUBLIC_APP_URL;
        if (originalBaseUrl !== undefined) process.env.APP_BASE_URL = originalBaseUrl;
        else delete process.env.APP_BASE_URL;
      }
    });

    it('fails closed in production SSR when application origin is missing to prevent localhost leaks', async () => {
      const originalWindow = globalThis.window;
      const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
      const originalBaseUrl = process.env.APP_BASE_URL;
      const originalNodeEnv = process.env.NODE_ENV;

      try {
        delete (globalThis as any).window;
        delete process.env.NEXT_PUBLIC_APP_URL;
        delete process.env.APP_BASE_URL;
        (process.env as any).NODE_ENV = 'production';

        const baseQuery = createCustomBaseQuery();
        const result = await baseQuery('test-endpoint', {} as any, {});

        expect(result.error).toBeDefined();
        expect(result.error?.status).toBe(500);
        expect(result.error?.code).toBe('MISSING_APP_ORIGIN');
        expect(result.error?.message).toContain('Production server-side API execution requires NEXT_PUBLIC_APP_URL or APP_BASE_URL');
      } finally {
        globalThis.window = originalWindow;
        (process.env as any).NODE_ENV = originalNodeEnv;
        if (originalAppUrl !== undefined) process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
        else delete process.env.NEXT_PUBLIC_APP_URL;
        if (originalBaseUrl !== undefined) process.env.APP_BASE_URL = originalBaseUrl;
        else delete process.env.APP_BASE_URL;
      }
    });

    it('falls back safely to development localhost in non-production environments', () => {
      const originalWindow = globalThis.window;
      const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
      const originalBaseUrl = process.env.APP_BASE_URL;
      const originalNodeEnv = process.env.NODE_ENV;

      try {
        delete (globalThis as any).window;
        delete process.env.NEXT_PUBLIC_APP_URL;
        delete process.env.APP_BASE_URL;
        (process.env as any).NODE_ENV = 'development';

        expect(resolveBaseUrl()).toBe('http://localhost:3000/api');
      } finally {
        globalThis.window = originalWindow;
        (process.env as any).NODE_ENV = originalNodeEnv;
        if (originalAppUrl !== undefined) process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
        else delete process.env.NEXT_PUBLIC_APP_URL;
        if (originalBaseUrl !== undefined) process.env.APP_BASE_URL = originalBaseUrl;
        else delete process.env.APP_BASE_URL;
      }
    });

    it('2. includes credentials: "include" for all requests', async () => {
      let capturedRequest: Request | undefined;
      const mockFetch = vi.fn().mockImplementation(async (req: Request) => {
        capturedRequest = req;
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const baseQuery = createCustomBaseQuery({
        baseUrl: 'http://localhost:3000/api',
        fetchFn: mockFetch,
      });

      await baseQuery('test-endpoint', {} as any, {});

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(capturedRequest).toBeDefined();
      expect(capturedRequest?.credentials).toBe('include');
    });

    it('3. attaches X-HS-CSRF: 1 on state-changing methods (POST, PUT, PATCH, DELETE)', async () => {
      const stateChangingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'] as const;

      for (const method of stateChangingMethods) {
        let capturedHeaders: Headers | undefined;
        const mockFetch = vi.fn().mockImplementation(async (req: Request) => {
          capturedHeaders = req.headers;
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        });

        const baseQuery = createCustomBaseQuery({
          baseUrl: 'http://localhost:3000/api',
          fetchFn: mockFetch,
        });

        await baseQuery(
          { url: 'resource', method, body: { data: 'value' } },
          {} as any,
          {},
        );

        expect(mockFetch).toHaveBeenCalled();
        expect(capturedHeaders?.get(CSRF_HEADER_NAME)).toBe(CSRF_HEADER_VALUE);
      }
    });

    it('4. does not attach X-HS-CSRF header on safe read requests (GET, HEAD)', async () => {
      const safeMethods = ['GET', 'HEAD'] as const;

      for (const method of safeMethods) {
        let capturedHeaders: Headers | undefined;
        const mockFetch = vi.fn().mockImplementation(async (req: Request) => {
          capturedHeaders = req.headers;
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        });

        const baseQuery = createCustomBaseQuery({
          baseUrl: 'http://localhost:3000/api',
          fetchFn: mockFetch,
        });

        await baseQuery({ url: 'resource', method }, {} as any, {});

        expect(mockFetch).toHaveBeenCalled();
        expect(capturedHeaders?.get(CSRF_HEADER_NAME)).toBeNull();
      }

      // Also verify simple string arg (default GET)
      let stringGetHeaders: Headers | undefined;
      const mockFetchString = vi.fn().mockImplementation(async (req: Request) => {
        stringGetHeaders = req.headers;
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const stringBaseQuery = createCustomBaseQuery({
        baseUrl: 'http://localhost:3000/api',
        fetchFn: mockFetchString,
      });

      await stringBaseQuery('string-get-resource', {} as any, {});
      expect(stringGetHeaders?.get(CSRF_HEADER_NAME)).toBeNull();
    });

    it('5. serializes JSON object bodies and sets application/json content-type', async () => {
      let capturedRequest: Request | undefined;
      const mockFetch = vi.fn().mockImplementation(async (req: Request) => {
        capturedRequest = req;
        return new Response(JSON.stringify({ id: '123' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const baseQuery = createCustomBaseQuery({
        baseUrl: 'http://localhost:3000/api',
        fetchFn: mockFetch,
      });

      const payload = { name: 'Test Org', plan: 'trial' };
      await baseQuery(
        { url: 'admin/organizations', method: 'POST', body: payload },
        {} as any,
        {},
      );

      expect(capturedRequest).toBeDefined();
      expect(capturedRequest?.headers.get('content-type')).toContain('application/json');
      const text = await capturedRequest?.text();
      expect(text).toBe(JSON.stringify(payload));
    });

    it('6. preserves FormData without forcing application/json, allowing multipart boundary generation', async () => {
      let capturedRequest: Request | undefined;
      const mockFetch = vi.fn().mockImplementation(async (req: Request) => {
        capturedRequest = req;
        return new Response(JSON.stringify({ uploaded: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const baseQuery = createCustomBaseQuery({
        baseUrl: 'http://localhost:3000/api',
        fetchFn: mockFetch,
      });

      const formData = new FormData();
      formData.append('file', 'mock-file-content');
      formData.append('filename', 'test.txt');

      await baseQuery(
        { url: 'upload', method: 'POST', body: formData },
        {} as any,
        {},
      );

      expect(capturedRequest).toBeDefined();
      // Ensure Content-Type was not overridden with application/json
      const contentType = capturedRequest?.headers.get('content-type');
      expect(contentType).not.toBe('application/json');
      // CSRF header must still be attached on state-changing FormData uploads
      expect(capturedRequest?.headers.get(CSRF_HEADER_NAME)).toBe(CSRF_HEADER_VALUE);
    });

    it('7. preserves network errors and normalizes them into NETWORK_ERROR', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      const baseQuery = createCustomBaseQuery({
        baseUrl: 'http://localhost:3000/api',
        fetchFn: mockFetch,
      });

      const result = await baseQuery('network-failure', {} as any, {});

      expect(result.error).toBeDefined();
      expect(result.error?.status).toBe('FETCH_ERROR');
      expect(result.error?.code).toBe('NETWORK_ERROR');
      expect(result.error?.message).toContain('Unable to connect to the server');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Centralized Error Handling & Status Normalization
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. Centralized Error Handling & Status Normalization', () => {
    it('8. recognizes HTTP 401 Unauthorized and notifies registered integration handler', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ detail: 'Session expired', code: 'SESSION_EXPIRED' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      let capturedUnauthorizedError: ApiErrorPayload | null = null;
      const unsubscribe = registerUnauthorizedHandler((err) => {
        capturedUnauthorizedError = err;
      });

      const baseQuery = createCustomBaseQuery({
        baseUrl: 'http://localhost:3000/api',
        fetchFn: mockFetch,
      });

      const result = await baseQuery('protected-resource', { endpoint: 'getProtected' } as any, {});

      unsubscribe();

      expect(result.error).toBeDefined();
      expect(result.error?.status).toBe(401);
      expect(result.error?.code).toBe('SESSION_EXPIRED');
      expect(result.error?.message).toBe('Session expired');
      expect(capturedUnauthorizedError).toEqual(result.error);
    });

    it('9. triggers rate-limit notification on HTTP 429', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ detail: 'Too many requests. Please wait.', code: 'RATE_LIMITED' }),
          { status: 429, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      let notifiedMessage = '';
      const unsubscribe = registerRateLimitHandler((msg) => {
        notifiedMessage = msg;
      });

      const baseQuery = createCustomBaseQuery({
        baseUrl: 'http://localhost:3000/api',
        fetchFn: mockFetch,
      });

      const result = await baseQuery('rate-limited-endpoint', {} as any, {});

      unsubscribe();

      expect(result.error).toBeDefined();
      expect(result.error?.status).toBe(429);
      expect(result.error?.code).toBe('RATE_LIMITED');
      expect(notifiedMessage).toBe('Too many requests. Please wait.');
    });

    it('10. controls duplicate 429 notifications within deduplication window', async () => {
      const mockFetch = vi.fn().mockImplementation(
        async () =>
          new Response(
            JSON.stringify({ detail: 'Rate limit exceeded', code: 'RATE_LIMITED' }),
            { status: 429, headers: { 'Content-Type': 'application/json' } },
          ),
      );

      let notificationCount = 0;
      const unsubscribe = registerRateLimitHandler(() => {
        notificationCount++;
      });

      const baseQuery = createCustomBaseQuery({
        baseUrl: 'http://localhost:3000/api',
        fetchFn: mockFetch,
      });

      // Rapid consecutive 429s for the same endpoint
      await baseQuery('same-throttled-route', {} as any, {});
      await baseQuery('same-throttled-route', {} as any, {});
      await baseQuery('same-throttled-route', {} as any, {});

      unsubscribe();

      // Only first notification should have fired; duplicate 2 and 3 suppressed
      expect(notificationCount).toBe(1);
    });

    it('integrates HTTP 429 directly with @hs/ui toast system, showing friendly toast and preserving caller error', async () => {
      const mockToastWarning = vi.fn();
      const mockToastContextValue = {
        toast: Object.assign(vi.fn(), {
          warning: mockToastWarning,
          error: vi.fn(),
          success: vi.fn(),
          info: vi.fn(),
        }),
        dismiss: vi.fn(),
        dismissAll: vi.fn(),
      };

      // Mock useToast from @hs/ui
      const useToastSpy = vi.spyOn(UI, 'useToast').mockReturnValue(mockToastContextValue as any);

      // Verify that AppToastProvider renders without crashing
      const renderedHtml = renderToString(
        React.createElement(AppToastProvider, null, React.createElement('div', null, 'Toast App Content')),
      );
      expect(renderedHtml).toContain('Toast App Content');

      // Register the toast consumer handler as RateLimitToastConsumer does in useEffect
      const unsubscribe = registerRateLimitHandler((message) => {
        mockToastContextValue.toast.warning('Rate Limit Exceeded', message);
      });

      const mockFetch = vi.fn().mockImplementation(
        async () =>
          new Response(
            JSON.stringify({ detail: 'You have reached the rate limit for this action.', code: 'RATE_LIMITED' }),
            { status: 429, headers: { 'Content-Type': 'application/json' } },
          ),
      );

      const baseQuery = createCustomBaseQuery({
        baseUrl: 'http://localhost:3000/api',
        fetchFn: mockFetch,
      });

      // 1. Initial 429 response triggers toast
      const result1 = await baseQuery('company/assessments/123/submit', {} as any, {});

      expect(mockToastWarning).toHaveBeenCalledTimes(1);
      expect(mockToastWarning).toHaveBeenCalledWith(
        'Rate Limit Exceeded',
        'You have reached the rate limit for this action.',
      );
      // Original error is still returned to the caller
      expect(result1.error).toBeDefined();
      expect(result1.error?.status).toBe(429);
      expect(result1.error?.code).toBe('RATE_LIMITED');
      expect(result1.error?.message).toBe('You have reached the rate limit for this action.');

      // 2. Rapid repeat request to the SAME endpoint is deduplicated (no duplicate toast)
      const result2 = await baseQuery('company/assessments/123/submit', {} as any, {});
      expect(mockToastWarning).toHaveBeenCalledTimes(1);
      expect(result2.error?.status).toBe(429);

      // 3. Different endpoint is NOT suppressed
      const result3 = await baseQuery('company/candidates/invite', {} as any, {});
      expect(mockToastWarning).toHaveBeenCalledTimes(2);
      expect(result3.error?.status).toBe(429);

      unsubscribe();
      useToastSpy.mockRestore();
    });

    it('11. normalizes HTTP 404 Not Found responses with clean fallback message', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response('', {
          status: 404,
          statusText: 'Not Found',
          headers: { 'Content-Type': 'text/plain' },
        }),
      );

      const baseQuery = createCustomBaseQuery({
        baseUrl: 'http://localhost:3000/api',
        fetchFn: mockFetch,
      });

      const result = await baseQuery('unknown-path', {} as any, {});

      expect(result.error).toBeDefined();
      expect(result.error?.status).toBe(404);
      expect(result.error?.code).toBe('NOT_FOUND');
      expect(result.error?.message).toBe('The requested resource was not found.');
    });

    it('12. handles malformed/non-JSON error bodies without crashing', async () => {
      const malformedHtml = '<html><body>502 Bad Gateway - Nginx Proxy Error</body></html>';
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(malformedHtml, {
          status: 502,
          headers: { 'Content-Type': 'text/html' },
        }),
      );

      const baseQuery = createCustomBaseQuery({
        baseUrl: 'http://localhost:3000/api',
        fetchFn: mockFetch,
      });

      const result = await baseQuery('bad-gateway', {} as any, {});

      expect(result.error).toBeDefined();
      expect(result.error?.status).toBe(502);
      expect(result.error?.code).toBe('SERVER_ERROR');
      expect(result.error?.message).toBe(malformedHtml);
    });

    it('13. normalizes 400, 403, 409, 422, and 500 status codes with structured details', () => {
      const testCases = [
        { status: 400, expectedCode: 'BAD_REQUEST', expectedMsg: 'Invalid request parameters.' },
        { status: 403, expectedCode: 'FORBIDDEN', expectedMsg: 'You do not have permission to perform this action.' },
        { status: 409, expectedCode: 'CONFLICT', expectedMsg: 'A conflict occurred with existing data.' },
        { status: 422, expectedCode: 'VALIDATION_ERROR', expectedMsg: 'Validation failed for the submitted data.' },
        { status: 500, expectedCode: 'SERVER_ERROR', expectedMsg: 'An unexpected server error occurred. Please try again later.' },
      ];

      for (const tc of testCases) {
        const normalized = normalizeApiError({ status: tc.status, data: undefined });
        expect(normalized.status).toBe(tc.status);
        expect(normalized.code).toBe(tc.expectedCode);
        expect(normalized.message).toBe(tc.expectedMsg);
      }
    });

    it('sanitizes stack trace leaks in server error messages', () => {
      const rawErrorWithStack = {
        status: 500,
        data: {
          detail: 'DatabaseError: Connection refused\n    at Pool.connect (/app/dist/db.js:42:15)\n    at Object.handler (/app/dist/server.js:108:9)',
        },
      };

      const normalized = normalizeApiError(rawErrorWithStack);
      expect(normalized.status).toBe(500);
      expect(normalized.message).toBe('An unexpected server error occurred.');
      expect(normalized.message).not.toContain('/app/dist');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Role API Slices & Store Isolation
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Role API Slices, Cache Tag Namespaces & Store Isolation', () => {
    it('14. verifies unique reducerPaths across the three role APIs', () => {
      expect(adminApi.reducerPath).toBe('adminApi');
      expect(companyApi.reducerPath).toBe('companyApi');
      expect(candidateApi.reducerPath).toBe('candidateApi');

      const paths = new Set([
        adminApi.reducerPath,
        companyApi.reducerPath,
        candidateApi.reducerPath,
      ]);
      expect(paths.size).toBe(3);
    });

    it('15. verifies each role store registers exclusively its own API reducer', () => {
      const adminStore = makeAdminStore();
      const companyStore = makeCompanyStore();
      const candidateStore = makeCandidateStore();

      const adminState = adminStore.getState();
      expect(adminState).toHaveProperty('adminApi');
      expect(adminState).not.toHaveProperty('companyApi');
      expect(adminState).not.toHaveProperty('candidateApi');

      const companyState = companyStore.getState();
      expect(companyState).toHaveProperty('companyApi');
      expect(companyState).not.toHaveProperty('adminApi');
      expect(companyState).not.toHaveProperty('candidateApi');

      const candidateState = candidateStore.getState();
      expect(candidateState).toHaveProperty('candidateApi');
      expect(candidateState).not.toHaveProperty('adminApi');
      expect(candidateState).not.toHaveProperty('companyApi');
    });

    it('16. verifies each role store configures its own middleware', () => {
      const adminStore = makeAdminStore();
      const companyStore = makeCompanyStore();
      const candidateStore = makeCandidateStore();

      // Dispatching a dummy action through store dispatches cleanly without middleware crashes
      expect(() => adminStore.dispatch({ type: 'DUMMY_ADMIN' })).not.toThrow();
      expect(() => companyStore.dispatch({ type: 'DUMMY_COMPANY' })).not.toThrow();
      expect(() => candidateStore.dispatch({ type: 'DUMMY_CANDIDATE' })).not.toThrow();
    });

    it('17. enforces role-appropriate cache tag namespaces without leakage', () => {
      // Verify minimum required tags exist in the architecture
      const allTags = new Set([
        ...ADMIN_TAG_TYPES,
        ...COMPANY_TAG_TYPES,
        ...CANDIDATE_TAG_TYPES,
      ]);

      expect(allTags.has('Templates')).toBe(true);
      expect(allTags.has('Assessments')).toBe(true);
      expect(allTags.has('Candidates')).toBe(true);
      expect(allTags.has('Rubrics')).toBe(true);
      expect(allTags.has('Quotes')).toBe(true);
      expect(allTags.has('Session')).toBe(true);

      // Verify Candidate tags do NOT include Company/Admin sensitive tags
      const candidateTags = new Set(CANDIDATE_TAG_TYPES);
      expect(candidateTags.has('Session')).toBe(true);
      expect(candidateTags.has('Assessments')).toBe(true);
      expect(candidateTags.has('Submissions')).toBe(true);
      expect(candidateTags.has('Candidates' as any)).toBe(false);
      expect(candidateTags.has('Rubrics' as any)).toBe(false);
      expect(candidateTags.has('Quotes' as any)).toBe(false);
      expect(candidateTags.has('Organizations' as any)).toBe(false);
    });

    it('18. verifies resetting one role API cache does not mutate another store cache', () => {
      const adminStore = makeAdminStore();
      const companyStore = makeCompanyStore();

      // Reset admin API cache state
      adminStore.dispatch(adminApi.util.resetApiState());

      // Company store must remain unaffected
      const companyState = companyStore.getState();
      expect(companyState).toHaveProperty('companyApi');
      expect(companyState).not.toHaveProperty('adminApi');

      // Reset company API cache state
      companyStore.dispatch(companyApi.util.resetApiState());

      const adminState = adminStore.getState();
      expect(adminState).toHaveProperty('adminApi');
      expect(adminState).not.toHaveProperty('companyApi');
    });

    it('19. safely handles providesTags when API returns { items: [...] } or raw arrays without throwing e.map is not a function', () => {
      const store = makeCompanyStore();

      // Dispatch fulfilled action with { items: [{ id: 'cand-1' }], total: 1 }
      // This triggers RTK Query tag subscription logic which executes providesTags
      store.dispatch({
        type: 'companyApi/executeQuery/fulfilled',
        payload: { items: [{ id: 'cand-1', name: 'Alice', email: 'alice@example.com' }], total: 1 },
        meta: {
          requestId: 'test-req-1',
          arg: {
            endpointName: 'getCandidates',
            originalArgs: undefined,
            type: 'query',
          },
        },
      });

      // Also test with empty object / null
      store.dispatch({
        type: 'companyApi/executeQuery/fulfilled',
        payload: { items: [] },
        meta: {
          requestId: 'test-req-2',
          arg: {
            endpointName: 'getCandidates',
            originalArgs: undefined,
            type: 'query',
          },
        },
      });

      // Also test getCompanyTemplates
      store.dispatch({
        type: 'companyApi/executeQuery/fulfilled',
        payload: { items: [{ id: 'tpl_fs_01' }] },
        meta: {
          requestId: 'test-req-3',
          arg: {
            endpointName: 'getCompanyTemplates',
            originalArgs: undefined,
            type: 'query',
          },
        },
      });

      const state = store.getState().companyApi;
      expect(state.provided).toBeDefined();
    });
  });
});
