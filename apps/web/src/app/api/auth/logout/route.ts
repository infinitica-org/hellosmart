import { NextRequest, NextResponse } from 'next/server';
import { proxyAuthedApiRequest } from '@/lib/auth-bff-proxy';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const proxied = await proxyAuthedApiRequest(req, '/auth/logout', {
    method: 'POST',
    body: '',
  });

  const res =
    proxied.status === 503 || proxied.status === 401
      ? NextResponse.json({ success: true, message: 'Logged out.' }, { status: 200 })
      : proxied;

  res.cookies.delete('hs_session');
  res.cookies.delete('hs_role');
  res.cookies.delete('hs_must_reset');
  return res;
}
