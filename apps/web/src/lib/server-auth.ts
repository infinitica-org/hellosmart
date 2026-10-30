import { NextRequest, NextResponse } from 'next/server';
import { resolveServerApiV1Base } from './api-base-url';
import { DEV_SESSION_STORE } from './session-store';

export interface AuthSession {
  role: string;
  email?: string;
  id?: string;
}

export type AuthCheckResult =
  | { authorized: true; session: AuthSession }
  | { authorized: false; errorResponse: NextResponse };

/**
 * Validates the caller's session on the server side and verifies they have platform_admin role.
 * 
 * Rules:
 * 1. Checks `hs_session` cookie or `Authorization: Bearer <token>`.
 * 2. Never trusts `hs_role` or client-supplied role hints.
 * 3. In production, calls the backend `/me` endpoint with a timeout.
 * 4. In development/test mode, falls back to DEV_SESSION_STORE if backend is offline.
 * 5. Returns 401 if unauthenticated or session invalid.
 * 6. Returns 403 if authenticated but not a platform_admin.
 */
export async function requirePlatformAdmin(req: NextRequest): Promise<AuthCheckResult> {
  const sessionToken =
    req.cookies.get('hs_session')?.value ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  if (!sessionToken) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        {
          type: 'about:blank',
          title: 'Unauthorized',
          status: 401,
          detail: 'Authentication required. Please sign in to continue.',
        },
        { status: 401 }
      ),
    };
  }

  // Fast-path for testing & local development fixtures in DEV_SESSION_STORE
  if (
    (process.env.NODE_ENV === 'test' ||
      (process.env.NODE_ENV === 'development' && process.env.ENABLE_DEV_ACCOUNTS === 'true')) &&
    DEV_SESSION_STORE.has(sessionToken)
  ) {
    const devSession = DEV_SESSION_STORE.get(sessionToken)!;
    if (devSession.role === 'platform_admin') {
      return {
        authorized: true,
        session: { role: devSession.role, email: devSession.email, id: sessionToken },
      };
    }
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        {
          type: 'about:blank',
          title: 'Forbidden',
          status: 403,
          detail: 'Platform Administrator role required to access this resource.',
        },
        { status: 403 }
      ),
    };
  }

  const apiV1Base = resolveServerApiV1Base();

  // 1. Try real backend validation first
  try {
    const meRes = await fetch(`${apiV1Base}/me`, {
      headers: {
        Cookie: `hs_session=${sessionToken}`,
        Authorization: `Bearer ${sessionToken}`,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(1500),
    });

    if (meRes.ok) {
      const me = await meRes.json().catch(() => null);
      if (me?.role === 'platform_admin') {
        return {
          authorized: true,
          session: { role: me.role, email: me.email, id: me.id },
        };
      }
      // Authenticated, but wrong role -> 403 Forbidden
      return {
        authorized: false,
        errorResponse: NextResponse.json(
          {
            type: 'about:blank',
            title: 'Forbidden',
            status: 403,
            detail: 'Platform Administrator role required to access this resource.',
          },
          { status: 403 }
        ),
      };
    }

    if (meRes.status === 401 || meRes.status === 403) {
      return {
        authorized: false,
        errorResponse: NextResponse.json(
          {
            type: 'about:blank',
            title: 'Unauthorized',
            status: 401,
            detail: 'Invalid or expired session token.',
          },
          { status: 401 }
        ),
      };
    }
  } catch {
    // Backend offline / unreachable
    const isDevOrTest =
      process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    const devFallbackEnabled =
      isDevOrTest &&
      (process.env.ENABLE_DEV_ACCOUNTS === 'true' || process.env.NODE_ENV === 'test');

    if (!devFallbackEnabled) {
      // In production or when dev fallback disabled, fail closed
      return {
        authorized: false,
        errorResponse: NextResponse.json(
          {
            type: 'about:blank',
            title: 'Authentication Service Unavailable',
            status: 503,
            detail: 'Authentication service is unavailable.',
          },
          { status: 503 }
        ),
      };
    }

    // Local dev/test fallback using server-side store
    const devSession = DEV_SESSION_STORE.get(sessionToken);

    if (!devSession) {
      return {
        authorized: false,
        errorResponse: NextResponse.json(
          {
            type: 'about:blank',
            title: 'Unauthorized',
            status: 401,
            detail: 'Invalid development session token.',
          },
          { status: 401 }
        ),
      };
    }

    if (devSession.role !== 'platform_admin') {
      return {
        authorized: false,
        errorResponse: NextResponse.json(
          {
            type: 'about:blank',
            title: 'Forbidden',
            status: 403,
            detail: 'Platform Administrator role required to access this resource.',
          },
          { status: 403 }
        ),
      };
    }

    return {
      authorized: true,
      session: { role: devSession.role, email: devSession.email },
    };
  }

  return {
    authorized: false,
    errorResponse: NextResponse.json(
      {
        type: 'about:blank',
        title: 'Unauthorized',
        status: 401,
        detail: 'Authentication failed.',
      },
      { status: 401 }
    ),
  };
}

