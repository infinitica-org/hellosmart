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

export const CandidateAssignmentDtoSchema = z.object({
  id: z.string(),
  assessmentId: z.string(),
  title: z.string().min(1),
  companyName: z.string().min(1),
  status: z.enum(['ready', 'in_progress', 'submitted']),
  durationMinutes: z.number().int().positive(),
  mode: z.enum(['cloud', 'chat']).default('cloud'),
  aiEnabled: z.boolean().default(true),
  pauseTimerOnDisconnect: z.boolean().default(false),
  invitedAt: z.string(),
  startedAt: z.string().nullable().optional(),
  submittedAt: z.string().nullable().optional(),
});
export type CandidateAssignmentDto = z.infer<typeof CandidateAssignmentDtoSchema>;

export const StartAssignmentDtoSchema = z.object({
  consent: z.object({
    textVersion: z.string().min(1),
    acceptedAt: z.string(),
  }),
});
export type StartAssignmentDto = z.infer<typeof StartAssignmentDtoSchema>;

