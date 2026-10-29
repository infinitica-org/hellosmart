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

    const match = raw.match(/(?:^|,\s*)(?:__Host-)?hs_session=([^;]+)/i);
    if (!match?.[1]) {
      continue;
    }

    let value = match[1].trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }

    const maxAgeMatch = raw.match(/Max-Age=(\d+)/i);
    const cookieOptions: Parameters<NextResponse['cookies']['set']>[2] = {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    };
    if (maxAgeMatch?.[1]) {
      cookieOptions.maxAge = Number.parseInt(maxAgeMatch[1], 10);
    }

    res.cookies.set('hs_session', value, cookieOptions);
  }
}
