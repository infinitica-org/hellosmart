import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest): Promise<NextResponse> {
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
        { status: 400 }
      );
    }

    const apiBaseUrl = process.env.API_BASE_URL || 'http://127.0.0.1:4000';

    let apiRes: Response;
    try {
      apiRes = await fetch(`${apiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim(), password, mfaCode }),
      });
    } catch {
      return NextResponse.json(
        {
          type: 'about:blank',
          title: 'Authentication Service Unavailable',
          status: 503,
          detail: 'Unable to connect to the authentication service. Please verify that the API server is running.',
        },
        { status: 503 }
      );
    }

    const data = await apiRes.json().catch(() => null);

    if (!apiRes.ok) {
      return NextResponse.json(
        data || {
          type: 'about:blank',
          title: 'Authentication Failed',
          status: apiRes.status,
          detail: 'Invalid credentials or authentication error.',
        },
        { status: apiRes.status }
      );
    }

    const res = NextResponse.json(data, { status: 200 });

    // Forward Set-Cookie header (such as hs_session) from API if present
    const setCookie = apiRes.headers.get('set-cookie');
    if (setCookie) {
      res.headers.set('set-cookie', setCookie);
    }

    return res;
  } catch (error) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred during login.',
      },
      { status: 500 }
    );
  }
}
