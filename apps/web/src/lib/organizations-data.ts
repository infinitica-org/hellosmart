import { Organization, CreateOrganizationInput, AdminMetrics, OrganizationStatus } from './types/organization';

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

