import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/server-auth';
import { resolveServerApiV1Base } from '@/lib/api-base-url';
import { readSessionTokenFromCookies } from '@/lib/session-cookie';
import { destroyMockWorkspace } from '@/lib/workspaces-data';
import { EmergencyDestroyWorkspaceDtoSchema } from '@hs/contracts';
import { z } from 'zod';

const uuidParamSchema = z.string().uuid();

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const auth = await requirePlatformAdmin(req);
  if (!auth.authorized) {
    return auth.errorResponse;
  }

  // Enforce CSRF protection on destructive kill-switch mutation
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        detail: 'Invalid JSON request body',
      },
      { status: 400 },
    );
  }

  const parsed = EmergencyDestroyWorkspaceDtoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Validation Error',
        status: 422,
        detail: 'Invalid emergency destroy payload',
        errors: parsed.error.issues,
      },
      { status: 422 },
    );
  }

  const apiV1Base = resolveServerApiV1Base();
  const sessionToken = readSessionTokenFromCookies(req);

  try {
    const upstreamRes = await fetch(`${apiV1Base}/admin/workspaces/${id}/destroy`, {
      method: 'POST',
      headers: {
        Cookie: `hs_session=${sessionToken}`,
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
        'X-HS-CSRF': '1',
      },
      body: JSON.stringify(parsed.data),
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
      try {
        const mockResult = destroyMockWorkspace(id, parsed.data.reason);
        if (!mockResult) {
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
        return NextResponse.json(mockResult, {
          headers: { 'x-hellosmart-mock': 'true' },
        });
      } catch (mockErr: any) {
        if (mockErr.message === 'WORKSPACE_ALREADY_TERMINATED') {
          return NextResponse.json(
            {
              type: 'about:blank',
              title: 'Conflict',
              status: 409,
              detail: 'Workspace is already terminated',
              code: 'WORKSPACE_ALREADY_TERMINATED',
            },
            { status: 409 },
          );
        }
      }
    }

    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Service Unavailable',
        status: 503,
        detail: `Failed to execute emergency workspace destroy: ${err.message}`,
      },
      { status: 503 },
    );
  }
}

