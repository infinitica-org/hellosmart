import type { FastifyRequest } from 'fastify';

export const COOKIE_SESSION_NAME = 'hs_session';
export const COOKIE_HOST_SESSION_NAME = '__Host-hs_session';

export function parseCookieHeader(header: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const part of header.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx !== -1) {
      const key = part.slice(0, eqIdx).trim();
      const val = part.slice(eqIdx + 1).trim();
      try {
        map[key] = decodeURIComponent(val);
      } catch {
        map[key] = val;
      }
    }
  }
  return map;
}

function firstNonEmpty(...values: Array<string | undefined | null>): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

/** Cookie-only session token. Authorization: Bearer is never accepted (BR-25). */
export function extractRawSessionToken(request: FastifyRequest): string | undefined {
  const cookies = request.cookies || (request.raw as { cookies?: Record<string, string> })?.cookies || {};
  let hostCookie = cookies[COOKIE_HOST_SESSION_NAME];
  let regularCookie = cookies[COOKIE_SESSION_NAME];

  if (!hostCookie && !regularCookie && typeof request.headers.cookie === 'string') {
    const parsed = parseCookieHeader(request.headers.cookie);
    hostCookie = parsed[COOKIE_HOST_SESSION_NAME];
    regularCookie = parsed[COOKIE_SESSION_NAME];
  }

  return firstNonEmpty(hostCookie, regularCookie);
}

export function requestHasSessionCookie(request: FastifyRequest): boolean {
  const cookies = request.cookies || (request.raw as { cookies?: Record<string, string> })?.cookies || {};
  if (cookies[COOKIE_HOST_SESSION_NAME] || cookies[COOKIE_SESSION_NAME]) {
    return true;
  }
  const raw = request.headers.cookie;
  if (typeof raw !== 'string') {
    return false;
  }
  return raw.includes(`${COOKIE_HOST_SESSION_NAME}=`) || raw.includes(`${COOKIE_SESSION_NAME}=`);
}
