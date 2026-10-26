export type OrganizationStatus = 'trial' | 'active' | 'suspended';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  plan: 'trial' | 'pro';
  candidatesCount: number;
  createdAt: string;
  adminEmail: string;
  adminName: string;
  maxTemplates: number;
  maxCandidates: number;
  trialDays: number;
}

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  adminEmail: string;
  adminName: string;
  plan: 'trial' | 'pro';
  maxTemplates: number;
  maxCandidates: number;
  trialDays: number;
}

export interface AdminMetrics {
  totalCompanies: number;
  activeTrials: number;
  totalCandidates: number;
}

