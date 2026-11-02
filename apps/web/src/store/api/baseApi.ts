import {
  fetchBaseQuery,
  type BaseQueryApi,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query';
import {
  CSRF_HEADER_NAME,
  CSRF_HEADER_VALUE,
} from '@/lib/api-client';

/**
 * Normalized API error payload returned by customBaseQuery.
 * Preserves original HTTP status, domain error code, human-readable message,
 * and optional server-provided details/validation errors.
 */
export interface ApiErrorPayload {
  status: number | string;
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Configuration options for the custom base query factory.
 */
export interface CustomBaseQueryOptions {
  baseUrl?: string;
  fetchFn?: typeof fetch;
  timeout?: number;
  reducerPath?: string;
}

export const DEFAULT_BFF_BASE_URL = '/api';

/**
 * Resolves the appropriate BFF base URL for same-origin browser or server-side/test environments.
 * - Browser environments (window !== undefined) ALWAYS use relative '/api' URLs to preserve same-origin cookie routing.
 * - Server-side production environments use NEXT_PUBLIC_APP_URL or APP_BASE_URL when configured.
 *   If unconfigured in production, it safely defaults to relative '/api' during static build evaluation
 *   while customBaseQuery guards against unsanctioned server-side requests to localhost.
 * - Development and testing environments fall back safely to 'http://localhost:3000/api'.
 *
 * NOTE: In HelloSmart.ai MMP architecture, RTK Query is designed and configured as a client-side
 * data fetching and caching layer operating within role store providers. Server-side prefetching
 * through RTK Query is not enabled in MMP; server components access backend endpoints via BFF helpers.
 */
export function resolveBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return DEFAULT_BFF_BASE_URL;
  }

  const configuredOrigin =
    process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL;

  if (configuredOrigin && configuredOrigin.trim().length > 0) {
    const trimmed = configuredOrigin.trim().replace(/\/$/, '');
    return `${trimmed}/api`;
  }

  if (process.env.NODE_ENV === 'production') {
    return DEFAULT_BFF_BASE_URL;
  }

  return 'http://localhost:3000/api';
}

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// ─────────────────────────────────────────────────────────────────────────────
// Error Normalization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalizes raw RTK Query / fetch errors into a uniform ApiErrorPayload.
 * Ensures consistent handling across 400, 401, 403, 404, 409, 422, 429, 500,
 * parsing, timeout, and network errors.
 */
export function normalizeApiError(
  error: FetchBaseQueryError | { status: string | number; error?: string; data?: unknown; originalStatus?: number },
  fallbackMessage = 'An unexpected error occurred.',
): ApiErrorPayload {
  const status = (error as { originalStatus?: number }).originalStatus ?? error.status;
  let code = typeof status === 'number' ? `HTTP_${status}` : String(status);
  let message = fallbackMessage;
  let details: unknown = undefined;

  if (typeof status === 'number') {
    switch (status) {
      case 400:
        code = 'BAD_REQUEST';
        message = 'Invalid request parameters.';
        break;
      case 401:
        code = 'UNAUTHORIZED';
        message = 'Session expired or unauthorized. Please log in.';
        break;
      case 403:
        code = 'FORBIDDEN';
        message = 'You do not have permission to perform this action.';
        break;
      case 404:
        code = 'NOT_FOUND';
        message = 'The requested resource was not found.';
        break;
      case 409:
        code = 'CONFLICT';
        message = 'A conflict occurred with existing data.';
        break;
      case 422:
        code = 'VALIDATION_ERROR';
        message = 'Validation failed for the submitted data.';
        break;
      case 429:
        code = 'RATE_LIMITED';
        message = 'Too many requests. Please slow down and try again later.';
        break;
      case 500:
      case 502:
      case 503:
      case 504:
        code = 'SERVER_ERROR';
        message = 'An unexpected server error occurred. Please try again later.';
        break;
    }
  }

  // Extract structured backend response fields if present
  const data = (error as { data?: unknown }).data;
  if (data && typeof data === 'object') {
    const errorObj = data as Record<string, unknown>;
    if (typeof errorObj.code === 'string' && errorObj.code.trim()) {
      code = errorObj.code;
    }
    if (typeof errorObj.detail === 'string' && errorObj.detail.trim()) {
      message = errorObj.detail;
    } else if (typeof errorObj.message === 'string' && errorObj.message.trim()) {
      message = errorObj.message;
    } else if (typeof errorObj.title === 'string' && errorObj.title.trim()) {
      message = errorObj.title;
    }

    if (errorObj.details !== undefined) {
      details = errorObj.details;
    } else if (errorObj.errors !== undefined) {
      details = errorObj.errors;
    }
  } else if (typeof data === 'string' && data.trim()) {
    message = data;
  } else if ('error' in error && typeof error.error === 'string') {
    if (status === 'FETCH_ERROR') {
      code = 'NETWORK_ERROR';
      message = 'Unable to connect to the server. Please check your network connection.';
    } else if (status === 'PARSING_ERROR') {
      code = 'PARSING_ERROR';
      message = 'Failed to parse response from server.';
    } else if (status === 'TIMEOUT_ERROR') {
      code = 'TIMEOUT_ERROR';
      message = 'Request timed out. Please try again.';
    } else {
      message = error.error;
    }
  }

  // Security sanitization: strip stack traces or file paths leaking in messages
  if (message.includes('at ') && (message.includes('.js:') || message.includes('.ts:'))) {
    message = 'An unexpected server error occurred.';
  }

  return { status, code, message, details };
}

// ─────────────────────────────────────────────────────────────────────────────
// 401 Unauthorized Centralized Integration Point (S1-T00-4)
// ─────────────────────────────────────────────────────────────────────────────

export type UnauthorizedHandler = (error: ApiErrorPayload, api: BaseQueryApi) => void;

const unauthorizedHandlers = new Set<UnauthorizedHandler>();
let lastUnauthorizedAt = 0;
export const DEFAULT_UNAUTHORIZED_DEDUPE_MS = 3000;

/**
 * Registers a listener for 401 Unauthorized responses.
 */
export function registerUnauthorizedHandler(handler: UnauthorizedHandler): () => void {
  unauthorizedHandlers.add(handler);
  return () => {
    unauthorizedHandlers.delete(handler);
  };
}

/**
 * Handles 401 Unauthorized responses:
 * 1. Resets the active RTK Query slice cache via api.dispatch({ type: `${api.reducerPath}/resetApiState` }).
 * 2. Deduplicates concurrent 401s within a 3000ms window to avoid cascading logout calls.
 * 3. Notifies registered handlers and emits 'hs:unauthorized' DOM event.
 * Returns true if notification fired, false if suppressed by deduplication.
 */
export function notifyUnauthorized(
  error: ApiErrorPayload,
  api: BaseQueryApi,
  reducerPath?: string,
  windowMs = DEFAULT_UNAUTHORIZED_DEDUPE_MS,
): boolean {
  // Always immediately reset the active API slice's cache if reducerPath is known
  const resolvedReducerPath = reducerPath || (api as { reducerPath?: string })?.reducerPath;
  if (typeof api?.dispatch === 'function' && resolvedReducerPath) {
    try {
      api.dispatch({ type: `${resolvedReducerPath}/resetApiState` });
    } catch (err) {
      console.error('[baseApi] Failed to resetApiState on 401:', err);
    }
  }

  const now = Date.now();
  if (now - lastUnauthorizedAt < windowMs) {
    return false; // Suppress duplicate notifications within window
  }
  lastUnauthorizedAt = now;

  unauthorizedHandlers.forEach((handler) => {
    try {
      handler(error, api);
    } catch (err) {
      console.error('[baseApi] Error in unauthorized handler:', err);
    }
  });

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(
      new CustomEvent('hs:unauthorized', {
        detail: { error, endpoint: api?.endpoint },
      }),
    );
  }

  return true;
}

export function resetUnauthorizedDeduplication(): void {
  lastUnauthorizedAt = 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// 429 Rate Limit Centralized Notification & Deduplication
// ─────────────────────────────────────────────────────────────────────────────

export type RateLimitHandler = (message: string, targetKey: string) => void;

const rateLimitHandlers = new Set<RateLimitHandler>();
const rateLimitNotificationLog = new Map<string, number>();
const DEFAULT_RATE_LIMIT_DEDUPE_MS = 5000;

/**
 * Registers a listener for rate-limit notifications.
 */
export function registerRateLimitHandler(handler: RateLimitHandler): () => void {
  rateLimitHandlers.add(handler);
  return () => {
    rateLimitHandlers.delete(handler);
  };
}

/**
 * Notifies registered listeners and emits a DOM event for HTTP 429 with deduplication.
 * Returns true if notification was fired, false if suppressed by deduplication.
 */
export function notifyRateLimit(
  message = 'Too many requests. Please slow down and try again later.',
  targetKey = 'global',
  windowMs = DEFAULT_RATE_LIMIT_DEDUPE_MS,
): boolean {
  const now = Date.now();
  const lastNotified = rateLimitNotificationLog.get(targetKey) || 0;

  if (now - lastNotified < windowMs) {
    return false; // Suppress duplicate within window
  }

  rateLimitNotificationLog.set(targetKey, now);

  rateLimitHandlers.forEach((handler) => {
    try {
      handler(message, targetKey);
    } catch (err) {
      console.error('[baseApi] Error in rate limit handler:', err);
    }
  });

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(
      new CustomEvent('hs:rate-limited', {
        detail: { message, targetKey },
      }),
    );
  }

  return true;
}

export function resetRateLimitDeduplication(): void {
  rateLimitNotificationLog.clear();
}

// ─────────────────────────────────────────────────────────────────────────────
// Base Query Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates an RTK Query base query function wrapping fetchBaseQuery with:
 * 1. Same-origin BFF base URL routing.
 * 2. Automatic credentials: 'include' (HttpOnly hs_session cookie).
 * 3. CSRF protection (X-HS-CSRF: 1 on POST, PUT, PATCH, DELETE only).
 * 4. FormData / multipart preservation without forcing application/json.
 * 5. Centralized status handling (401 notification hook, 429 deduplication, 404 normalization).
 */
export function createCustomBaseQuery(
  options: CustomBaseQueryOptions = {},
): BaseQueryFn<string | FetchArgs, unknown, ApiErrorPayload> {
  const baseUrl = options.baseUrl ?? resolveBaseUrl();

  const fetchBaseQueryArgs: Parameters<typeof fetchBaseQuery>[0] = {
    baseUrl,
    credentials: 'include',
    prepareHeaders: (headers, { arg }) => {
      const method = (
        typeof arg === 'string' ? 'GET' : (arg.method || 'GET')
      ).toUpperCase();

      // Enforce CSRF header only on state-changing requests
      if (STATE_CHANGING_METHODS.has(method)) {
        headers.set(CSRF_HEADER_NAME, CSRF_HEADER_VALUE);
      }

      // If FormData is provided, do NOT set Content-Type header.
      // The browser/fetch engine will automatically set multipart/form-data with boundary.
      const isFormData =
        typeof arg === 'object' &&
        arg !== null &&
        typeof FormData !== 'undefined' &&
        arg.body instanceof FormData;

      if (isFormData) {
        headers.delete('content-type');
        headers.delete('Content-Type');
      }

      return headers;
    },
  };

  if (options.fetchFn !== undefined) {
    fetchBaseQueryArgs.fetchFn = options.fetchFn;
  }
  if (options.timeout !== undefined) {
    fetchBaseQueryArgs.timeout = options.timeout;
  }

  const rawBaseQuery = fetchBaseQuery(fetchBaseQueryArgs);

  return async (args, api, extraOptions) => {
    // In production SSR, ensure requests cannot accidentally be sent to an unconfigured localhost origin
    if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
      const configuredOrigin =
        process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL;
      if (!configuredOrigin && !options.baseUrl) {
        return {
          error: {
            status: 500,
            code: 'MISSING_APP_ORIGIN',
            message:
              'Production server-side API execution requires NEXT_PUBLIC_APP_URL or APP_BASE_URL. ' +
              'Note: RTK Query in HelloSmart.ai is designed for client-side state within role store providers.',
          },
        };
      }
    }

    const result = await rawBaseQuery(args, api, extraOptions);

    if (result.error) {
      const normalizedError = normalizeApiError(result.error);
      const targetKey = typeof args === 'string' ? args : args.url;

      if (normalizedError.status === 401) {
        notifyUnauthorized(normalizedError, api, options.reducerPath);
      } else if (normalizedError.status === 429) {
        notifyRateLimit(normalizedError.message, targetKey);
      }

      return { error: normalizedError };
    }

    return { data: result.data };
  };
}
