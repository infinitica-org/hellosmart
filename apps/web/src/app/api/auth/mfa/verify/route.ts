import { NextRequest, NextResponse } from 'next/server';
import { DEV_SESSION_STORE, MOCK_PREAUTH_STORE } from '@/lib/session-store';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const devFallbackEnabled =
    (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') &&
    (process.env.ENABLE_DEV_ACCOUNTS === 'true' || process.env.ALLOW_DEV_LOGIN_BFF === 'true');

  try {
    const body = await req.json();
    const { preAuthToken, totpCode } = body || {};

    if (!preAuthToken || !totpCode) {
      return NextResponse.json(
        {
          type: 'about:blank',
          title: 'Validation Error',
          status: 400,
          detail: 'preAuthToken and 6-digit totpCode are required',
        },
        { status: 400 },
      );
    }

    const sanitizedCode = String(totpCode).trim();
    if (!/^\d{6}$/.test(sanitizedCode)) {
      return NextResponse.json(
        {
          type: 'about:blank',
          title: 'Validation Error',
          status: 422,
          detail: 'TOTP code must be exactly 6 digits',
          code: 'VALIDATION_ERROR',
        },
        { status: 422 },
      );
    }

    const rawApiUrl = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
    const apiBaseUrl = rawApiUrl.replace(/\/$/, '');

    // 1. Attempt real backend call first
    try {
      const verifyUrl = apiBaseUrl.endsWith('/api/v1')
        ? `${apiBaseUrl}/auth/mfa/verify`
        : `${apiBaseUrl}/api/v1/auth/mfa/verify`;

      const apiRes = await fetch(verifyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ preAuthToken, totpCode: sanitizedCode }),
      });

      const data = await apiRes.json().catch(() => null);

      if (apiRes.ok) {
        const res = NextResponse.json(data, { status: 200 });
        const setCookie = apiRes.headers.get('set-cookie');
        if (setCookie) {
          res.headers.set('set-cookie', setCookie);
        }
        return res;
      }

      return NextResponse.json(
        data || {
          type: 'about:blank',
          title: 'MFA Verification Failed',
          status: apiRes.status,
          detail: 'Invalid MFA verification code.',
        },
        { status: apiRes.status },
      );
    } catch {
      // Backend offline / unreachable
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

    // 2. Local development mock MFA verification
    const entry = MOCK_PREAUTH_STORE.get(preAuthToken);
    if (!entry || Date.now() > entry.expiresAt) {
      MOCK_PREAUTH_STORE.delete(preAuthToken);
      return NextResponse.json(
        {
          type: 'about:blank',
          title: 'Unauthorized',
          status: 401,
          detail: 'Pre-authentication expired or invalid',
          code: 'PREAUTH_INVALID',
        },
        { status: 401 },
      );
    }

    // 3-failed-attempts lockout rule
    if (entry.attempts >= 3) {
      MOCK_PREAUTH_STORE.delete(preAuthToken);
      return NextResponse.json(
        {
          type: 'about:blank',
          title: 'Too Many Requests',
          status: 429,
          detail: 'Too many failed MFA attempts. Please wait 15 minutes before trying again.',
          code: 'MFA_LOCKED_OUT',
        },
        { status: 429 },
      );
    }

    // In isolated mock mode, '123456' is the deterministic valid TOTP code
    if (sanitizedCode !== '123456') {
      entry.attempts += 1;
      if (entry.attempts >= 3) {
        MOCK_PREAUTH_STORE.delete(preAuthToken);
        return NextResponse.json(
          {
            type: 'about:blank',
            title: 'Too Many Requests',
            status: 429,
            detail: 'Too many failed MFA attempts. Pre-authentication invalidated.',
            code: 'MFA_LOCKED_OUT',
          },
          { status: 429 },
        );
      }

      return NextResponse.json(
        {
          type: 'about:blank',
          title: 'Unauthorized',
          status: 401,
          detail: 'Invalid MFA code',
          code: 'MFA_INVALID',
        },
        { status: 401 },
      );
    }

    // Verified: consume pre-auth token and issue session
    MOCK_PREAUTH_STORE.delete(preAuthToken);
    const sessionToken = `sess_dev_${crypto.randomUUID()}`;
    DEV_SESSION_STORE.set(sessionToken, {
      role: 'platform_admin',
      email: entry.email,
    });

    const userPayload = {
      id: '00000000-0000-0000-0000-000000000001',
      email: entry.email,
      role: 'platform_admin',
      portal: 'admin',
      name: 'Platform Administrator',
      status: 'active',
    };

    const res = NextResponse.json(userPayload, { status: 200 });
    res.cookies.set('hs_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 86400,
    });

    return res;
  } catch {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred during MFA verification.',
      },
      { status: 500 },
    );
  }
}

