import { NextRequest, NextResponse } from 'next/server';
import { resolveServerApiV1Base } from '@/lib/api-base-url';
import { forwardApiSessionCookie } from '@/lib/forward-api-session-cookie';

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export async function proxyAuthedApiRequest(
  req: NextRequest,
  upstreamPath: string,
  options?: { method?: string; body?: string },
): Promise<NextResponse> {
  const sessionToken = req.cookies.get('hs_session')?.value;
  const apiBase = resolveServerApiV1Base();
  const method = (options?.method ?? req.method).toUpperCase();

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (sessionToken) {
    headers.Cookie = `hs_session=${sessionToken}`;
    headers.Authorization = `Bearer ${sessionToken}`;
  }

  if (STATE_CHANGING.has(method)) {
    headers['X-HS-CSRF'] = '1';
    const appOrigin =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_BASE_URL ||
      'http://localhost:3000';
    headers.Origin = appOrigin.replace(/\/$/, '');
  }

  let body: string | undefined = options?.body;
  if (body === undefined && STATE_CHANGING.has(method)) {
    body = await req.text();
    const contentType = req.headers.get('content-type');
    if (contentType) {
      headers['Content-Type'] = contentType;
    }
  }

  let apiRes: Response;
  try {
    const fetchInit: RequestInit = {
      method,
      headers,
      cache: 'no-store',
    };
    if (body !== undefined && body.length > 0) {
      fetchInit.body = body;
    }
    apiRes = await fetch(`${apiBase}${upstreamPath}`, fetchInit);
  } catch {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Service Unavailable',
        status: 503,
        detail: 'Authentication service is unavailable.',
      },
      { status: 503 },
    );
  }

  const responseText = await apiRes.text();
  const res = new NextResponse(responseText, {
    status: apiRes.status,
    headers: {
      'Content-Type': apiRes.headers.get('content-type') || 'application/json',
    },
  });

  forwardApiSessionCookie(apiRes, res);

  if (
    apiRes.ok &&
    (upstreamPath === '/auth/password/change' ||
      upstreamPath.startsWith('/auth/invitations/accept') ||
      upstreamPath === '/auth/logout' ||
      upstreamPath === '/auth/logout-all')
  ) {
    res.cookies.delete('hs_must_reset');
  }

  return res;
}
