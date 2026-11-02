import type { NextResponse } from 'next/server';

/**
 * Copies hs_session from an upstream API Set-Cookie header onto the Next.js BFF response.
 * Node fetch often exposes a single combined Set-Cookie; NextResponse.cookies.set is more reliable than append.
 */
export function forwardApiSessionCookie(apiRes: Response, res: NextResponse): void {
  const rawCookies: string[] =
    typeof apiRes.headers.getSetCookie === 'function' ? apiRes.headers.getSetCookie() : [];

  if (rawCookies.length === 0) {
    const single = apiRes.headers.get('set-cookie');
    if (single) {
      rawCookies.push(single);
    }
  }

  for (const raw of rawCookies) {
    res.headers.append('set-cookie', raw);

    const match = raw.match(/(?:^|,\s*)(?:__Host-)?hs_session=([^;]*)/i);
    if (!match) {
      continue;
    }

    let value = (match[1] || '').trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }

    const maxAgeMatch = raw.match(/Max-Age=(-?\d+)/i);
    const maxAge = maxAgeMatch?.[1] ? Number.parseInt(maxAgeMatch[1], 10) : undefined;
    const isExpired =
      value === '' ||
      value === 'deleted' ||
      maxAge === 0 ||
      (maxAge !== undefined && maxAge < 0) ||
      raw.toLowerCase().includes('expires=thu, 01 jan 1970');

    if (isExpired) {
      res.cookies.delete('hs_session');
      continue;
    }

    const cookieOptions: Parameters<NextResponse['cookies']['set']>[2] = {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    };
    if (maxAge !== undefined) {
      cookieOptions.maxAge = maxAge;
    }

    res.cookies.set('hs_session', value, cookieOptions);
  }
}
