import type {
  AcceptInvitationRequest,
  AcceptInvitationResponse,
  InvitationDetailsResponse,
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
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
  }
  return process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
}

/**
 * Validates an invitation token via GET /api/v1/auth/invitations/:token.
 * Throws InvitationInvalidError if token is unknown, expired, or already used.
 */
export async function validateInvitation(
  token: string,
  fetchFn: typeof fetch = fetch,
): Promise<InvitationDetailsResponse> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/auth/invitations/${encodeURIComponent(token)}`;

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
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/auth/invitations/accept`;

  const res = await fetchFn(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
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
 * Authenticates user via POST /api/v1/auth/login.
 */
export async function login(
  credentials: { email: string; password: string; mfaCode?: string },
  fetchFn: typeof fetch = fetch,
): Promise<UserMe> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/auth/login`;

  const res = await fetchFn(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(credentials),
    credentials: 'include',
  });

  if (res.status === 401) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
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
