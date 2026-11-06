import { Organization, CreateOrganizationInput, AdminMetrics, OrganizationStatus } from '@/types/organization';

// In-memory data store for platform administration
// Starts empty so Platform Admins see clean zero-state until companies are provisioned (BR-04)
let organizationsStore: Organization[] = [];

export function getOrganizations(): Organization[] {
  return [...organizationsStore];
}

export function getMetrics(): AdminMetrics {
  const totalCompanies = organizationsStore.length;
  const activeTrials = organizationsStore.filter((o) => o.status === 'trial').length;
  const totalCandidates = organizationsStore.reduce((sum, o) => sum + (o.candidatesCount || 0), 0);

  return {
    totalCompanies,
    activeTrials,
    totalCandidates,
  };
}

export function createOrganization(input: CreateOrganizationInput): Organization {
  // Enforce slug uniqueness
  const cleanSlug = input.slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-');
  const existing = organizationsStore.find((o) => o.slug === cleanSlug);
  if (existing) {
    throw new Error(`An organization with slug "${cleanSlug}" already exists.`);
  }

  const newOrg: Organization = {
    id: `org_${cleanSlug}_${Date.now().toString(36)}`,
    name: input.name.trim(),
    slug: cleanSlug,
    status: input.plan === 'trial' ? 'trial' : 'active',
    plan: input.plan,
    candidatesCount: 0,
    createdAt: new Date().toISOString(),
    adminEmail: input.adminEmail.trim(),
    adminName: input.adminName.trim(),
    maxTemplates: Number(input.maxTemplates) || 5,
    maxCandidates: Number(input.maxCandidates) || 25,
    trialDays: Number(input.trialDays) || 14,
  };

  organizationsStore.unshift(newOrg);
  return newOrg;
}

export function updateOrganizationStatus(idOrSlug: string, status: OrganizationStatus): Organization {
  const index = organizationsStore.findIndex(
    (o) => o.id === idOrSlug || o.slug === idOrSlug
  );

  if (index === -1) {
    throw new Error(`Organization "${idOrSlug}" not found.`);
  }

  const existing = organizationsStore[index]!;
  const updated: Organization = {
    ...existing,
    status,
  };

  organizationsStore[index] = updated;
  return updated;
}

export function resetOrganizationsStore(): void {
  organizationsStore = [];
}

export interface MockOrgDetail extends Organization {
  entitlements: {
    orgId: string;
    maxTemplates: number;
    maxCandidates: number;
    trialEndsAt: string | null;
    pendingInviteMultiplier: number;
    flags: Record<string, boolean>;
    updatedAt: string;
  };
}

export function getOrganizationById(idOrSlug: string): MockOrgDetail {
  const org = organizationsStore.find((o) => o.id === idOrSlug || o.slug === idOrSlug);
  if (!org) {
    throw new Error(`Organization "${idOrSlug}" not found.`);
  }

  return {
    ...org,
    entitlements: {
      orgId: org.id,
      maxTemplates: org.maxTemplates ?? 5,
      maxCandidates: org.maxCandidates ?? 25,
      trialEndsAt: org.trialDays
        ? new Date(Date.now() + org.trialDays * 86400000).toISOString()
        : null,
      pendingInviteMultiplier: 2.0,
      flags: {
        cloud: true,
        chat: true,
      },
      updatedAt: new Date().toISOString(),
    },
  };
}

export function updateOrganizationEntitlements(
  idOrSlug: string,
  updates: {
    maxTemplates?: number | undefined;
    maxCandidates?: number | undefined;
    trialEndsAt?: string | null | undefined;
    pendingInviteMultiplier?: number | undefined;
    flags?: Record<string, boolean | undefined> | undefined;
    reason?: string | undefined;
  },
): MockOrgDetail {
  const index = organizationsStore.findIndex((o) => o.id === idOrSlug || o.slug === idOrSlug);
  if (index === -1) {
    throw new Error(`Organization "${idOrSlug}" not found.`);
  }

  const existing = organizationsStore[index]!;
  const updatedOrg: Organization = {
    ...existing,
    maxTemplates: updates.maxTemplates ?? existing.maxTemplates,
    maxCandidates: updates.maxCandidates ?? existing.maxCandidates,
  };
  organizationsStore[index] = updatedOrg;

  return {
    ...updatedOrg,
    entitlements: {
      orgId: updatedOrg.id,
      maxTemplates: updatedOrg.maxTemplates,
      maxCandidates: updatedOrg.maxCandidates,
      trialEndsAt: updates.trialEndsAt !== undefined ? updates.trialEndsAt : null,
      pendingInviteMultiplier: updates.pendingInviteMultiplier ?? 2.0,
      flags: (updates.flags as any) || { cloud: true, chat: true },
      updatedAt: new Date().toISOString(),
    },
  };
}

