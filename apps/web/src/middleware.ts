import { NextResponse, type NextRequest } from 'next/server';
import { DEV_SESSION_STORE } from './lib/session-store';
import { sanitizeRedirectPath } from './lib/safe-redirect';

// Portal route prefixes requiring authentication & authorization (BR-25)
const PROTECTED_PORTALS = ['/admin', '/company', '/candidate'] as const;

export { DEV_SESSION_STORE };

export function extractOrigin(urlStr?: string): string | null {
  if (!urlStr) return null;
  try {
    const parsed = new URL(urlStr);
    return parsed.origin;
  } catch {
    return null;
  }
}

export function buildCspDirectives(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development';

  // Extract strictly origin portion without path
  const connectOrigins = new Set<string>();
  const publicApiOrigin = extractOrigin(process.env.NEXT_PUBLIC_API_URL);
  if (publicApiOrigin) connectOrigins.add(publicApiOrigin);
  const internalApiOrigin = extractOrigin(process.env.API_BASE_URL);
  if (internalApiOrigin) connectOrigins.add(internalApiOrigin);
  if (connectOrigins.size === 0) {
    connectOrigins.add('http://localhost:4000');
  }

  const originsString = Array.from(connectOrigins).join(' ');

  return [
    "default-src 'self'",
    isDev
      ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'"
      : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data: https:",
    isDev
      ? `connect-src 'self' ${originsString} ws: wss: https:`
      : `connect-src 'self' ${originsString}`,
    'frame-src https://cal.com https://api.razorpay.com',
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

export function applySecurityHeaders(
  res: NextResponse,
  nonce: string,
  pathname?: string,
): NextResponse {
  const csp = buildCspDirectives(nonce);

  res.headers.set('Content-Security-Policy', csp);
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');

  // Strict Referrer-Policy on sensitive paths (passwords, auth, resets)
  const loc = res.headers.get('location') || '';
  const isSensitive =
    loc.includes('reset') ||
    loc.includes('password') ||
    loc.includes('login') ||
    Boolean(
      pathname &&
        (pathname.includes('reset') ||
          pathname.includes('password') ||
          pathname.includes('login')),
    );

  res.headers.set(
    'Referrer-Policy',
    isSensitive ? 'no-referrer' : 'strict-origin-when-cross-origin',
  );

  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // Enforce HSTS in production deployments
  if (process.env.NODE_ENV === 'production') {
    res.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload',
    );
  }

  // Remove X-Powered-By
  res.headers.delete('x-powered-by');
  res.headers.delete('X-Powered-By');

  // Set nonce header for downstream server components or verification
  res.headers.set('x-nonce', nonce);

  return res;
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const nonce = btoa(crypto.randomUUID());
  const { pathname } = req.nextUrl;

  // 1. Check incoming requests for protected portals
  const matchedPortal = PROTECTED_PORTALS.find(
    (portal) => pathname === portal || pathname.startsWith(`${portal}/`)
  );

  if (matchedPortal) {
    // 2. Read hs_session cookie. If missing, redirect to /login
    const sessionToken = req.cookies.get('hs_session')?.value;

    if (!sessionToken) {
      if (pathname === '/login') {
        const headers = new Headers(req.headers);
        headers.set('x-nonce', nonce);
        headers.set('Content-Security-Policy', buildCspDirectives(nonce));
        return applySecurityHeaders(NextResponse.next({ request: { headers } }), nonce, pathname);
      }

      const loginUrl = new URL('/login', req.url);
      if (pathname !== '/') {
        const cleanFrom = sanitizeRedirectPath(pathname) || pathname;
        loginUrl.searchParams.set('from', cleanFrom);
      }
      return applySecurityHeaders(NextResponse.redirect(loginUrl), nonce, pathname);
    }

    // 3. Server-side session & authorization check
    // Never trust client-controlled hs_role cookie alone as proof of authorization
    let userRole: string | null = null;
    const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:4000';

    try {
      const meRes = await fetch(`${apiBaseUrl}/me`, {
        headers: {
          Cookie: `hs_session=${sessionToken}`,
          Authorization: `Bearer ${sessionToken}`,
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(1500),
      });

      if (meRes.ok) {
        const me = await meRes.json().catch(() => null);
        if (me?.role) {
          userRole = me.role;
        }
      } else if (meRes.status === 401 || meRes.status === 403) {
        // Expired or invalid session: clear session cookies and fail closed to /login
        const loginUrl = new URL('/login', req.url);
        const cleanFrom = sanitizeRedirectPath(pathname) || pathname;
        loginUrl.searchParams.set('from', cleanFrom);
        const res = NextResponse.redirect(loginUrl);
        res.cookies.delete('hs_session');
        res.cookies.delete('hs_role');
        return applySecurityHeaders(res, nonce, pathname);
      } else {
        // Backend returned a non-200 but was reachable — session invalid/expired
        const loginUrl = new URL('/login', req.url);
        const cleanFrom = sanitizeRedirectPath(pathname) || pathname;
        loginUrl.searchParams.set('from', cleanFrom);
        loginUrl.searchParams.set('error', 'auth_unavailable');
        const res = NextResponse.redirect(loginUrl);
        return applySecurityHeaders(res, nonce, pathname);
      }
    } catch {
      // Backend is offline or unreachable.
      // Fail closed in all environments EXCEPT local development with an explicit opt-in flag.
      // INVARIANT: production is unconditionally excluded regardless of any env flag.
      const devFallbackEnabled =
        process.env.NODE_ENV === 'development' &&
        process.env.ENABLE_DEV_ACCOUNTS === 'true';

      if (!devFallbackEnabled) {
        const loginUrl = new URL('/login', req.url);
        const cleanFrom = sanitizeRedirectPath(pathname) || pathname;
        loginUrl.searchParams.set('from', cleanFrom);
        loginUrl.searchParams.set('error', 'auth_unavailable');
        const res = NextResponse.redirect(loginUrl);
        return applySecurityHeaders(res, nonce, pathname);
      }

      // Local development only: look up role from a server-side dev session store
      // keyed by the opaque token. NEVER infer role from the token string or hs_role cookie.
      // TODO(pre-production): remove this block and require real backend sessions.
      const devSession = DEV_SESSION_STORE.get(sessionToken);
      userRole = devSession?.role ?? null;
    }

    // 4. Force password reset if required (BR-24)
    const mustReset = req.cookies.get('hs_must_reset')?.value === 'true';
    if (mustReset && !pathname.startsWith('/change-password') && !pathname.startsWith('/set-password')) {
      return applySecurityHeaders(
        NextResponse.redirect(new URL('/change-password?required=true', req.url)),
        nonce,
        pathname,
      );
    }

    // 5. Role-based route enforcement (BR-25 Route Isolation)
    if (userRole === 'candidate') {
      const isTryingRestricted =
        pathname === '/admin' ||
        pathname.startsWith('/admin/') ||
        pathname === '/company' ||
        pathname.startsWith('/company/');

      if (isTryingRestricted) {
        return applySecurityHeaders(
          NextResponse.redirect(new URL('/candidate', req.url)),
          nonce,
          pathname,
        );
      }
    }

    if (userRole === 'company_admin') {
      const isTryingAdmin = pathname === '/admin' || pathname.startsWith('/admin/');

      if (isTryingAdmin) {
        return applySecurityHeaders(
          NextResponse.redirect(new URL('/company', req.url)),
          nonce,
          pathname,
        );
      }
    }

    // If session is present but role could not be authorized, redirect to /login
    if (!userRole) {
      const loginUrl = new URL('/login', req.url);
      const cleanFrom = sanitizeRedirectPath(pathname) || pathname;
      loginUrl.searchParams.set('from', cleanFrom);
      const res = NextResponse.redirect(loginUrl);
      res.cookies.delete('hs_session');
      res.cookies.delete('hs_role');
      return applySecurityHeaders(res, nonce, pathname);
    }
  }

  // Set CSP nonce header on request for server components
  const headers = new Headers(req.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', buildCspDirectives(nonce));
  const res = NextResponse.next({ request: { headers } });

  return applySecurityHeaders(res, nonce, pathname);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
