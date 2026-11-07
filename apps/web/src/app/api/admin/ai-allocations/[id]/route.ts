import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/server-auth';
import { resolveServerApiV1Base } from '@/lib/api-base-url';
import { readSessionTokenFromCookies } from '@/lib/session-cookie';
import {
  getCreditAllocationById,
  adjustCreditAllocation,
} from '@/lib/ai-vault-data';
import { AdjustCreditAllocationDtoSchema } from '@hs/contracts';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const auth = await requirePlatformAdmin(req);
  if (!auth.authorized) {
    return auth.errorResponse;
  }

  const { id } = await params;
  const apiV1Base = resolveServerApiV1Base();
  const sessionToken = readSessionTokenFromCookies(req);

  try {
    const upstreamRes = await fetch(`${apiV1Base}/admin/ai-allocations/${encodeURIComponent(id)}`, {
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

      const localAllocation = getCreditAllocationById(id);
      if (!localAllocation) {
        return NextResponse.json(
          {
            type: 'about:blank',
            title: 'Not Found',
            status: 404,
            detail: `Credit allocation "${id}" not found`,
          },
          { status: 404 },
        );
      }
      return NextResponse.json(localAllocation);
    }

    const data = await upstreamRes.json();
    return NextResponse.json(data);
  } catch (err: any) {
    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
      const localAllocation = getCreditAllocationById(id);
      if (!localAllocation) {
        return NextResponse.json(
          {
            type: 'about:blank',
            title: 'Not Found',
            status: 404,
            detail: `Credit allocation "${id}" not found`,
          },
          { status: 404 },
        );
      }
      return NextResponse.json(localAllocation);
    }

    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Service Unavailable',
        status: 503,
        detail: `Failed to reach upstream credit allocations service: ${err.message}`,
      },
      { status: 503 },
    );
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
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

  const parsed = AdjustCreditAllocationDtoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Validation Error',
        status: 422,
        detail: 'Invalid adjustment payload',
        errors: parsed.error.issues,
      },
      { status: 422 },
    );
  }

  const apiV1Base = resolveServerApiV1Base();
  const sessionToken = readSessionTokenFromCookies(req);

  try {
    const upstreamRes = await fetch(`${apiV1Base}/admin/ai-allocations/${encodeURIComponent(id)}`, {
      method: 'PATCH',
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
      const isTestOrDev =
        process.env.NODE_ENV === 'test' ||
        process.env.NODE_ENV === 'development';
      if (!isTestOrDev) {
        const errorData = await upstreamRes.json().catch(() => ({
          detail: `Upstream allocation adjustment failed with status ${upstreamRes.status}`,
        }));
        return NextResponse.json(errorData, { status: upstreamRes.status });
      }

      try {
        const updated = adjustCreditAllocation(id, parsed.data);
        return NextResponse.json(updated);
      } catch (mockErr: any) {
        return NextResponse.json(
          {
            type: 'about:blank',
            title: 'Bad Request',
            status: 400,
            detail: mockErr.message,
          },
          { status: 400 },
        );
      }
    }

    const data = await upstreamRes.json();
    return NextResponse.json(data);
  } catch (err: any) {
    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
      try {
        const updated = adjustCreditAllocation(id, parsed.data);
        return NextResponse.json(updated);
      } catch (mockErr: any) {
        return NextResponse.json(
          {
            type: 'about:blank',
            title: 'Bad Request',
            status: 400,
            detail: mockErr.message,
          },
          { status: 400 },
        );
      }
    }

    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Service Unavailable',
        status: 503,
        detail: `Failed to reach upstream credit allocations service: ${err.message}`,
      },
      { status: 503 },
    );
  }
}
