import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/server-auth';
import { resolveServerApiV1Base } from '@/lib/api-base-url';
import { readSessionTokenFromCookies } from '@/lib/session-cookie';
import { getAiVaultStats } from '@/lib/ai-vault-data';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await requirePlatformAdmin(req);
  if (!auth.authorized) {
    return auth.errorResponse;
  }

  const apiV1Base = resolveServerApiV1Base();
  const sessionToken = readSessionTokenFromCookies(req);

  try {
    const upstreamRes = await fetch(`${apiV1Base}/admin/ai-vault/stats`, {
      headers: {
        Cookie: `hs_session=${sessionToken}`,
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });

    if (!upstreamRes.ok) {
      const isTestOrDev =
        process.env.NODE_ENV === 'test' ||
        process.env.NODE_ENV === 'development';
      if (!isTestOrDev) {
        const errorData = await upstreamRes.json().catch(() => ({
          detail: `Upstream request failed with status ${upstreamRes.status}`,
        }));
        return NextResponse.json(errorData, { status: upstreamRes.status });
      }
      return NextResponse.json(getAiVaultStats());
    }

    const data = await upstreamRes.json();
    return NextResponse.json(data);
  } catch (err: any) {
    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
      return NextResponse.json(getAiVaultStats());
    }

    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Service Unavailable',
        status: 503,
        detail: `Failed to reach upstream AI vault stats service: ${err.message}`,
      },
      { status: 503 },
    );
  }
}
