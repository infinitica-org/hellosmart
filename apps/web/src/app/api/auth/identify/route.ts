import { NextRequest, NextResponse } from 'next/server';
import { resolveServerApiV1Base } from '@/lib/api-base-url';
import { devIdentifyLogin } from '@/lib/dev-login-accounts';
import { logDevError } from '@/lib/dev-error-log';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const devFallbackEnabled =
    (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') &&
    (process.env.ENABLE_DEV_ACCOUNTS === 'true' || process.env.ALLOW_DEV_LOGIN_BFF === 'true');

  try {
    const body = await req.json();
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        {
          type: 'about:blank',
          title: 'Validation Error',
          status: 400,
          detail: 'A valid email address is required',
        },
        { status: 400 },
      );
    }

    const apiBaseUrl = resolveServerApiV1Base();

    try {
      const identifyUrl = `${apiBaseUrl}/auth/identify`;
      const apiRes = await fetch(identifyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-HS-CSRF': '1',
        },
        body: JSON.stringify({ email }),
      });

      const data = await apiRes.json().catch(() => null);

      if (apiRes.ok && data) {
        return NextResponse.json(data, { status: 200 });
      }

      // Older API builds without auth/identify — do not block sign-in.
      if (apiRes.status === 404) {
        if (devFallbackEnabled) {
          return NextResponse.json(devIdentifyLogin(email), { status: 200 });
        }
        return NextResponse.json({ recognized: true }, { status: 200 });
      }

      if (apiRes.status >= 500) {
        logDevError('auth/identify:backend-error', new Error(data?.detail || 'Identify failed'), {
          status: apiRes.status,
          email,
        });
      }

      if (apiRes.status === 503 || apiRes.status === 502 || apiRes.status >= 500) {
        if (devFallbackEnabled) {
          return NextResponse.json(devIdentifyLogin(email), { status: 200 });
        }
        return NextResponse.json({ recognized: true }, { status: 200 });
      }

      if (apiRes.status === 429) {
        return NextResponse.json(
          data || {
            type: 'about:blank',
            title: 'Too Many Requests',
            status: 429,
            detail: 'Too many attempts. Please wait and try again.',
          },
          { status: 429 },
        );
      }
    } catch (backendError) {
      logDevError('auth/identify:backend-fetch', backendError, { email });
      if (!devFallbackEnabled) {
        return NextResponse.json(
          {
            type: 'about:blank',
            title: 'Authentication Service Unavailable',
            status: 503,
            detail: 'The authentication service is currently unavailable.',
          },
          { status: 503 },
        );
      }
    }

    if (devFallbackEnabled) {
      return NextResponse.json(devIdentifyLogin(email), { status: 200 });
    }

    return NextResponse.json({ recognized: true }, { status: 200 });
  } catch (error) {
    logDevError('auth/identify', error);
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred.',
      },
      { status: 500 },
    );
  }
}
