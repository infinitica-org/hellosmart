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
