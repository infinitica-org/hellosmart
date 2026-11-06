import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/server-auth';
import { resolveServerApiV1Base } from '@/lib/api-base-url';
import { readSessionTokenFromCookies } from '@/lib/session-cookie';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await requirePlatformAdmin(req);
  if (!auth.authorized) {
    return auth.errorResponse;
  }

  const apiV1Base = resolveServerApiV1Base();
  const sessionToken = readSessionTokenFromCookies(req);

  const searchParams = req.nextUrl.searchParams.toString();
  const targetUrl = `${apiV1Base}/admin/audit${searchParams ? `?${searchParams}` : ''}`;

  try {
    const upstreamRes = await fetch(targetUrl, {
      headers: {
        Cookie: `hs_session=${sessionToken}`,
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });

    if (!upstreamRes.ok) {
      const errorData = await upstreamRes.json().catch(() => ({
        detail: `Upstream audit request failed with status ${upstreamRes.status}`,
      }));
      return NextResponse.json(errorData, { status: upstreamRes.status });
    }

    const data = await upstreamRes.json();
    return NextResponse.json(data);
  } catch (err: any) {
    // In dev / test offline fallback
    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
      return NextResponse.json({
        items: [],
        total: 0,
        page: 1,
        page_size: 25,
        total_pages: 0,
      });
    }

    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Bad Gateway',
        status: 502,
        detail: `Failed to reach upstream audit service: ${err.message}`,
      },
      { status: 502 },
    );
  }
}
