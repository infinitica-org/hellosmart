import { NextResponse, type NextRequest } from 'next/server';

// Per-request CSP nonce + coarse route isolation (BR-25). The API is still the authority.
const PORTAL_PREFIX: Record<string, string> = {
  '/admin': 'platform_admin',
  '/company': 'company_admin',
  '/candidate': 'candidate',
};

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

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
