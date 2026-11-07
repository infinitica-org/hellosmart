import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/server-auth';
import { resolveServerApiV1Base } from '@/lib/api-base-url';
import { readSessionTokenFromCookies } from '@/lib/session-cookie';
import { updateOrganizationEntitlements } from '@/lib/organizations-data';
import { UpdateOrgEntitlementsDtoSchema } from '@hs/contracts';

export async function PATCH(
  req: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> },
): Promise<NextResponse> {
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

  const { id } = await Promise.resolve(context.params);
  if (!id) {
    return NextResponse.json(
      { detail: 'Organization ID is required', status: 400 },
      { status: 400 },
    );
  }

  const rawBody = await req.json().catch(() => ({}));
  const parsed = UpdateOrgEntitlementsDtoSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        title: 'Validation Error',
        detail: parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
        status: 400,
        errors: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const body = parsed.data;
  const isTestOrDev =
    process.env.NODE_ENV === 'test' ||
    process.env.ENABLE_DEV_ACCOUNTS === 'true';

  const apiV1Base = resolveServerApiV1Base();
  const sessionToken = readSessionTokenFromCookies(req);

  try {
    const upstreamRes = await fetch(
      `${apiV1Base}/admin/organizations/${encodeURIComponent(id)}/entitlements`,
      {
        method: 'PATCH',
        headers: {
          Cookie: `hs_session=${sessionToken}`,
          Authorization: `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
          'X-HS-CSRF': '1',
        },
        body: JSON.stringify(body),
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      },
    );

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
    const updated = updateOrganizationEntitlements(id, body);
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json(
      { detail: err?.message || 'Failed to update entitlements', status: 404 },
      { status: 404 },
    );
  }
}
