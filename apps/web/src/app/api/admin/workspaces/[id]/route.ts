import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/server-auth';
import { resolveServerApiV1Base } from '@/lib/api-base-url';
import { readSessionTokenFromCookies } from '@/lib/session-cookie';
import { getMockWorkspaceDetail } from '@/lib/workspaces-data';
import { z } from 'zod';

const uuidParamSchema = z.string().uuid();

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const auth = await requirePlatformAdmin(req);
  if (!auth.authorized) {
    return auth.errorResponse;
  }

  const { id } = params;
  const parsedId = uuidParamSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Validation Error',
        status: 422,
        detail: 'Workspace ID must be a valid UUID',
      },
      { status: 422 },
    );
  }

  const apiV1Base = resolveServerApiV1Base();
  const sessionToken = readSessionTokenFromCookies(req);

  try {
    const upstreamRes = await fetch(`${apiV1Base}/admin/workspaces/${id}`, {
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
      const mock = getMockWorkspaceDetail(id);
      if (!mock) {
        return NextResponse.json(
          {
            type: 'about:blank',
            title: 'Not Found',
            status: 404,
            detail: `Workspace with id "${id}" was not found`,
            code: 'WORKSPACE_NOT_FOUND',
          },
          { status: 404 },
        );
      }
      return NextResponse.json(mock, { headers: { 'x-hellosmart-mock': 'true' } });
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

