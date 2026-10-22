import { NextResponse, type NextRequest } from 'next/server';

// Per-request CSP nonce + coarse route isolation (BR-25). The API is still the authority.
const PORTAL_PREFIX: Record<string, string> = {
  '/admin': 'platform_admin',
  '/company': 'company_admin',
  '/candidate': 'candidate',
};

export function middleware(req: NextRequest): NextResponse {
  const nonce = btoa(crypto.randomUUID());
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

  const role = req.cookies.get('hs_role')?.value; // non-sensitive routing hint; API re-verifies
  const prefix = Object.keys(PORTAL_PREFIX).find((p) => req.nextUrl.pathname.startsWith(p));
  if (prefix && role !== PORTAL_PREFIX[prefix]) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const headers = new Headers(req.headers);
  headers.set('x-nonce', nonce);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set('Content-Security-Policy', csp);
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return res;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
