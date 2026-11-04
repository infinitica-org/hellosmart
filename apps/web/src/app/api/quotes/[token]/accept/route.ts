import { NextRequest, NextResponse } from 'next/server';
import { proxyAuthedApiRequest } from '@/lib/auth-bff-proxy';

function resolveCanonicalOrigins(req: NextRequest): Set<string> {
  const allowed = new Set<string>();

  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL;
  if (configured) {
    try {
      allowed.add(new URL(configured).origin);
    } catch {
      // ignore
    }
  }

  try {
    if (req.nextUrl.origin) {
      allowed.add(new URL(req.nextUrl.origin).origin);
    }
  } catch {
    // ignore
  }

  // Development and test local origins fallback
  if (process.env.NODE_ENV !== 'production') {
    allowed.add('http://localhost:3000');
    allowed.add('http://127.0.0.1:3000');
  }

  if (allowed.size === 0) {
    allowed.add('http://localhost:3000');
  }

  return allowed;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> },
): Promise<Response> {
  // 1. CSRF validation on incoming request to Next.js BFF (requires X-HS-CSRF: 1)
  const csrfHeader = req.headers.get('x-hs-csrf');
  if (csrfHeader !== '1') {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        detail: 'Missing or invalid CSRF protection token (X-HS-CSRF header required)',
        code: 'CSRF_VALIDATION_FAILED',
      },
      { status: 400 },
    );
  }

  // 2. Browser Origin validation against canonical application origins
  const rawOrigin = req.headers.get('origin');
  if (!rawOrigin || rawOrigin.trim() === '' || rawOrigin === 'null') {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Forbidden',
        status: 403,
        detail: 'Missing, null, or empty Origin header on quote acceptance request.',
        code: 'CSRF_INVALID_ORIGIN',
      },
      { status: 403 },
    );
  }

  let normalizedOrigin: string;
  try {
    const url = new URL(rawOrigin.trim());
    normalizedOrigin = url.origin;
  } catch {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Forbidden',
        status: 403,
        detail: 'Malformed Origin header on quote acceptance request.',
        code: 'CSRF_INVALID_ORIGIN',
      },
      { status: 403 },
    );
  }

  const allowedOrigins = resolveCanonicalOrigins(req);
  if (!allowedOrigins.has(normalizedOrigin)) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Forbidden',
        status: 403,
        detail: `Untrusted Origin '${normalizedOrigin}' rejected for quote acceptance.`,
        code: 'CSRF_INVALID_ORIGIN',
      },
      { status: 403 },
    );
  }

  const { token } = await context.params;
  return proxyAuthedApiRequest(req, `/quotes/${encodeURIComponent(token)}/accept`, {
    method: 'POST',
    origin: normalizedOrigin,
  });
}
