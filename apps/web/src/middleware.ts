import { NextResponse, type NextRequest } from 'next/server';

// Portal route mappings and expected role authorization (BR-25)
const PORTAL_PREFIX: Record<string, string> = {
  '/admin': 'platform_admin',
  '/company': 'company_admin',
  '/candidate': 'candidate',
};

function applySecurityHeaders(res: NextResponse, nonce: string): NextResponse {
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self'",
    'frame-src https://cal.com https://api.razorpay.com',
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  res.headers.set('Content-Security-Policy', csp);
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return res;
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const nonce = btoa(crypto.randomUUID());
  const prefix = Object.keys(PORTAL_PREFIX).find((p) => req.nextUrl.pathname.startsWith(p));
  const expectedRole = prefix ? PORTAL_PREFIX[prefix] : undefined;

  // Protected portal route requires real server-side session and role verification
  if (expectedRole) {
    const sessionToken = req.cookies.get('hs_session')?.value;

    if (!sessionToken) {
      const loginUrl = new URL('/login', req.url);
      if (req.nextUrl.pathname !== '/') {
        loginUrl.searchParams.set('from', req.nextUrl.pathname);
      }
      return applySecurityHeaders(NextResponse.redirect(loginUrl), nonce);
    }

    // Verify session and role against the authority API (/me, CO-004)
    const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:4000';
    try {
      const meRes = await fetch(`${apiBaseUrl}/me`, {
        headers: {
          Cookie: `hs_session=${sessionToken}`,
          Authorization: `Bearer ${sessionToken}`,
        },
        cache: 'no-store',
      });

      if (!meRes.ok) {
        // Session invalid or expired: clear cookie and redirect to login
        const loginUrl = new URL('/login', req.url);
        loginUrl.searchParams.set('from', req.nextUrl.pathname);
        const res = NextResponse.redirect(loginUrl);
        res.cookies.delete('hs_session');
        res.cookies.delete('hs_role');
        return applySecurityHeaders(res, nonce);
      }

      const me = await meRes.json();

      // Enforce strict route isolation (BR-25): candidate sessions cannot reach company or admin
      if (me.role !== expectedRole) {
        const targetPortal = me.portal
          ? `/${me.portal}`
          : me.role === 'platform_admin'
            ? '/admin'
            : me.role === 'candidate'
              ? '/candidate'
              : '/company';
        return applySecurityHeaders(NextResponse.redirect(new URL(targetPortal, req.url)), nonce);
      }
    } catch {
      // Fail closed: if auth cannot be verified with the server, do not grant access
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('from', req.nextUrl.pathname);
      return applySecurityHeaders(NextResponse.redirect(loginUrl), nonce);
    }
  }

  // Set CSP nonce header on request for server components
  const headers = new Headers(req.headers);
  headers.set('x-nonce', nonce);
  const res = NextResponse.next({ request: { headers } });

  return applySecurityHeaders(res, nonce);
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
