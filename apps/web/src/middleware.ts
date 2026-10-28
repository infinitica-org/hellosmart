import { NextResponse, type NextRequest } from 'next/server';

// Portal route prefixes requiring authentication & authorization (BR-25)
const PROTECTED_PORTALS = ['/admin', '/company', '/candidate'] as const;


function applySecurityHeaders(res: NextResponse, nonce: string): NextResponse {
  const isDev = process.env.NODE_ENV === 'development';
  const csp = [
    "default-src 'self'",
    isDev
      ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data: https:",
    "connect-src 'self' ws: wss: https:",

export function middleware(req: NextRequest): NextResponse {
  const nonce = btoa(crypto.randomUUID());
  const apiOrigin = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    `connect-src 'self' ${apiOrigin} http://localhost:4000 http://127.0.0.1:4000`,

    'frame-src https://cal.com https://api.razorpay.com',
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');


  const role = req.cookies.get('hs_role')?.value; // non-sensitive routing hint; API re-verifies
  const mustReset = req.cookies.get('hs_must_reset')?.value === 'true';
  const prefix = Object.keys(PORTAL_PREFIX).find((p) => req.nextUrl.pathname.startsWith(p));
  if (prefix) {
    if (mustReset) {
      return NextResponse.redirect(new URL('/login?message=reset_required', req.url));
    }
    if (role !== PORTAL_PREFIX[prefix]) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  const headers = new Headers(req.headers);
  headers.set('x-nonce', nonce);
  const res = NextResponse.next({ request: { headers } });

  res.headers.set('Content-Security-Policy', csp);
  res.headers.set('X-Content-Type-Options', 'nosniff');
  const isInvitePage =
    req.nextUrl.pathname.startsWith('/accept-invite') ||
    req.nextUrl.pathname.startsWith('/set-password');
  res.headers.set('Referrer-Policy', isInvitePage ? 'no-referrer' : 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return res;
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const nonce = btoa(crypto.randomUUID());
  const { pathname } = req.nextUrl;

  // 1. Check incoming requests for /admin/*, /company/*, and /candidate/*
  const matchedPortal = PROTECTED_PORTALS.find(
    (portal) => pathname === portal || pathname.startsWith(`${portal}/`)
  );

  if (matchedPortal) {
    // 2. Read hs_session cookie. If missing, redirect to /login
    const sessionToken = req.cookies.get('hs_session')?.value;

    if (!sessionToken) {
      // Loop safety check: never redirect /login to /login
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

    // 3. Check user role from session
    // Read cached or cookie-provided role first
    let userRole = req.cookies.get('hs_role')?.value;

    // Fallback: infer role if token is encoded with role name
    if (!userRole && sessionToken) {
      if (sessionToken.includes('candidate')) userRole = 'candidate';
      else if (sessionToken.includes('company')) userRole = 'company_admin';
      else if (sessionToken.includes('admin')) userRole = 'platform_admin';
    }

    // 4. Safety check: Query backend /me if available, with a short timeout to prevent
    // hanging, crashing, or creating loops if the backend is offline or restarting locally
    const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:4000';
    try {
      const meRes = await fetch(`${apiBaseUrl}/me`, {
        headers: {
          Cookie: `hs_session=${sessionToken}`,
          Authorization: `Bearer ${sessionToken}`,
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(1000), // 1s safety timeout
      });

      if (meRes.ok) {
        const me = await meRes.json().catch(() => null);
        if (me?.role) {
          userRole = me.role;
        }
      } else if (meRes.status === 401 || meRes.status === 403) {
        // Explicit invalid session rejected by backend: clear session and redirect to /login
        const loginUrl = new URL('/login', req.url);
        loginUrl.searchParams.set('from', pathname);
        const res = NextResponse.redirect(loginUrl);
        res.cookies.delete('hs_session');
        res.cookies.delete('hs_role');
        return applySecurityHeaders(res, nonce);
      }
    } catch {
      // Backend is offline, restarting, or timed out.
      // Gracefully continue using cookie/token role to avoid crashing or infinite loops in dev.
    }

    // Role-based route enforcement:
    // - Candidate tries to visit /admin or /company -> redirect straight to /candidate (BR-25)
    if (userRole === 'candidate') {
      const isTryingRestricted =
        pathname === '/admin' ||
        pathname.startsWith('/admin/') ||
        pathname === '/company' ||
        pathname.startsWith('/company/');

      if (isTryingRestricted) {
        if (pathname !== '/candidate') {
          return applySecurityHeaders(
            NextResponse.redirect(new URL('/candidate', req.url)),
            nonce
          );
        }
      }
    }

    // - Company Admin tries to visit /admin -> redirect to /company
    if (userRole === 'company_admin') {
      const isTryingAdmin = pathname === '/admin' || pathname.startsWith('/admin/');

      if (isTryingAdmin) {
        if (pathname !== '/company') {
          return applySecurityHeaders(
            NextResponse.redirect(new URL('/company', req.url)),
            nonce
          );
        }
      }
    }

    // If session is present but role could not be established at all, redirect to /login
    if (!userRole) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('from', pathname);
      const res = NextResponse.redirect(loginUrl);
      res.cookies.delete('hs_session');
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
