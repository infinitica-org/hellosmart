import { NextResponse, type NextRequest } from 'next/server';
import { resolveServerApiV1Base } from './lib/api-base-url';
import { DEV_SESSION_STORE } from './lib/session-store';
import { sanitizeRedirectPath } from './lib/safe-redirect';
import { apiSessionCookieHeader, readSessionTokenFromCookies } from './lib/session-cookie';

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
  if (isDev) {
    connectOrigins.add('http://localhost:4000');
    connectOrigins.add('http://127.0.0.1:4000');
  }

  const originsString = Array.from(connectOrigins).join(' ');

  return [
    "default-src 'self'",
    isDev
      ? "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net"
      : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://cdn.jsdelivr.net`,
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    "img-src 'self' data: https:",
    "font-src 'self' data: https: https://cdn.jsdelivr.net",
    isDev
      ? `connect-src 'self' ${originsString} ws: wss: http: https:`
      : `connect-src 'self' ${originsString}`,
    "worker-src 'self' blob:",
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

type SessionRoleLookup =
  | { kind: 'authenticated'; role: string }
  | { kind: 'invalid' }
  | { kind: 'unavailable' };

function continueWithNonce(req: NextRequest, nonce: string, pathname: string): NextResponse {
  const headers = new Headers(req.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', buildCspDirectives(nonce));
  return applySecurityHeaders(NextResponse.next({ request: { headers } }), nonce, pathname);
}

function redirectToLogin(
  req: NextRequest,
  nonce: string,
  pathname: string,
  options?: { clearSession?: boolean; error?: string },
): NextResponse {
  const loginUrl = new URL('/login', req.url);
  const cleanFrom = sanitizeRedirectPath(pathname) || pathname;
  loginUrl.searchParams.set('from', cleanFrom);
  if (options?.error) {
    loginUrl.searchParams.set('error', options.error);
  }
  const res = NextResponse.redirect(loginUrl);
  if (options?.clearSession) {
    res.cookies.delete('hs_session');
    res.cookies.delete('hs_role');
  }
  return applySecurityHeaders(res, nonce, pathname);
}

async function lookupSessionRole(
  sessionToken: string,
  apiV1Base: string,
): Promise<SessionRoleLookup> {
  // Fast-path for testing & local development fixtures in DEV_SESSION_STORE
  if (
    (process.env.NODE_ENV === 'test' ||
      (process.env.NODE_ENV === 'development' && process.env.ENABLE_DEV_ACCOUNTS === 'true')) &&
    DEV_SESSION_STORE.has(sessionToken)
  ) {
    const devSession = DEV_SESSION_STORE.get(sessionToken);
    if (devSession) {
      return { kind: 'authenticated', role: devSession.role };
    }
  }

  const timeoutsMs = [3_000, 6_000];

  for (const timeoutMs of timeoutsMs) {
    try {
      const meRes = await fetch(`${apiV1Base}/me`, {
        headers: {
          Cookie: apiSessionCookieHeader(sessionToken),
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (meRes.ok) {
        const me = (await meRes.json().catch(() => null)) as { role?: string } | null;
        if (me?.role) {
          return { kind: 'authenticated', role: me.role };
        }
        continue;
      }

      if (meRes.status === 401 || meRes.status === 403) {
        return { kind: 'invalid' };
      }
    } catch {
      // Retry with a longer timeout when the API is busy (e.g. after MFA setup calls).
    }
  }

  return { kind: 'unavailable' };
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const nonce = btoa(crypto.randomUUID());
  const { pathname } = req.nextUrl;

  // Signed-in users hitting marketing home go to their portal (session cookie stays valid).
  if (pathname === '/') {
    const sessionToken = readSessionTokenFromCookies(req);
    if (sessionToken) {
      const apiV1Base = resolveServerApiV1Base();
      try {
        const meRes = await fetch(`${apiV1Base}/me`, {
          headers: {
            Cookie: apiSessionCookieHeader(sessionToken),
          },
          cache: 'no-store',
          signal: AbortSignal.timeout(1500),
        });
        if (meRes.ok) {
          const me = (await meRes.json().catch(() => null)) as { portal?: string } | null;
          const portalPath =
            me?.portal === 'admin'
              ? '/admin'
              : me?.portal === 'company'
                ? '/company'
                : me?.portal === 'candidate'
                  ? '/candidate'
                  : null;
          if (portalPath) {
            return applySecurityHeaders(
              NextResponse.redirect(new URL(portalPath, req.url)),
              nonce,
              pathname,
            );
          }
        }
      } catch {
        // Landing stays public if API is unreachable.
      }
    }
  }

  // 1. Check incoming requests for protected portals
  const matchedPortal = PROTECTED_PORTALS.find(
    (portal) => pathname === portal || pathname.startsWith(`${portal}/`)
  );

  if (matchedPortal) {
    // 2. Read hs_session cookie. If missing, redirect to /login
    const sessionToken = readSessionTokenFromCookies(req);

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
    const apiV1Base = resolveServerApiV1Base();
    const lookup = await lookupSessionRole(sessionToken, apiV1Base);

    if (lookup.kind === 'invalid') {
      return redirectToLogin(req, nonce, pathname, { clearSession: true });
    }

    let userRole: string | null = lookup.kind === 'authenticated' ? lookup.role : null;
    let deferRoleEnforcement = false;

    if (lookup.kind === 'unavailable') {
      const devFallbackEnabled =
        (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') &&
        process.env.ENABLE_DEV_ACCOUNTS === 'true';

      if (devFallbackEnabled) {
        userRole = DEV_SESSION_STORE.get(sessionToken)?.role ?? null;
      }

      if (
        !userRole &&
        (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test')
      ) {
        // Real API session but /me could not be verified (timeout/busy API). Keep the cookie;
        // BFF routes and the API still enforce auth on mutations.
        deferRoleEnforcement = true;
      } else if (!userRole) {
        return redirectToLogin(req, nonce, pathname, { error: 'auth_unavailable' });
      }
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

    if (deferRoleEnforcement) {
      return continueWithNonce(req, nonce, pathname);
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

    // Dev-only mock tokens missing from the in-memory store should not wipe real API sessions.
    if (!userRole) {
      return redirectToLogin(req, nonce, pathname, { clearSession: true });
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
