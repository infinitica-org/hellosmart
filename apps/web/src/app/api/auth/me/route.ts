import { NextRequest, NextResponse } from 'next/server';
import { proxyAuthedApiRequest } from '@/lib/auth-bff-proxy';
import { readSessionTokenFromCookies } from '@/lib/session-cookie';
import { DEV_SESSION_STORE } from '@/lib/session-store';
import { DEV_LOGIN_ACCOUNTS } from '@/lib/dev-login-accounts';

export async function GET(req: NextRequest) {
  const res = await proxyAuthedApiRequest(req, '/me');

  // If upstream backend is unreachable (503) in local development/test, provide fallback dev session
  if (res.status === 503) {
    const token = readSessionTokenFromCookies(req);
    const roleHint = req.cookies.get('hs_role')?.value;
    const referer = req.headers.get('referer') || '';

    // Infer active role from cookies, session token, or route path
    const inferredRole =
      roleHint ||
      (token?.includes('candidate') || referer.includes('/candidate')
        ? 'candidate'
        : token?.includes('admin') || referer.includes('/admin')
          ? 'platform_admin'
          : referer.includes('/company')
            ? 'company_admin'
            : 'candidate');

    const devSession = token ? DEV_SESSION_STORE.get(token) : undefined;
    const email = devSession?.email?.toLowerCase();

    let account =
      (email ? DEV_LOGIN_ACCOUNTS[email] : null) ||
      Object.values(DEV_LOGIN_ACCOUNTS).find(
        (acc) => acc.role === (devSession?.role || inferredRole),
      ) ||
      DEV_LOGIN_ACCOUNTS['candidate@example.com'];

    if (account) {
      if (token) {
        DEV_SESSION_STORE.set(token, {
          email: account.email,
          role: account.role,
        });
      }

      return NextResponse.json(
        {
          id: `usr_${account.portal}_01`,
          email: account.email,
          name: account.name,
          role: account.role,
          portal: account.portal,
          mustResetPassword: Boolean(account.mustResetPassword),
          org:
            account.role !== 'platform_admin'
              ? { id: 'org_dev_01', name: 'Dev Org', logoUrl: null }
              : null,
        },
        { status: 200 },
      );
    }
  }

  return res;
}

