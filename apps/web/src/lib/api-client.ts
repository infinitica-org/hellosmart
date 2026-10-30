import type {
  AcceptInvitationRequest,
  AcceptInvitationResponse,
  ActiveSession,
  ActiveSessionsResponse,
  ChangePasswordRequest,
  InvitationDetailsResponse,
  SimpleSuccessResponse,
} from '@hs/contracts';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class InvitationInvalidError extends ApiError {
  constructor(message = 'This link is no longer valid. Please ask your admin to resend the invite.') {
    super(404, 'INVITATION_INVALID', message);
    this.name = 'InvitationInvalidError';
  }
}

export class WeakPasswordError extends ApiError {
  constructor(detail = 'Password does not meet complexity requirements.') {
    super(422, 'WEAK_PASSWORD', detail);
    this.name = 'WeakPasswordError';
  }
}

export class RateLimitedError extends ApiError {
  constructor(message = 'Too many attempts. Please try again later.') {
    super(429, 'RATE_LIMITED', message);
    this.name = 'RateLimitedError';
  }
}

export const CSRF_HEADER_NAME = 'X-HS-CSRF';
export const CSRF_HEADER_VALUE = '1';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Returns CSRF header object if the method is state-changing (POST, PUT, PATCH, DELETE).
 */
export function getCsrfHeaders(method?: string): Record<string, string> {
  if (method && STATE_CHANGING_METHODS.has(method.toUpperCase())) {
    return { [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE };
  }
  return {};
}

/**
 * Attaches the CSRF header to a HeadersInit object for state-changing HTTP methods.
 */
export function attachCsrfHeader(headers: HeadersInit = {}, method?: string): Headers {
  const h = new Headers(headers);
  if (method && STATE_CHANGING_METHODS.has(method.toUpperCase())) {
    h.set(CSRF_HEADER_NAME, CSRF_HEADER_VALUE);
  }
  return h;
}

/**
 * Shared fetch wrapper that attaches X-HS-CSRF on browser state-changing requests
 * and ensures credentials: 'include'.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  fetchFn: typeof fetch = fetch,
): Promise<Response> {
  const method = (init.method || 'GET').toUpperCase();
  const headers = new Headers(init.headers || {});
  if (STATE_CHANGING_METHODS.has(method)) {
    headers.set(CSRF_HEADER_NAME, CSRF_HEADER_VALUE);
  }
  return fetchFn(input, {
    ...init,
    headers,
    credentials: init.credentials || 'include',
  });
}

export interface UserMe {
  id: string;
  email: string;
  name: string;
  role: 'platform_admin' | 'company_admin' | 'candidate';
  portal: 'admin' | 'company' | 'candidate';
  mustResetPassword: boolean;
  org: {
    id: string;
    name: string;
    logoUrl?: string | null;
  } | null;
}

export function getApiBaseUrl(): string {
  const raw =
    typeof window !== 'undefined'
      ? process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
      : process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const trimmed = raw.replace(/\/$/, '');
  return trimmed.endsWith('/api/v1') ? trimmed : `${trimmed}/api/v1`;
}

/**
 * Browser calls go through the Next.js BFF so HttpOnly hs_session (on :3000) is forwarded to the API.
 */
export function resolveBrowserAuthUrl(apiV1Path: string): string {
  if (typeof window === 'undefined') {
    const base = getApiBaseUrl();
    return `${base}${apiV1Path.startsWith('/') ? apiV1Path : `/${apiV1Path}`}`;
  }

  const path = apiV1Path.startsWith('/') ? apiV1Path : `/${apiV1Path}`;

  if (path === '/me') {
    return '/api/auth/me';
  }
  if (path === '/auth/logout') {
    return '/api/auth/logout';
  }
  if (path === '/auth/sessions') {
    return '/api/auth/sessions';
  }
  if (path === '/auth/logout-all') {
    return '/api/auth/logout-all';
  }
  if (path === '/auth/password/change') {
    return '/api/auth/password/change';
  }
  if (path === '/auth/invitations/accept') {
    return '/api/auth/invitations/accept';
  }
  const invitationTokenMatch = /^\/auth\/invitations\/([^/]+)$/.exec(path);
  if (invitationTokenMatch?.[1]) {
    return `/api/auth/invitations/${encodeURIComponent(invitationTokenMatch[1])}`;
  }
  if (path.startsWith('/auth/mfa/')) {
    return `/api/auth${path.slice('/auth'.length)}`;
  }
  const sessionRevokeMatch = /^\/auth\/sessions\/([^/]+)$/.exec(path);
  if (sessionRevokeMatch?.[1]) {
    return `/api/auth/sessions/${encodeURIComponent(sessionRevokeMatch[1])}`;
  }

  return `${getApiBaseUrl()}${path}`;
}

/**
 * Validates an invitation token via GET /api/v1/auth/invitations/:token.
 * Throws InvitationInvalidError if token is unknown, expired, or already used.
 */
export async function validateInvitation(
  token: string,
  fetchFn: typeof fetch = fetch,
): Promise<InvitationDetailsResponse> {
  const url = resolveBrowserAuthUrl(`/auth/invitations/${encodeURIComponent(token)}`);

  const res = await fetchFn(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    credentials: 'include',
  });

  if (res.status === 404) {
    throw new InvitationInvalidError();
  }

  if (res.status === 429) {
    throw new RateLimitedError();
  }

  if (!res.ok) {
    let errorDetail = 'Failed to validate invitation';
    try {
      const errorJson = await res.json();
      errorDetail = errorJson.detail || errorDetail;
    } catch {
      // ignore JSON parse error
    }
    throw new ApiError(res.status, 'API_ERROR', errorDetail);
  }

  return (await res.json()) as InvitationDetailsResponse;
}

/**
 * Consumes an invitation token and sets user password via POST /api/v1/auth/invitations/accept.
 */
export async function acceptInvitation(
  data: AcceptInvitationRequest,
  fetchFn: typeof fetch = fetch,
): Promise<AcceptInvitationResponse> {
  const url = resolveBrowserAuthUrl('/auth/invitations/accept');

  const res = await fetchFn(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE,
    },
    body: JSON.stringify(data),
    credentials: 'include',
  });

  if (res.status === 404) {
    throw new InvitationInvalidError();
  }

  if (res.status === 422) {
    let detail = 'Password does not meet complexity requirements.';
    try {
      const errorJson = await res.json();
      detail = errorJson.detail || detail;
    } catch {
      // ignore
    }
    throw new WeakPasswordError(detail);
  }

  if (res.status === 429) {
    throw new RateLimitedError();
  }

  if (!res.ok) {
    let errorDetail = 'Failed to accept invitation';
    try {
      const errorJson = await res.json();
      errorDetail = errorJson.detail || errorDetail;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, 'API_ERROR', errorDetail);
  }

  return (await res.json()) as AcceptInvitationResponse;
}

/**
 * Authenticates user via the Next.js BFF in the browser (same-origin cookies),
 * or POST /api/v1/auth/login on the server.
 */
export async function login(
  credentials: { email: string; password: string; mfaCode?: string },
  fetchFn: typeof fetch = fetch,
): Promise<UserMe> {
  const url =
    typeof window !== 'undefined'
      ? '/api/auth/login'
      : `${getApiBaseUrl()}/auth/login`;

  const res = await fetchFn(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE,
    },
    body: JSON.stringify(credentials),
    credentials: 'include',
  });

  if (res.status === 401) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password, or account not found.');
  }

  if (res.status === 429) {
    throw new RateLimitedError();
  }

  if (!res.ok) {
    let errorDetail = 'Login failed';
    try {
      const errorJson = await res.json();
      errorDetail = errorJson.detail || errorDetail;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, 'API_ERROR', errorDetail);
  }

  return (await res.json()) as UserMe;
}

/**
 * Logs out the current user and invalidates session via POST /api/v1/auth/logout.
 */
export async function logout(
  fetchFn: typeof fetch = fetch,
): Promise<SimpleSuccessResponse> {
  const url = resolveBrowserAuthUrl('/auth/logout');

  const res = await fetchFn(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE,
    },
    credentials: 'include',
  });

  if (!res.ok) {
    let errorDetail = 'Logout failed';
    try {
      const errorJson = await res.json();
      errorDetail = errorJson.detail || errorDetail;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, 'API_ERROR', errorDetail);
  }

  return (await res.json()) as SimpleSuccessResponse;
}

/**
 * Lists all active sessions for current user via GET /api/v1/auth/sessions.
 */
export async function listSessions(
  fetchFn: typeof fetch = fetch,
): Promise<ActiveSessionsResponse> {
  const url = resolveBrowserAuthUrl('/auth/sessions');

  const res = await fetchFn(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    credentials: 'include',
  });

  if (res.status === 401) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
  }

  if (!res.ok) {
    let errorDetail = 'Failed to fetch active sessions';
    try {
      const errorJson = await res.json();
      errorDetail = errorJson.detail || errorDetail;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, 'API_ERROR', errorDetail);
  }

  return (await res.json()) as ActiveSessionsResponse;
}

/**
 * Revokes a specific active session via DELETE /api/v1/auth/sessions/:id.
 */
export async function revokeSession(
  sessionId: string,
  fetchFn: typeof fetch = fetch,
): Promise<SimpleSuccessResponse> {
  const url = resolveBrowserAuthUrl(`/auth/sessions/${encodeURIComponent(sessionId)}`);

  const res = await fetchFn(url, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
    },
    credentials: 'include',
  });

  if (res.status === 401) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
  }

  if (!res.ok) {
    let errorDetail = 'Failed to revoke session';
    try {
      const errorJson = await res.json();
      errorDetail = errorJson.detail || errorDetail;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, 'API_ERROR', errorDetail);
  }

  return (await res.json()) as SimpleSuccessResponse;
}

/**
 * Revokes all sessions for current user across all devices via POST /api/v1/auth/logout-all.
 */
export async function logoutAllSessions(
  fetchFn: typeof fetch = fetch,
): Promise<SimpleSuccessResponse> {
  const url = resolveBrowserAuthUrl('/auth/logout-all');

  const res = await fetchFn(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
    credentials: 'include',
  });

  if (res.status === 401) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
  }

  if (!res.ok) {
    let errorDetail = 'Failed to logout from all devices';
    try {
      const errorJson = await res.json();
      errorDetail = errorJson.detail || errorDetail;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, 'API_ERROR', errorDetail);
  }

  return (await res.json()) as SimpleSuccessResponse;
}

/**
 * Changes password or completes forced password reset via POST /api/v1/auth/password/change.
 */
export async function changePassword(
  input: ChangePasswordRequest,
  fetchFn: typeof fetch = fetch,
): Promise<SimpleSuccessResponse> {
  const url = resolveBrowserAuthUrl('/auth/password/change');

  const res = await fetchFn(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE,
    },
    body: JSON.stringify(input),
    credentials: 'include',
  });

  if (res.status === 401) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
  }

  if (res.status === 422) {
    let detail = 'Password does not meet complexity requirements.';
    try {
      const errorJson = await res.json();
      detail = errorJson.detail || detail;
    } catch {
      // ignore
    }
    throw new WeakPasswordError(detail);
  }

  if (res.status === 429) {
    throw new RateLimitedError();
  }

  if (!res.ok) {
    let errorDetail = 'Failed to change password';
    try {
      const errorJson = await res.json();
      errorDetail = errorJson.detail || errorDetail;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, 'API_ERROR', errorDetail);
  }

  return (await res.json()) as SimpleSuccessResponse;
}

/**
 * Retrieves the currently authenticated user profile via GET /api/v1/me.
 */
export async function getMe(
  fetchFn: typeof fetch = fetch,
): Promise<UserMe> {
  const url = resolveBrowserAuthUrl('/me');

  const res = await fetchFn(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    credentials: 'include',
  });

  if (res.status === 401) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
  }

  if (res.status === 429) {
    throw new RateLimitedError();
  }

  if (!res.ok) {
    let errorDetail = 'Failed to fetch current user profile';
    try {
      const errorJson = await res.json();
      errorDetail = errorJson.detail || errorDetail;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, 'API_ERROR', errorDetail);
  }

  return (await res.json()) as UserMe;
}
