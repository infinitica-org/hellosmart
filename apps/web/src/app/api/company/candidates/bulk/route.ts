import { NextRequest, NextResponse } from 'next/server';
import { resolveServerApiV1Base } from '@/lib/api-base-url';
import { forwardApiSessionCookie } from '@/lib/forward-api-session-cookie';

function getTrustedOrigins(): string[] {
  const trusted = new Set<string>();
  const appOrigin =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_BASE_URL ||
    'http://localhost:3000';
  trusted.add(appOrigin.replace(/\/$/, ''));
  if (process.env.NODE_ENV !== 'production') {
    trusted.add('http://localhost:3000');
    trusted.add('http://127.0.0.1:3000');
  }
  return Array.from(trusted);
}

interface ParsedOriginResult {
  valid: boolean;
  origin?: string;
  reason?: 'missing' | 'null_origin' | 'malformed';
}

function parseOriginUrl(urlStr?: string | null): ParsedOriginResult {
  if (!urlStr || typeof urlStr !== 'string' || urlStr.trim() === '') {
    return { valid: false, reason: 'missing' };
  }
  const trimmed = urlStr.trim();
  if (trimmed === 'null') {
    return { valid: false, reason: 'null_origin' };
  }
  try {
    const parsed = new URL(trimmed);
    if (!parsed.protocol || !parsed.host) {
      return { valid: false, reason: 'malformed' };
    }
    return { valid: true, origin: parsed.origin };
  } catch {
    return { valid: false, reason: 'malformed' };
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const sessionToken = req.cookies.get('hs_session')?.value;
  if (!sessionToken) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Unauthorized',
        status: 401,
        detail: 'Authentication required. Please sign in.',
        code: 'AUTH_REQUIRED',
      },
      { status: 401 },
    );
  }

  // 1. Cross-site fetch metadata check
  const secFetchSite = req.headers.get('sec-fetch-site');
  if (secFetchSite === 'cross-site') {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Forbidden',
        status: 403,
        detail: 'Cross-site request blocked',
        code: 'CSRF_CROSS_SITE_BLOCKED',
      },
      { status: 403 },
    );
  }

  // 2. Fail-closed Origin / Referer validation
  const originHeader = req.headers.get('origin');
  const refererHeader = req.headers.get('referer');
  const trustedOrigins = getTrustedOrigins();

  let resolvedOrigin: string | null = null;

  if (originHeader) {
    const originCheck = parseOriginUrl(originHeader);
    if (!originCheck.valid) {
      return NextResponse.json(
        {
          type: 'about:blank',
          title: 'Forbidden',
          status: 403,
          detail:
            originCheck.reason === 'null_origin'
              ? 'CSRF protection check failed: Origin null is not permitted'
              : 'CSRF protection check failed: malformed Origin header',
          code: 'CSRF_INVALID_ORIGIN',
        },
        { status: 403 },
      );
    }
    resolvedOrigin = originCheck.origin!;
  } else if (refererHeader) {
    const refererCheck = parseOriginUrl(refererHeader);
    if (!refererCheck.valid) {
      return NextResponse.json(
        {
          type: 'about:blank',
          title: 'Forbidden',
          status: 403,
          detail: 'CSRF protection check failed: malformed Referer header',
          code: 'CSRF_INVALID_REFERER',
        },
        { status: 403 },
      );
    }
    resolvedOrigin = refererCheck.origin!;
  } else {
    // Both Origin and Referer are absent: fail closed
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Forbidden',
        status: 403,
        detail: 'CSRF protection check failed: missing Origin and Referer headers',
        code: 'CSRF_ORIGIN_MISSING',
      },
      { status: 403 },
    );
  }

  if (!trustedOrigins.includes(resolvedOrigin)) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Forbidden',
        status: 403,
        detail: `CSRF protection check failed: untrusted origin '${resolvedOrigin}'`,
        code: 'CSRF_INVALID_ORIGIN',
      },
      { status: 403 },
    );
  }

  // 3. Require incoming X-HS-CSRF header from browser state-changing call
  const clientCsrf = req.headers.get('x-hs-csrf');
  if (!clientCsrf || clientCsrf !== '1') {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Forbidden',
        status: 403,
        detail: 'CSRF protection check failed: missing or invalid X-HS-CSRF header',
        code: 'CSRF_TOKEN_MISSING',
      },
      { status: 403 },
    );
  }

  const apiBase = resolveServerApiV1Base();
  const url = new URL(req.url);
  const search = url.search; // preserves ?assessment_id=...

  // Forward strictly the validated trusted origin, session cookie, and CSRF token
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-HS-CSRF': '1',
    Origin: resolvedOrigin,
    Cookie: `hs_session=${sessionToken}`,
    Authorization: `Bearer ${sessionToken}`,
  };

  const contentType = req.headers.get('content-type');
  if (contentType) {
    headers['Content-Type'] = contentType;
  }

  try {
    // Stream request body directly to Fastify backend with duplex: 'half' (Node.js fetch streaming)
    const fetchInit: RequestInit & { duplex?: 'half' } = {
      method: 'POST',
      headers,
      body: req.body,
      duplex: 'half',
      cache: 'no-store',
    };

    const apiRes = await fetch(`${apiBase}/company/candidates/bulk${search}`, fetchInit);
    const responseText = await apiRes.text();

    const res = new NextResponse(responseText, {
      status: apiRes.status,
      headers: {
        'Content-Type': apiRes.headers.get('content-type') || 'application/json',
      },
    });

    forwardApiSessionCookie(apiRes, res);
    return res;
  } catch {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Service Unavailable',
        status: 503,
        detail: 'Candidate upload service is unavailable.',
      },
      { status: 503 },
    );
  }
}
