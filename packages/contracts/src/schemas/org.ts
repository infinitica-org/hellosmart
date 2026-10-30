import { z } from 'zod';

export const OrgStatusEnum = z.enum([
  'provisioned',
  'trial',
  'trial_active',
  'trial_expired',
  'active',
  'paid_active',
  'suspended',
]);
export type OrgStatus = z.infer<typeof OrgStatusEnum>;

export const CreateOrgDtoSchema = z.object({
  name: z.string().min(1, 'Company name is required').max(120),
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase letters, numbers, and hyphens')
    .optional(),
  planId: z.string().min(1).optional(),
  retentionDays: z.number().int().min(1).max(365).default(90).optional(),
  whiteLabel: z.boolean().default(false).optional(),
  customDomain: z.string().max(255).optional(),
  adminEmail: z.string().email('Invalid admin email format').max(254),
  adminName: z.string().min(1, 'Admin name is required').max(120),
});
export type CreateOrgDto = z.infer<typeof CreateOrgDtoSchema>;

export const UpdateOrgStatusDtoSchema = z.object({
  status: z.enum(['provisioned', 'trial_active', 'paid_active', 'suspended']),
  reason: z.string().max(500).optional(),
});
export type UpdateOrgStatusDto = z.infer<typeof UpdateOrgStatusDtoSchema>;

export const OrgDtoSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  status: OrgStatusEnum,
  planId: z.string().nullable().optional(),
  logoUrl: z.string().nullable().optional(),
  whiteLabel: z.boolean(),
  customDomain: z.string().nullable().optional(),
  retentionDays: z.number().int(),
  createdAt: z.string().datetime(),
});
export type OrgDto = z.infer<typeof OrgDtoSchema>;

export const OrgListItemDtoSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(64),
  status: OrgStatusEnum,
  candidateCount: z.number().int().min(0),
  createdAt: z.string().datetime(),
  trialEndsAt: z.string().datetime().nullable().optional(),
});
export type OrgListItemDto = z.infer<typeof OrgListItemDtoSchema>;

export const OrgListQueryDtoSchema = z.object({
  page: z.coerce.number().int().min(1, 'Page must be at least 1').default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1, 'Page size must be at least 1')
    .max(100, 'Page size cannot exceed 100')
    .default(20),
  status: OrgStatusEnum.optional(),
  search: z.string().trim().max(100, 'Search query cannot exceed 100 characters').optional(),
});
export type OrgListQueryDto = z.infer<typeof OrgListQueryDtoSchema>;

export const PaginatedOrgListDtoSchema = z.object({
  items: z.array(OrgListItemDtoSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
  total: z.number().int().min(0),
});
export type PaginatedOrgListDto = z.infer<typeof PaginatedOrgListDtoSchema>;

export const AdminMetricsDtoSchema = z.object({
  totalCompanies: z.number().int().min(0, 'Total companies cannot be negative'),
  activeTrials: z.number().int().min(0, 'Active trials cannot be negative'),
  totalCandidates: z.number().int().min(0, 'Total candidates cannot be negative'),
});
export type AdminMetricsDto = z.infer<typeof AdminMetricsDtoSchema>;

export const CompanyMetricsDtoSchema = z.object({
  configuredAssessments: z.number().int().min(0),
  invitedCandidates: z.number().int().min(0),
  activeCandidates: z.number().int().min(0),
  submissionsToReview: z.number().int().min(0),
  maxCandidates: z.number().int().min(0),
  remainingQuota: z.number().int().min(0),
});
export type CompanyMetricsDto = z.infer<typeof CompanyMetricsDtoSchema>;

