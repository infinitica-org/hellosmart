import { NextRequest, NextResponse } from 'next/server';
import { resolveServerApiV1Base } from '@/lib/api-base-url';
import { forwardApiSessionCookie } from '@/lib/forward-api-session-cookie';
import { validateBffCsrfAndOrigin } from '@/lib/auth-bff-proxy';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const sessionToken = req.cookies.get('hs_session')?.value;
  if (!sessionToken) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Unauthorized',
        status: 401,
        detail: 'Authentication required. Please sign in.',
        code: 'AUTH_REQUIRED',
      },
      { status: 401 },
    );
  }

  const csrfCheck = validateBffCsrfAndOrigin(req);
  if (csrfCheck.errorResponse) {
    return csrfCheck.errorResponse;
  }
  const resolvedOrigin = csrfCheck.validatedOrigin!;

  const apiBase = resolveServerApiV1Base();
  const url = new URL(req.url);
  const search = url.search; // preserves ?assessment_id=...

  // Forward strictly the validated trusted origin, session cookie, and CSRF token
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-HS-CSRF': '1',
    Origin: resolvedOrigin,
    Cookie: `hs_session=${sessionToken}`,
    Authorization: `Bearer ${sessionToken}`,
  };

  const contentType = req.headers.get('content-type');
  if (contentType) {
    headers['Content-Type'] = contentType;
  }

  try {
    // Stream request body directly to Fastify backend with duplex: 'half' (Node.js fetch streaming)
    const fetchInit: RequestInit & { duplex?: 'half' } = {
      method: 'POST',
      headers,
      body: req.body,
      duplex: 'half',
      cache: 'no-store',
    };

    const apiRes = await fetch(`${apiBase}/company/candidates/bulk${search}`, fetchInit);
    const responseText = await apiRes.text();

    const res = new NextResponse(responseText, {
      status: apiRes.status,
      headers: {
        'Content-Type': apiRes.headers.get('content-type') || 'application/json',
      },
    });

    forwardApiSessionCookie(apiRes, res);
    return res;
  } catch {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Service Unavailable',
        status: 503,
        detail: 'Candidate upload service is unavailable.',
      },
      { status: 503 },
    );
  }
}
