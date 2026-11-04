import { NextRequest, NextResponse } from 'next/server';
import { resolveServerApiV1Base } from '@/lib/api-base-url';
import { forwardApiSessionCookie } from '@/lib/forward-api-session-cookie';

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

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

/**
 * Validates CSRF token, cross-site fetch metadata, and fail-closed Origin/Referer
 * for incoming state-changing BFF requests (CO-011, CO-015, CO-016, CO-017, S1-T05-4).
 */
export function validateBffCsrfAndOrigin(req: NextRequest): { errorResponse: NextResponse | null; validatedOrigin: string | null } {
  // 1. Cross-site fetch metadata check
  const secFetchSite = req.headers.get('sec-fetch-site');
  if (secFetchSite === 'cross-site') {
    return {
      errorResponse: NextResponse.json(
        {
          type: 'about:blank',
          title: 'Forbidden',
          status: 403,
          detail: 'Cross-site request blocked',
          code: 'CSRF_CROSS_SITE_BLOCKED',
        },
        { status: 403 },
      ),
      validatedOrigin: null,
    };
  }

  // 2. Fail-closed Origin / Referer validation
  const originHeader = req.headers.get('origin');
  const refererHeader = req.headers.get('referer');
  const trustedOrigins = getTrustedOrigins();

  let resolvedOrigin: string | null = null;

  if (originHeader) {
    const originCheck = parseOriginUrl(originHeader);
    if (!originCheck.valid) {
      return {
        errorResponse: NextResponse.json(
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
        ),
        validatedOrigin: null,
      };
    }
    resolvedOrigin = originCheck.origin!;
  } else if (refererHeader) {
    const refererCheck = parseOriginUrl(refererHeader);
    if (!refererCheck.valid) {
      return {
        errorResponse: NextResponse.json(
          {
            type: 'about:blank',
            title: 'Forbidden',
            status: 403,
            detail: 'CSRF protection check failed: malformed Referer header',
            code: 'CSRF_INVALID_REFERER',
          },
          { status: 403 },
        ),
        validatedOrigin: null,
      };
    }
    resolvedOrigin = refererCheck.origin!;
  } else {
    // Both Origin and Referer are absent: fail closed
    return {
      errorResponse: NextResponse.json(
        {
          type: 'about:blank',
          title: 'Forbidden',
          status: 403,
          detail: 'CSRF protection check failed: missing Origin and Referer headers',
          code: 'CSRF_ORIGIN_MISSING',
        },
        { status: 403 },
      ),
      validatedOrigin: null,
    };
  }

  if (!trustedOrigins.includes(resolvedOrigin)) {
    return {
      errorResponse: NextResponse.json(
        {
          type: 'about:blank',
          title: 'Forbidden',
          status: 403,
          detail: `CSRF protection check failed: untrusted origin '${resolvedOrigin}'`,
          code: 'CSRF_INVALID_ORIGIN',
        },
        { status: 403 },
      ),
      validatedOrigin: null,
    };
  }

  // 3. Require incoming X-HS-CSRF header from browser state-changing call
  const clientCsrf = req.headers.get('x-hs-csrf');
  if (!clientCsrf || clientCsrf !== '1') {
    return {
      errorResponse: NextResponse.json(
        {
          type: 'about:blank',
          title: 'Forbidden',
          status: 403,
          detail: 'CSRF protection check failed: missing or invalid X-HS-CSRF header',
          code: 'CSRF_TOKEN_MISSING',
        },
        { status: 403 },
      ),
      validatedOrigin: null,
    };
  }

  return { errorResponse: null, validatedOrigin: resolvedOrigin };
}

export async function proxyAuthedApiRequest(
  req: NextRequest,
  upstreamPath: string,
  options?: { method?: string; body?: string; enforceCsrf?: boolean; origin?: string },
): Promise<NextResponse> {
  const method = (options?.method ?? req.method).toUpperCase();
  const pathname = req.nextUrl.pathname;
  const isCandidateRoute = pathname.startsWith('/api/company/candidates') || upstreamPath.startsWith('/candidates');
  const shouldValidateCsrf = STATE_CHANGING.has(method) && (options?.enforceCsrf ?? isCandidateRoute);

  let validatedOrigin: string | null = null;
  if (shouldValidateCsrf) {
    const csrfCheck = validateBffCsrfAndOrigin(req);
    if (csrfCheck.errorResponse) {
      return csrfCheck.errorResponse;
    }
    validatedOrigin = csrfCheck.validatedOrigin;
  }

  const sessionToken = req.cookies.get('hs_session')?.value;
  if (!sessionToken && isCandidateRoute && STATE_CHANGING.has(method)) {
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

  const apiBase = resolveServerApiV1Base();

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (sessionToken) {
    headers.Cookie = `hs_session=${sessionToken}`;
    headers.Authorization = `Bearer ${sessionToken}`;
  }

  if (STATE_CHANGING.has(method)) {
    if (validatedOrigin) {
      headers['X-HS-CSRF'] = '1';
      headers.Origin = validatedOrigin;
    } else {
      const appOrigin =
        options?.origin ||
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.APP_BASE_URL ||
        'http://localhost:3000';
      headers['X-HS-CSRF'] = '1';
      headers.Origin = appOrigin.replace(/\/$/, '');
    }
  }

  let body: string | undefined = options?.body;
  if (body === undefined && STATE_CHANGING.has(method)) {
    body = await req.text();
    const contentType = req.headers.get('content-type');
    if (contentType) {
      headers['Content-Type'] = contentType;
    }
  }

  let apiRes: Response;
  try {
    const fetchInit: RequestInit = {
      method,
      headers,
      cache: 'no-store',
    };
    if (body !== undefined && body.length > 0) {
      fetchInit.body = body;
    }
    apiRes = await fetch(`${apiBase}${upstreamPath}`, fetchInit);
  } catch {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Service Unavailable',
        status: 503,
        detail: 'Authentication service is unavailable.',
      },
      { status: 503 },
    );
  }

  const responseText = await apiRes.text();
  const res = new NextResponse(responseText, {
    status: apiRes.status,
    headers: {
      'Content-Type': apiRes.headers.get('content-type') || 'application/json',
    },
  });

  forwardApiSessionCookie(apiRes, res);

  if (
    apiRes.ok &&
    (upstreamPath === '/auth/password/change' ||
      upstreamPath.startsWith('/auth/invitations/accept') ||
      upstreamPath === '/auth/logout' ||
      upstreamPath === '/auth/logout-all')
  ) {
    res.cookies.delete('hs_must_reset');
  }

  return res;
}
