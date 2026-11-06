import { NextRequest, NextResponse } from 'next/server';
import {
  getOrganizations,
  getMetrics,
  createOrganization,
  updateOrganizationStatus,
} from '../../../../lib/organizations-data';
import { CreateOrganizationInput, Organization, OrganizationStatus } from '@/types/organization';
import { requirePlatformAdmin } from '@/lib/server-auth';
import { resolveServerApiV1Base } from '@/lib/api-base-url';

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Enforce server-side authentication & platform_admin authorization
  const auth = await requirePlatformAdmin(req);
  if (!auth.authorized) {
    return auth.errorResponse;
  }

  const apiV1Base = resolveServerApiV1Base();
  const sessionToken =
    req.cookies.get('hs_session')?.value ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  try {
    // 1. Fetch real organizations & platform metrics from NestJS backend API
    const [orgsRes, metricsRes] = await Promise.all([
      fetch(`${apiV1Base}/admin/organizations?pageSize=100`, {
        headers: {
          Cookie: `hs_session=${sessionToken}`,
          Authorization: `Bearer ${sessionToken}`,
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(3000),
      }),
      fetch(`${apiV1Base}/admin/metrics`, {
        headers: {
          Cookie: `hs_session=${sessionToken}`,
          Authorization: `Bearer ${sessionToken}`,
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(3000),
      }),
    ]);

    if (orgsRes.ok) {
      const orgsData = await orgsRes.json();
      const metricsData = metricsRes.ok ? await metricsRes.json().catch(() => null) : null;

      const organizations: Organization[] = (orgsData.items || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        slug: item.slug,
        status:
          item.status === 'trial_active'
            ? 'trial'
            : item.status === 'paid_active'
              ? 'active'
              : (item.status as OrganizationStatus),
        plan: item.status === 'paid_active' ? 'pro' : 'trial',
        candidatesCount: item.candidateCount ?? 0,
        createdAt: item.createdAt,
        adminEmail: item.adminEmail || '',
        adminName: item.adminName || '',
        maxTemplates: item.maxTemplates ?? 5,
        maxCandidates: item.maxCandidates ?? 25,
        trialDays: 14,
      }));

      const metrics = metricsData || {
        totalCompanies: organizations.length,
        activeTrials: organizations.filter((o) => o.status === 'trial' || o.status === 'trial_active').length,
        totalCandidates: organizations.reduce((sum, o) => sum + (o.candidatesCount || 0), 0),
      };

      return NextResponse.json({ organizations, metrics }, { status: 200 });
    } else {
      const isTestOrDev =
        process.env.NODE_ENV === 'test' ||
        process.env.ENABLE_DEV_ACCOUNTS === 'true';
      if (!isTestOrDev) {
        const errData = await orgsRes.json().catch(() => null);
        return NextResponse.json(
          {
            title: errData?.title || 'Failed to retrieve organizations',
            detail: errData?.detail || 'Unexpected backend error',
            status: orgsRes.status,
          },
          { status: orgsRes.status }
        );
      }
    }
  } catch {
    // Backend offline / unreachable; fall through to test store below
    const isTestOrDev =
      process.env.NODE_ENV === 'test' ||
      process.env.ENABLE_DEV_ACCOUNTS === 'true';
    if (!isTestOrDev) {
      return NextResponse.json(
        {
          title: 'Service Unavailable',
          detail: 'Backend service unreachable',
          status: 503,
        },
        { status: 503 }
      );
    }
  }

  const isTestOrDev =
    process.env.NODE_ENV === 'test' ||
    process.env.ENABLE_DEV_ACCOUNTS === 'true';
  if (!isTestOrDev) {
    return NextResponse.json(
      {
        title: 'Service Unavailable',
        detail: 'Backend service unreachable',
        status: 503,
      },
      { status: 503 }
    );
  }

  // 2. In-memory store fallback (used for isolated unit tests)
  try {
    const organizations = getOrganizations();
    const metrics = getMetrics();

    return NextResponse.json(
      {
        organizations,
        metrics,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        title: 'Failed to retrieve organizations',
        detail: error?.message || 'Unexpected server error',
        status: 500,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Enforce server-side authentication & platform_admin authorization
  const auth = await requirePlatformAdmin(req);
  if (!auth.authorized) {
    return auth.errorResponse;
  }

  try {
    const body = await req.json();
    const {
      name,
      slug,
      adminEmail,
      adminName,
      plan,
      maxTemplates,
      maxCandidates,
      trialDays,
    } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { detail: 'Company Name is required', status: 400 },
        { status: 400 }
      );
    }

    if (!slug || typeof slug !== 'string' || !slug.trim()) {
      return NextResponse.json(
        { detail: 'Organization Slug is required', status: 400 },
        { status: 400 }
      );
    }

    if (!adminEmail || typeof adminEmail !== 'string' || !adminEmail.includes('@')) {
      return NextResponse.json(
        { detail: 'Valid Admin Email is required', status: 400 },
        { status: 400 }
      );
    }

    if (!adminName || typeof adminName !== 'string' || !adminName.trim()) {
      return NextResponse.json(
        { detail: 'Admin Name is required', status: 400 },
        { status: 400 }
      );
    }

    const input: CreateOrganizationInput = {
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      adminEmail: adminEmail.trim(),
      adminName: adminName.trim(),
      plan: plan === 'pro' ? 'pro' : 'trial',
      maxTemplates: Number(maxTemplates) || 5,
      maxCandidates: Number(maxCandidates) || 25,
      trialDays: Number(trialDays) || 14,
    };

    const apiV1Base = resolveServerApiV1Base();
    const sessionToken =
      req.cookies.get('hs_session')?.value ||
      req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    try {
      const appOrigin =
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.APP_BASE_URL ||
        'http://localhost:3000';

      const apiRes = await fetch(`${apiV1Base}/admin/organizations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-HS-CSRF': '1',
          Origin: appOrigin.replace(/\/$/, ''),
          Cookie: `hs_session=${sessionToken}`,
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          name: input.name,
          slug: input.slug,
          adminEmail: input.adminEmail,
          adminName: input.adminName,
          planId: input.plan === 'trial' ? 'plan_trial' : 'plan_pro',
          retentionDays: 90,
          whiteLabel: false,
          maxTemplates: input.maxTemplates,
          maxCandidates: input.maxCandidates,
          trialDays: input.trialDays,
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(4000),
      });

      if (apiRes.ok) {
        const created = await apiRes.json();
        const mappedOrg: Organization = {
          id: created.id,
          name: created.name,
          slug: created.slug,
          status:
            created.status === 'trial_active'
              ? 'trial'
              : created.status === 'paid_active'
                ? 'active'
                : created.status,
          plan: created.planId === 'plan_pro' || created.status === 'paid_active' ? 'pro' : 'trial',
          candidatesCount: 0,
          createdAt: created.createdAt,
          adminEmail: input.adminEmail,
          adminName: input.adminName,
          maxTemplates: input.maxTemplates,
          maxCandidates: input.maxCandidates,
          trialDays: input.trialDays,
        };

        return NextResponse.json(
          {
            success: true,
            organization: mappedOrg,
            message: `Company "${mappedOrg.name}" provisioned successfully.`,
          },
          { status: 201 }
        );
      }

      if (apiRes.status === 409) {
        const errData = await apiRes.json().catch(() => null);
        return NextResponse.json(
          {
            title: 'Provisioning Error',
            detail: errData?.detail || `An organization with slug "${input.slug}" already exists.`,
            status: 409,
          },
          { status: 409 }
        );
      }

      const isTestOrDev =
        process.env.NODE_ENV === 'test' ||
        process.env.ENABLE_DEV_ACCOUNTS === 'true';
      if (!isTestOrDev) {
        const errData = await apiRes.json().catch(() => null);
        return NextResponse.json(
          {
            title: errData?.title || 'Provisioning Error',
            detail: errData?.detail || 'Failed to provision organization on backend',
            status: apiRes.status,
          },
          { status: apiRes.status }
        );
      }
    } catch {
      // Backend offline; fallback to unit test store
      const isTestOrDev =
        process.env.NODE_ENV === 'test' ||
        process.env.ENABLE_DEV_ACCOUNTS === 'true';
      if (!isTestOrDev) {
        return NextResponse.json(
          {
            title: 'Service Unavailable',
            detail: 'Backend service unreachable',
            status: 503,
          },
          { status: 503 }
        );
      }
    }

    const isTestOrDev =
      process.env.NODE_ENV === 'test' ||
      process.env.ENABLE_DEV_ACCOUNTS === 'true';
    if (!isTestOrDev) {
      return NextResponse.json(
        {
          title: 'Service Unavailable',
          detail: 'Backend service unreachable',
          status: 503,
        },
        { status: 503 }
      );
    }

    const newOrg = createOrganization(input);

    return NextResponse.json(
      {
        success: true,
        organization: newOrg,
        message: `Company "${newOrg.name}" provisioned successfully.`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    const isConflict = error?.message?.includes('already exists');
    return NextResponse.json(
      {
        title: 'Provisioning Error',
        detail: error?.message || 'Failed to provision company',
        status: isConflict ? 409 : 400,
      },
      { status: isConflict ? 409 : 400 }
    );
  }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  // Enforce server-side authentication & platform_admin authorization
  const auth = await requirePlatformAdmin(req);
  if (!auth.authorized) {
    return auth.errorResponse;
  }

  try {
    const body = await req.json();
    const { id, status } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { detail: 'Organization ID or slug is required', status: 400 },
        { status: 400 }
      );
    }

    const validStatuses: OrganizationStatus[] = ['trial', 'active', 'suspended'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { detail: `Invalid status. Must be one of: ${validStatuses.join(', ')}`, status: 400 },
        { status: 400 }
      );
    }

    const apiV1Base = resolveServerApiV1Base();
    const sessionToken =
      req.cookies.get('hs_session')?.value ||
      req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    try {
      const appOrigin =
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.APP_BASE_URL ||
        'http://localhost:3000';

      const backendStatus =
        status === 'suspended'
          ? 'suspended'
          : status === 'trial'
            ? 'trial_active'
            : 'paid_active';

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      let targetOrgId = id;

      if (!isUuid) {
        const lookupRes = await fetch(`${apiV1Base}/admin/organizations?search=${encodeURIComponent(id)}`, {
          headers: {
            Cookie: `hs_session=${sessionToken}`,
            Authorization: `Bearer ${sessionToken}`,
          },
          signal: AbortSignal.timeout(2000),
        });
        if (lookupRes.ok) {
          const lookupData = await lookupRes.json();
          const match = lookupData.items?.find((o: any) => o.slug === id || o.id === id);
          if (match) {
            targetOrgId = match.id;
          }
        }
      }

      const patchRes = await fetch(`${apiV1Base}/admin/organizations/${encodeURIComponent(targetOrgId)}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-HS-CSRF': '1',
          Origin: appOrigin.replace(/\/$/, ''),
          Cookie: `hs_session=${sessionToken}`,
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          status: backendStatus,
          reason: body.reason || `Status updated via Admin Console to ${status}`,
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(4000),
      });

      if (patchRes.ok) {
        const updated = await patchRes.json();
        const mappedOrg: Organization = {
          id: updated.id,
          name: updated.name,
          slug: updated.slug,
          status:
            updated.status === 'trial_active'
              ? 'trial'
              : updated.status === 'paid_active'
                ? 'active'
                : updated.status,
          plan: updated.planId === 'plan_pro' || updated.status === 'paid_active' ? 'pro' : 'trial',
          candidatesCount: 0,
          createdAt: updated.createdAt,
          adminEmail: '',
          adminName: '',
          maxTemplates: 5,
          maxCandidates: 25,
          trialDays: 14,
        };

        return NextResponse.json(
          {
            success: true,
            organization: mappedOrg,
            message: `Organization "${mappedOrg.name}" status updated to ${status}.`,
          },
          { status: 200 }
        );
      }

      const isTestOrDev =
        process.env.NODE_ENV === 'test' ||
        process.env.ENABLE_DEV_ACCOUNTS === 'true';
      if (!isTestOrDev) {
        const errData = await patchRes.json().catch(() => null);
        return NextResponse.json(
          {
            title: errData?.title || 'Status Update Error',
            detail: errData?.detail || 'Failed to update organization status on backend',
            status: patchRes.status,
          },
          { status: patchRes.status }
        );
      }
    } catch {
      // Backend offline; fallback to unit test store
      const isTestOrDev =
        process.env.NODE_ENV === 'test' ||
        process.env.ENABLE_DEV_ACCOUNTS === 'true';
      if (!isTestOrDev) {
        return NextResponse.json(
          {
            title: 'Service Unavailable',
            detail: 'Backend service unreachable',
            status: 503,
          },
          { status: 503 }
        );
      }
    }

    const isTestOrDev =
      process.env.NODE_ENV === 'test' ||
      process.env.ENABLE_DEV_ACCOUNTS === 'true';
    if (!isTestOrDev) {
      return NextResponse.json(
        {
          title: 'Service Unavailable',
          detail: 'Backend service unreachable',
          status: 503,
        },
        { status: 503 }
      );
    }

    const updated = updateOrganizationStatus(id, status);

    return NextResponse.json(
      {
        success: true,
        organization: updated,
        message: `Organization "${updated.name}" status updated to ${status}.`,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        title: 'Status Update Error',
        detail: error?.message || 'Failed to update organization status',
        status: 404,
      },
      { status: 404 }
    );
  }
}
