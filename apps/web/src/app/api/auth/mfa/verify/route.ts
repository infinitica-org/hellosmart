import { NextRequest, NextResponse } from 'next/server';
import { resolveServerApiV1Base } from '@/lib/api-base-url';
import { forwardApiSessionCookie } from '@/lib/forward-api-session-cookie';
import { DEV_SESSION_STORE, MOCK_PREAUTH_STORE } from '@/lib/session-store';

function resolveAppOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_BASE_URL ||
    'http://localhost:3000';
  return raw.replace(/\/$/, '');
}

function normalizeBackupCode(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.length === 8) {
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
  }
  return raw.trim().toUpperCase();
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const devFallbackEnabled =
    (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') &&
    (process.env.ENABLE_DEV_ACCOUNTS === 'true' || process.env.ALLOW_DEV_LOGIN_BFF === 'true');

  try {
    const body = await req.json();
    const preAuthToken =
      typeof body?.preAuthToken === 'string' ? body.preAuthToken.trim() : '';
    const totpRaw = typeof body?.totpCode === 'string' ? body.totpCode.trim() : '';
    const backupRaw = typeof body?.backupCode === 'string' ? body.backupCode.trim() : '';

    if (!preAuthToken) {
      return NextResponse.json(
        {
          type: 'about:blank',
          title: 'Validation Error',
          status: 400,
          detail: 'preAuthToken is required',
        },
        { status: 400 },
      );
    }

    const isTotp = /^\d{6}$/.test(totpRaw);
    const isBackup = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(backupRaw) || backupRaw.replace(/[^A-Za-z0-9]/g, '').length === 8;

    if (!isTotp && !isBackup) {
      return NextResponse.json(
        {
          type: 'about:blank',
          title: 'Validation Error',
          status: 422,
          detail: 'Provide a 6-digit authenticator code or a backup code (XXXX-XXXX)',
          code: 'VALIDATION_ERROR',
        },
        { status: 422 },
      );
    }

    const apiPayload: Record<string, string> = { preAuthToken };
    if (isTotp) {
      apiPayload.totpCode = totpRaw;
    } else {
      apiPayload.backupCode = normalizeBackupCode(backupRaw);
    }

    const apiBaseUrl = resolveServerApiV1Base();

    try {
      const verifyUrl = `${apiBaseUrl}/auth/mfa/verify`;

      const apiRes = await fetch(verifyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-HS-CSRF': '1',
          Origin: resolveAppOrigin(),
        },
        body: JSON.stringify(apiPayload),
      });

      const data = await apiRes.json().catch(() => null);

      if (apiRes.ok) {
        const res = NextResponse.json(data, { status: 200 });
        forwardApiSessionCookie(apiRes, res);

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
      if (!devFallbackEnabled || !preAuthToken.startsWith('preauth_dev_')) {
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

    // Dev-only mock MFA (preauth_dev_* tokens from login BFF fallback only)
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

    if (entry.attempts >= 3) {
      MOCK_PREAUTH_STORE.delete(preAuthToken);
      return NextResponse.json(
        {
          type: 'about:blank',
          title: 'Too Many Requests',
          status: 429,
          detail: 'Too many failed MFA attempts. Please wait 15 minutes before signing in again.',
          code: 'MFA_LOCKED_OUT',
        },
        { status: 429 },
      );
    }

    if (!isTotp || totpRaw !== '123456') {
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
