import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/server-auth';
import { resolveServerApiV1Base } from '@/lib/api-base-url';
import { readSessionTokenFromCookies } from '@/lib/session-cookie';
import { getOrganizationById } from '@/lib/organizations-data';

export async function GET(
  req: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requirePlatformAdmin(req);
  if (!auth.authorized) {
    return auth.errorResponse;
  }

  const { id } = await Promise.resolve(context.params);
  if (!id) {
    return NextResponse.json(
      { detail: 'Organization ID is required', status: 400 },
      { status: 400 },
    );
  }

  const isTestOrDev =
    process.env.NODE_ENV === 'test' ||
    process.env.ENABLE_DEV_ACCOUNTS === 'true';

  const apiV1Base = resolveServerApiV1Base();
  const sessionToken = readSessionTokenFromCookies(req);

  try {
    const upstreamRes = await fetch(`${apiV1Base}/admin/organizations/${encodeURIComponent(id)}`, {
      headers: {
        Cookie: `hs_session=${sessionToken}`,
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });

    if (upstreamRes.ok) {
      const data = await upstreamRes.json();
      return NextResponse.json(data);
    }

    if (upstreamRes.status === 404) {
      const errData = await upstreamRes.json().catch(() => ({ detail: 'Organization not found' }));
      return NextResponse.json(errData, { status: 404 });
    }

    if (!isTestOrDev) {
      const errData = await upstreamRes.json().catch(() => ({ detail: 'Upstream error' }));
      return NextResponse.json(errData, { status: upstreamRes.status });
    }
  } catch {
    // If backend connectivity fails in production, do not fall back to in-memory store
    if (!isTestOrDev) {
      return NextResponse.json(
        { title: 'Service Unavailable', detail: 'Backend service unreachable', status: 503 },
        { status: 503 },
      );
    }
  }

  // Guard against any unintended fallthrough to in-memory store in production
  if (!isTestOrDev) {
    return NextResponse.json(
      { title: 'Service Unavailable', detail: 'Backend service unreachable', status: 503 },
      { status: 503 },
    );
  }

  try {
    const org = getOrganizationById(id);
    return NextResponse.json(org);
  } catch (err: any) {
    return NextResponse.json(
      { detail: err?.message || 'Organization not found', status: 404 },
      { status: 404 },
    );
  }
}
