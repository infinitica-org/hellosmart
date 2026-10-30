import { NextRequest, NextResponse } from 'next/server';
import { logDevError } from '@/lib/dev-error-log';
import { DEV_LOGIN_ACCOUNTS } from '@/lib/dev-login-accounts';
import { resolveServerApiV1Base } from '@/lib/api-base-url';
import { forwardApiSessionCookie } from '@/lib/forward-api-session-cookie';
import { DEV_SESSION_STORE, MOCK_PREAUTH_STORE } from '@/lib/session-store';

// Track failed attempts in memory for rate-limiting simulation
const failedAttempts: Record<string, number> = {};

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Gate development fallback behind an explicit opt-in.
  // INVARIANT: production is unconditionally excluded — no flag can override this.
  // For local dev: set NODE_ENV=development and ENABLE_DEV_ACCOUNTS=true or ALLOW_DEV_LOGIN_BFF=true.
  // Never set ENABLE_DEV_ACCOUNTS or ALLOW_DEV_LOGIN_BFF in staging or production.
  const devFallbackEnabled =
    (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') &&
    (process.env.ENABLE_DEV_ACCOUNTS === 'true' || process.env.ALLOW_DEV_LOGIN_BFF === 'true');

  try {
    const body = await req.json();
    const { email, password, mfaCode } = body;

    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      return NextResponse.json(
        {
          type: 'about:blank',
          title: 'Validation Error',
          status: 400,
          detail: 'Email and password are required',
        },
        { status: 400 },
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Rate limiting check (429 simulation for > 4 failed attempts or explicit rate-limit testing fixture)
    if (
      normalizedEmail.includes('ratelimit') ||
      (failedAttempts[normalizedEmail] && failedAttempts[normalizedEmail] >= 5)
    ) {
      return NextResponse.json(
        {
          type: 'about:blank',
          title: 'Too Many Requests',
          status: 429,
          detail: 'Too many failed attempts. Please wait 15 minutes.',
        },
        { status: 429 },
      );
    }

    const apiBaseUrl = resolveServerApiV1Base();

    // 1. Attempt real backend call first
    try {
      const loginUrl = `${apiBaseUrl}/auth/login`;

      const apiRes = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-HS-CSRF': '1',
        },
        body: JSON.stringify({ email: normalizedEmail, password, mfaCode }),
      });

      const data = await apiRes.json().catch(() => null);

      if (apiRes.ok) {
        failedAttempts[normalizedEmail] = 0;
        const res = NextResponse.json(data, { status: 200 });
        forwardApiSessionCookie(apiRes, res);

        // Forced password reset on first login (BR-24)
        const mustReset = Boolean(data?.mustResetPassword || data?.user?.mustResetPassword);
        if (mustReset) {
          res.cookies.set('hs_must_reset', 'true', {
            path: '/',
            httpOnly: false,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
          });
        } else {
          res.cookies.delete('hs_must_reset');
        }

        return res;
      }

      // If backend returned a specific error status (401, 403, 429, etc.), relay it directly.
      // Never fall back to DEV_ACCOUNTS when the backend is reachable.
      if (apiRes.status >= 500) {
        logDevError('auth/login:backend-error', new Error(data?.detail || data?.title || 'Backend login failed'), {
          status: apiRes.status,
          code: data?.code,
          email: normalizedEmail,
          body: data,
        });
      }
      return NextResponse.json(
        data || {
          type: 'about:blank',
          title: 'Authentication Failed',
          status: apiRes.status,
          detail: 'Invalid credentials or authentication error.',
        },
        { status: apiRes.status },
      );
    } catch (backendError) {
      logDevError('auth/login:backend-fetch', backendError, {
        loginUrl: `${apiBaseUrl}/auth/login`,
        email: normalizedEmail,
      });
      // Backend offline / unreachable
      // Never use demo credentials if the backend is unavailable
      // unless explicitly enabled for local development. Fail closed with 503.
      if (!devFallbackEnabled) {
        return NextResponse.json(
          {
            type: 'about:blank',
            title: 'Authentication Service Unavailable',
            status: 503,
            detail: 'The authentication service is currently unavailable. Please verify API server connectivity.',
          },
          { status: 503 },
        );
      }
    }

    // 2. Development-only mock fallback (reachable ONLY when devFallbackEnabled is true)
    const user = DEV_LOGIN_ACCOUNTS[normalizedEmail];

    if (!user) {
      failedAttempts[normalizedEmail] = (failedAttempts[normalizedEmail] || 0) + 1;
      return NextResponse.json(
        {
          type: 'about:blank',
          title: 'Unauthorized',
          status: 401,
          detail: 'Invalid email or password, or account not found.',
        },
        { status: 401 },
      );
    }

    // Check account status (403 if suspended)
    if (user.status === 'suspended') {
      return NextResponse.json(
        {
          type: 'about:blank',
          title: 'Forbidden',
          status: 403,
          detail: 'Your account or company is suspended. Please contact support.',
        },
        { status: 403 },
      );
    }

    // In dev mode, check basic password validity
    if (password === 'wrongpassword' || password.length < 6) {
      failedAttempts[normalizedEmail] = (failedAttempts[normalizedEmail] || 0) + 1;
      return NextResponse.json(
        {
          type: 'about:blank',
          title: 'Unauthorized',
          status: 401,
          detail: 'Invalid email or password, or account not found.',
        },
        { status: 401 },
      );
    }

    // Step 2a: Check MFA requirement
    // When MFA is required, DO NOT issue session cookies or tokens until verified.
    if (user.requiresMfa) {
      const preAuthToken = `preauth_dev_${crypto.randomUUID()}`;
      MOCK_PREAUTH_STORE.set(preAuthToken, {
        email: user.email,
        attempts: 0,
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 min TTL
      });

      return NextResponse.json(
        {
          mfaRequired: true,
          preAuthToken,
          role: user.role,
          portal: user.portal,
          email: user.email,
          message: 'Two-factor authentication code required.',
        },
        { status: 200 },
      );
    }

    // Successful login: reset failed attempts
    failedAttempts[normalizedEmail] = 0;

    // Issue a cryptographically secure random session token for dev mode
    const devToken = `hs_dev_${crypto.randomUUID()}`;
    DEV_SESSION_STORE.set(devToken, { role: user.role, email: user.email });

    const mustReset = Boolean(user.mustResetPassword);

    const sessionPayload = {
      user: {
        id: `usr_${user.portal}_01`,
        email: user.email,
        name: user.name,
        role: user.role,
        mustResetPassword: mustReset,
      },
      role: user.role,
      portal: user.portal,
      token: devToken,
      mustResetPassword: mustReset,
    };

    const res = NextResponse.json(sessionPayload, { status: 200 });

    // Session cookie: HttpOnly, SameSite=lax, Secure in production
    res.cookies.set('hs_session', devToken, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    // Client role hint:
    // INVARIANT: hs_role is non-httpOnly for UI display hints only.
    // Server and middleware authorization NEVER trust this cookie.
    res.cookies.set('hs_role', user.role, {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    // Forced password reset on first login (BR-24)
    if (mustReset) {
      res.cookies.set('hs_must_reset', 'true', {
        path: '/',
        httpOnly: false,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
    } else {
      res.cookies.delete('hs_must_reset');
    }

    return res;
  } catch (error) {
    logDevError('auth/login', error);
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
        detail:
          process.env.NODE_ENV === 'development' && error instanceof Error
            ? error.message
            : 'An unexpected error occurred during login.',
      },
      { status: 500 },
    );
  }
}
