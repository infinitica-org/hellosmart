import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/server-auth';
import { resolveServerApiV1Base } from '@/lib/api-base-url';
import { readSessionTokenFromCookies } from '@/lib/session-cookie';
import { getMockWorkspacesList } from '@/lib/workspaces-data';
import { AdminWorkspaceQueryDtoSchema } from '@hs/contracts';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await requirePlatformAdmin(req);
  if (!auth.authorized) {
    return auth.errorResponse;
  }

  const { searchParams } = new URL(req.url);
  const rawQuery = {
    org_id: searchParams.get('org_id') || undefined,
    status: searchParams.get('status') || undefined,
    mode: searchParams.get('mode') || undefined,
    search: searchParams.get('search') || undefined,
    page: searchParams.get('page') ? Number(searchParams.get('page')) : undefined,
    page_size: searchParams.get('page_size')
      ? Number(searchParams.get('page_size'))
      : undefined,
  };

  const parsed = AdminWorkspaceQueryDtoSchema.safeParse(rawQuery);
  const query = parsed.success ? parsed.data : {};

  const apiV1Base = resolveServerApiV1Base();
  const sessionToken = readSessionTokenFromCookies(req);

  const forwardParams = new URLSearchParams();
  if (query.org_id) forwardParams.set('org_id', query.org_id);
  if (query.status) forwardParams.set('status', query.status);
  if (query.mode) forwardParams.set('mode', query.mode);
  if (query.search) forwardParams.set('search', query.search);
  if (query.page) forwardParams.set('page', String(query.page));
  if (query.page_size) forwardParams.set('page_size', String(query.page_size));

  const queryString = forwardParams.toString();
  const upstreamUrl = `${apiV1Base}/admin/workspaces${queryString ? `?${queryString}` : ''}`;

  try {
    const upstreamRes = await fetch(upstreamUrl, {
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
        type: 'about:blank',
        title: upstreamRes.status >= 500 ? 'Bad Gateway' : 'Upstream Error',
        status: upstreamRes.status,
        detail: `Upstream request failed with status ${upstreamRes.status}`,
      }));
      return NextResponse.json(errorData, { status: upstreamRes.status });
    }

    const data = await upstreamRes.json();
    return NextResponse.json(data);
  } catch (err: any) {
    // Fail closed in production; never return mock workspace data as if it were live platform data
    if (
      process.env.NODE_ENV !== 'production' &&
      (process.env.NODE_ENV === 'test' || process.env.ENABLE_DEV_MOCKS === 'true')
    ) {
      return NextResponse.json(getMockWorkspacesList(query), {
        headers: { 'x-hellosmart-mock': 'true' },
      });
    }

    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Service Unavailable',
        status: 503,
        detail: `Failed to reach upstream workspace service: ${err.message}`,
      },
      { status: 503 },
    );
  }
}

