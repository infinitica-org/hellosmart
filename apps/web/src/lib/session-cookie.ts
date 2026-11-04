import type { NextRequest } from 'next/server';

export const COOKIE_SESSION_NAME = 'hs_session';
export const COOKIE_HOST_SESSION_NAME = '__Host-hs_session';

export function readSessionTokenFromCookies(req: NextRequest): string | undefined {
  const host = req.cookies.get(COOKIE_HOST_SESSION_NAME)?.value?.trim();
  if (host) {
    return host;
  }
  const regular = req.cookies.get(COOKIE_SESSION_NAME)?.value?.trim();
  return regular || undefined;
}

/** Forward the opaque token as cookies the API SessionGuard will accept. Never send Bearer. */
export function apiSessionCookieHeader(token: string): string {
  return `${COOKIE_HOST_SESSION_NAME}=${token}; ${COOKIE_SESSION_NAME}=${token}`;
}
