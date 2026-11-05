import { z } from 'zod';

export const RoleEnum = z.enum(['platform_admin', 'company_admin', 'candidate']);
export type Role = z.infer<typeof RoleEnum>;

export const PortalEnum = z.enum(['admin', 'company', 'candidate']);
export type Portal = z.infer<typeof PortalEnum>;

export const UserStatusEnum = z.enum(['provisioned', 'active', 'suspended', 'deleted']);
export type UserStatus = z.infer<typeof UserStatusEnum>;

export const UserDtoSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().max(254),
  name: z.string().min(1).max(120),
  role: RoleEnum,
  status: UserStatusEnum,
  orgId: z.string().uuid().nullable().optional(),
  createdAt: z.string().datetime().optional(),
});
export type UserDto = z.infer<typeof UserDtoSchema>;

export const MeDtoSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  role: RoleEnum,
  portal: PortalEnum,
  mustResetPassword: z.boolean(),
  org: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      logoUrl: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});
export type MeDto = z.infer<typeof MeDtoSchema>;

export const CandidateStatusEnum = z.enum(['invited', 'active', 'deleted']);
export type CandidateStatus = z.infer<typeof CandidateStatusEnum>;

export const CreateCandidateDtoSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(254),
  assessment_id: z.string().uuid().optional(),
});
export type CreateCandidateDto = z.infer<typeof CreateCandidateDtoSchema>;

export const CandidateDtoSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  email: z.string().email().max(254),
  status: CandidateStatusEnum,
  countedAgainstCapAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
});
export type CandidateDto = z.infer<typeof CandidateDtoSchema>;

export const AssignmentStatusEnum = z.enum([
  'invited',
  'window_not_open',
  'ready',
  'in_progress',
  'disconnected',
  'submitted',
  'expired',
  'revoked',
]);
export type AssignmentStatus = z.infer<typeof AssignmentStatusEnum>;

export const CandidateAssignmentDtoSchema = z.object({
  id: z.string().uuid(),
  candidateId: z.string().uuid(),
  assessmentId: z.string().uuid(),
  name: z.string().min(1).max(120),
  email: z.string().email().max(254),
  status: AssignmentStatusEnum,
  invitedAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  deliveryStatus: z.enum(['sent', 'failed']).optional(),
});
export type CandidateAssignmentDto = z.infer<typeof CandidateAssignmentDtoSchema>;

export const CreateCandidateResponseSchema = z.union([
  CandidateDtoSchema,
  CandidateAssignmentDtoSchema,
]);
export type CreateCandidateResponse = z.infer<typeof CreateCandidateResponseSchema>;

export const BulkCandidateRowErrorSchema = z.object({
  rowNumber: z.number().int().positive(),
  field: z.string().optional(),
  code: z.string(),
  message: z.string(),
});
export type BulkCandidateRowError = z.infer<typeof BulkCandidateRowErrorSchema>;

export const BulkCandidateCreatedSampleSchema = z.object({
  rowNumber: z.number().int().positive(),
  candidateId: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  assignmentId: z.string().uuid().optional(),
  status: z.string(),
  deliveryStatus: z.enum(['sent', 'failed']),
});
export type BulkCandidateCreatedSample = z.infer<typeof BulkCandidateCreatedSampleSchema>;

export const BulkCandidateUploadResultSchema = z.object({
  totalRows: z.number().int().nonnegative(),
  processedRows: z.number().int().nonnegative(),
  successfulRows: z.number().int().nonnegative(),
  failedRows: z.number().int().nonnegative(),
  errorsTruncated: z.boolean(),
  errors: z.array(BulkCandidateRowErrorSchema),
  createdSample: z.array(BulkCandidateCreatedSampleSchema),
});
export type BulkCandidateUploadResult = z.infer<typeof BulkCandidateUploadResultSchema>;
