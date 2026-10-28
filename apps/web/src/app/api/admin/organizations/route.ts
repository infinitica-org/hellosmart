import { NextRequest, NextResponse } from 'next/server';
import {
  getOrganizations,
  getMetrics,
  createOrganization,
  updateOrganizationStatus,
} from '../../../../lib/organizations-data';
import { CreateOrganizationInput, OrganizationStatus } from '@/types/organization';

export async function GET(): Promise<NextResponse> {
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

