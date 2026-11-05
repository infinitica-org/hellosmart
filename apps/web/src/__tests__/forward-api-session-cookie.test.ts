import { describe, it, expect } from 'vitest';
import { NextResponse, NextRequest } from 'next/server';
import { forwardApiSessionCookie } from '../lib/forward-api-session-cookie';
import { POST as logoutAllPOST } from '../app/api/auth/logout-all/route';

describe('forwardApiSessionCookie (BUG-05)', () => {
  it('forwards valid session cookie with options onto NextResponse', () => {
    const apiRes = new Response(null, {
      headers: {
        'set-cookie': 'hs_session=token_abc_123; Path=/; Max-Age=3600; HttpOnly; SameSite=Lax',
      },
    });
    const res = NextResponse.json({ success: true });

    forwardApiSessionCookie(apiRes, res);

    const cookie = res.cookies.get('hs_session');
    expect(cookie).toBeDefined();
    expect(cookie?.value).toBe('token_abc_123');
  });

  it('unwraps quoted cookie values', () => {
    const apiRes = new Response(null, {
      headers: {
        'set-cookie': 'hs_session="quoted_token_val"; Path=/',
      },
    });
    const res = NextResponse.json({ success: true });

    forwardApiSessionCookie(apiRes, res);

    const cookie = res.cookies.get('hs_session');
    expect(cookie?.value).toBe('quoted_token_val');
  });

  it('deletes cookie when upstream sends expired cookie with empty value (BUG-05)', () => {
    const apiRes = new Response(null, {
      headers: {
        'set-cookie': 'hs_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly',
      },
    });
    const res = NextResponse.json({ success: true });
    // Pre-populate cookie
    res.cookies.set('hs_session', 'pre_existing_session');

    forwardApiSessionCookie(apiRes, res);

    // Cookie must be deleted or expired
    const cookieHeader = res.headers.get('set-cookie');
    expect(cookieHeader).toBeDefined();
    expect(cookieHeader).toMatch(/hs_session=(?:;|deleted|\b)/);
  });

  it('deletes cookie when upstream sends Max-Age=0 (BUG-05)', () => {
    const apiRes = new Response(null, {
      headers: {
        'set-cookie': 'hs_session=token; Path=/; Max-Age=0',
      },
    });
    const res = NextResponse.json({ success: true });
    res.cookies.set('hs_session', 'pre_existing_session');

    forwardApiSessionCookie(apiRes, res);

    const cookieHeader = res.headers.get('set-cookie');
    expect(cookieHeader).toMatch(/hs_session=(?:;|deleted|\b)/);
  });
});

describe('Logout-All API Route (BUG-05)', () => {
  it('clears hs_session, hs_role, and hs_must_reset cookies on logout-all', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/logout-all', {
      method: 'POST',
      headers: {
        cookie: 'hs_session=test_token; hs_role=platform_admin; hs_must_reset=true',
      },
    });

    const res = await logoutAllPOST(req);
    expect(res.status).toBe(200);

    const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')];
    const joined = setCookies.join(';');

    expect(joined).toContain('hs_session=');
    expect(joined).toContain('hs_role=');
    expect(joined).toContain('hs_must_reset=');
  });
});
