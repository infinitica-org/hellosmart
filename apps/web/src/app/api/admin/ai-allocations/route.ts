import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/server-auth';
import { resolveServerApiV1Base } from '@/lib/api-base-url';
import { readSessionTokenFromCookies } from '@/lib/session-cookie';
import { getCreditAllocations, createCreditAllocation } from '@/lib/ai-vault-data';
import { CreateCreditAllocationDtoSchema } from '@hs/contracts';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await requirePlatformAdmin(req);
  if (!auth.authorized) {
    return auth.errorResponse;
  }

  const apiV1Base = resolveServerApiV1Base();
  const sessionToken = readSessionTokenFromCookies(req);

  const searchParams = req.nextUrl.searchParams.toString();
  const targetUrl = `${apiV1Base}/admin/ai-allocations${searchParams ? `?${searchParams}` : ''}`;

  const orgId = req.nextUrl.searchParams.get('orgId') || undefined;
  const platformKeyId = req.nextUrl.searchParams.get('platformKeyId') || undefined;
  const status = req.nextUrl.searchParams.get('status') || undefined;

  const filter: { orgId?: string; platformKeyId?: string; status?: string } = {};
  if (orgId) filter.orgId = orgId;
  if (platformKeyId) filter.platformKeyId = platformKeyId;
  if (status) filter.status = status;

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
      const isTestOrDev =
        process.env.NODE_ENV === 'test' ||
        process.env.NODE_ENV === 'development';
      if (!isTestOrDev) {
        const errorData = await upstreamRes.json().catch(() => ({
          detail: `Upstream request failed with status ${upstreamRes.status}`,
        }));
        return NextResponse.json(errorData, { status: upstreamRes.status });
      }
      return NextResponse.json(getCreditAllocations(filter));
    }

    const data = await upstreamRes.json();
    return NextResponse.json(data);
  } catch (err: any) {
    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
      return NextResponse.json(getCreditAllocations(filter));
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

export async function POST(req: NextRequest): Promise<NextResponse> {
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

  const parsed = CreateCreditAllocationDtoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Validation Error',
        status: 422,
        detail: 'Invalid credit allocation payload',
        errors: parsed.error.issues,
      },
      { status: 422 },
    );
  }

  const apiV1Base = resolveServerApiV1Base();
  const sessionToken = readSessionTokenFromCookies(req);

  try {
    const upstreamRes = await fetch(`${apiV1Base}/admin/ai-allocations`, {
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
      const isTestOrDev =
        process.env.NODE_ENV === 'test' ||
        process.env.NODE_ENV === 'development';
      if (!isTestOrDev) {
        const errorData = await upstreamRes.json().catch(() => ({
          detail: `Upstream allocation creation failed with status ${upstreamRes.status}`,
        }));
        return NextResponse.json(errorData, { status: upstreamRes.status });
      }
      try {
        const created = createCreditAllocation(parsed.data, auth.session.id);
        return NextResponse.json(created, { status: 201 });
      } catch (mockErr: any) {
        return NextResponse.json(
          {
            type: 'about:blank',
            title: 'Conflict',
            status: 409,
            detail: mockErr.message,
          },
          { status: 409 },
        );
      }
    }

    const data = await upstreamRes.json();
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
      try {
        const created = createCreditAllocation(parsed.data, auth.session.id);
        return NextResponse.json(created, { status: 201 });
      } catch (mockErr: any) {
        return NextResponse.json(
          {
            type: 'about:blank',
            title: 'Conflict',
            status: 409,
            detail: mockErr.message,
          },
          { status: 409 },
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
