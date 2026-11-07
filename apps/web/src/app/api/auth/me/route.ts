import { NextRequest, NextResponse } from 'next/server';
import { proxyAuthedApiRequest } from '@/lib/auth-bff-proxy';
import { readSessionTokenFromCookies } from '@/lib/session-cookie';
import { DEV_SESSION_STORE } from '@/lib/session-store';
import { DEV_LOGIN_ACCOUNTS } from '@/lib/dev-login-accounts';

export async function GET(req: NextRequest) {
  const res = await proxyAuthedApiRequest(req, '/me');

  // If upstream backend is unreachable (503) in local development/test, fallback to dev session store
  if (
    res.status === 503 &&
    (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test')
  ) {
    const token = readSessionTokenFromCookies(req);
    const roleHint = req.cookies.get('hs_role')?.value;

    if (token) {
      const devSession = DEV_SESSION_STORE.get(token);
      const email = devSession?.email?.toLowerCase();
      const account =
        (email ? DEV_LOGIN_ACCOUNTS[email] : null) ||
        Object.values(DEV_LOGIN_ACCOUNTS).find(
          (acc) => acc.role === (devSession?.role || roleHint),
        );

      if (account) {
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
  }

  return res;
}

