import { NextResponse, type NextRequest } from 'next/server';
import { DEV_SESSION_STORE } from './lib/session-store';

// Portal route prefixes requiring authentication & authorization (BR-25)
const PROTECTED_PORTALS = ['/admin', '/company', '/candidate'] as const;

export { DEV_SESSION_STORE };

function applySecurityHeaders(res: NextResponse, nonce: string): NextResponse {
  const isDev = process.env.NODE_ENV === 'development';
  const apiOrigin = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const csp = [
    "default-src 'self'",
    isDev
      ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'"
      : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data: https:",
    `connect-src 'self' ${apiOrigin} http://localhost:4000 http://127.0.0.1:4000 ws: wss: https:`,
    'frame-src https://cal.com https://api.razorpay.com',
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  res.headers.set('Content-Security-Policy', csp);
  res.headers.set('X-Content-Type-Options', 'nosniff');
  const isSensitive = res.headers.get('location')?.includes('reset') || false;
  res.headers.set(
    'Referrer-Policy',
    isSensitive ? 'no-referrer' : 'strict-origin-when-cross-origin'
  );
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
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
        return applySecurityHeaders(NextResponse.next({ request: { headers } }), nonce);
      }

      const loginUrl = new URL('/login', req.url);
      if (pathname !== '/') {
        loginUrl.searchParams.set('from', pathname);
      }
      return applySecurityHeaders(NextResponse.redirect(loginUrl), nonce);
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
        loginUrl.searchParams.set('from', pathname);
        const res = NextResponse.redirect(loginUrl);
        res.cookies.delete('hs_session');
        res.cookies.delete('hs_role');
        return applySecurityHeaders(res, nonce);
      } else {
        // Backend returned a non-200 but was reachable — session invalid/expired
        const loginUrl = new URL('/login', req.url);
        loginUrl.searchParams.set('from', pathname);
        loginUrl.searchParams.set('error', 'auth_unavailable');
        const res = NextResponse.redirect(loginUrl);
        return applySecurityHeaders(res, nonce);
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
        loginUrl.searchParams.set('from', pathname);
        loginUrl.searchParams.set('error', 'auth_unavailable');
        const res = NextResponse.redirect(loginUrl);
        return applySecurityHeaders(res, nonce);
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
        nonce
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
          nonce
        );
      }
    }

    if (userRole === 'company_admin') {
      const isTryingAdmin = pathname === '/admin' || pathname.startsWith('/admin/');

      if (isTryingAdmin) {
        return applySecurityHeaders(
          NextResponse.redirect(new URL('/company', req.url)),
          nonce
        );
      }
    }

    // If session is present but role could not be authorized, redirect to /login
    if (!userRole) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('from', pathname);
      const res = NextResponse.redirect(loginUrl);
      res.cookies.delete('hs_session');
      res.cookies.delete('hs_role');
      return applySecurityHeaders(res, nonce);
    }
  }

  // Set CSP nonce header on request for server components
  const headers = new Headers(req.headers);
  headers.set('x-nonce', nonce);
  const res = NextResponse.next({ request: { headers } });

  return applySecurityHeaders(res, nonce);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
