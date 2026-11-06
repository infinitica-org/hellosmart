import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/server-auth';
import { resolveServerApiV1Base } from '@/lib/api-base-url';
import { readSessionTokenFromCookies } from '@/lib/session-cookie';
import { testPlatformAiKey } from '@/lib/ai-vault-data';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const auth = await requirePlatformAdmin(req);
  if (!auth.authorized) {
    return auth.errorResponse;
  }

  // Enforce CSRF protection on mutation
  const csrfHeader = req.headers.get('x-hs-csrf');
  if (csrfHeader !== '1') {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Forbidden',
        status: 403,
        detail: 'Missing or invalid CSRF token (X-HS-CSRF: 1 required)',
      },
      { status: 403 },
    );
  }

  const { id } = await params;
  const apiV1Base = resolveServerApiV1Base();
  const sessionToken = readSessionTokenFromCookies(req);

  try {
    const upstreamRes = await fetch(`${apiV1Base}/admin/ai-keys/${encodeURIComponent(id)}/test`, {
      method: 'POST',
      headers: {
        Cookie: `hs_session=${sessionToken}`,
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
        'X-HS-CSRF': '1',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    });

    if (!upstreamRes.ok) {
      const isTestOrDev =
        process.env.NODE_ENV === 'test' ||
        process.env.NODE_ENV === 'development';
      if (!isTestOrDev) {
        const errorData = await upstreamRes.json().catch(() => ({
          detail: `Upstream key test failed with status ${upstreamRes.status}`,
        }));
        return NextResponse.json(errorData, { status: upstreamRes.status });
      }

      try {
        const testResult = testPlatformAiKey(id);
        return NextResponse.json(testResult);
      } catch (mockErr: any) {
        return NextResponse.json(
          {
            type: 'about:blank',
            title: 'Not Found',
            status: 404,
            detail: mockErr.message,
          },
          { status: 404 },
        );
      }
    }

    const data = await upstreamRes.json();
    return NextResponse.json(data);
  } catch (err: any) {
    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
      try {
        const testResult = testPlatformAiKey(id);
        return NextResponse.json(testResult);
      } catch (mockErr: any) {
        return NextResponse.json(
          {
            type: 'about:blank',
            title: 'Not Found',
            status: 404,
            detail: mockErr.message,
          },
          { status: 404 },
        );
      }
    }

    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Service Unavailable',
        status: 503,
        detail: `Failed to reach upstream AI key vault service: ${err.message}`,
      },
      { status: 503 },
    );
  }
}
