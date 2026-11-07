import { z } from 'zod';

export const AdminWorkspaceStatusSchema = z.enum([
  'queued',
  'provisioning',
  'not_connected',
  'connected',
  'disconnected',
  'ended',
  'destroyed',
  'failed',
]);
export type AdminWorkspaceStatus = z.infer<typeof AdminWorkspaceStatusSchema>;

export const AdminWorkspaceModeSchema = z.enum(['cloud', 'chat']);
export type AdminWorkspaceMode = z.infer<typeof AdminWorkspaceModeSchema>;

const optionalUuid = z.preprocess(
  (val: unknown) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
  z.string().uuid().optional(),
);

const optionalString = z.preprocess(
  (val: unknown) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
  z.string().optional(),
);

export const WorkspaceSpendInfoSchema = z.object({
  meteringStatus: z.enum(['connected', 'unconnected']).default('unconnected'),
  meteringNotice: z.string().default('AI proxy runtime metering unconnected'),
  allocatedAmountCents: z.number().int().nonnegative().nullable().optional(),
  usedAmountCents: z.number().int().nonnegative().nullable().optional(),
  balanceCents: z.number().int().nullable().optional(),
  markupPercentage: z.number().nullable().optional(),
  spendCapCents: z.number().int().nullable().optional(),
});
export type WorkspaceSpendInfo = z.infer<typeof WorkspaceSpendInfoSchema>;

export const AdminWorkspaceListItemDtoSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  orgName: z.string(),
  orgSlug: z.string(),
  candidateId: z.string().uuid(),
  candidateName: z.string(),
  candidateEmail: z.string().email(),
  assignmentId: z.string().uuid(),
  assessmentId: z.string().uuid(),
  assessmentName: z.string(),
  mode: AdminWorkspaceModeSchema,
  status: AdminWorkspaceStatusSchema,
  runtimeRef: z.string().nullable().optional(),
  snapshotRef: z.string().nullable().optional(),
  startedAt: z.string(),
  lastActivityAt: z.string(),
  disconnectedAt: z.string().nullable().optional(),
  endedAt: z.string().nullable().optional(),
  deadlineAt: z.string().nullable().optional(),
  idleMinutes: z.number().int().nonnegative().default(0),
  isOnline: z.boolean().default(false),
  spendInfo: WorkspaceSpendInfoSchema,
});
export type AdminWorkspaceListItemDto = z.infer<typeof AdminWorkspaceListItemDtoSchema>;

export const AdminWorkspaceQueryDtoSchema = z.object({
  org_id: optionalUuid,
  status: z
    .enum([
      'all',
      'active',
      'queued',
      'provisioning',
      'not_connected',
      'connected',
      'disconnected',
      'ended',
      'destroyed',
      'failed',
    ])
    .optional()
    .default('all'),
  mode: z.enum(['all', 'cloud', 'chat']).optional().default('all'),
  search: optionalString,
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminWorkspaceQueryDto = z.infer<typeof AdminWorkspaceQueryDtoSchema>;

export const AdminWorkspacesMetricsSchema = z.object({
  totalWorkspaces: z.number().int().nonnegative(),
  activeWorkspaces: z.number().int().nonnegative(),
  connectedCount: z.number().int().nonnegative(),
  disconnectedCount: z.number().int().nonnegative(),
  destroyedCount: z.number().int().nonnegative(),
  endedCount: z.number().int().nonnegative(),
  trackedTenantsCount: z.number().int().nonnegative(),
});
export type AdminWorkspacesMetrics = z.infer<typeof AdminWorkspacesMetricsSchema>;

export const AdminWorkspacesListResponseDtoSchema = z.object({
  items: z.array(AdminWorkspaceListItemDtoSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
  metrics: AdminWorkspacesMetricsSchema,
});
export type AdminWorkspacesListResponseDto = z.infer<typeof AdminWorkspacesListResponseDtoSchema>;

export const WorkspaceActivityEventDtoSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['connect', 'disconnect', 'resume', 'fullscreen_exit', 'submit']),
  payload: z.record(z.any()),
  ip: z.string().nullable().optional(),
  at: z.string(),
});
export type WorkspaceActivityEventDto = z.infer<typeof WorkspaceActivityEventDtoSchema>;

export const AdminWorkspaceDetailDtoSchema = AdminWorkspaceListItemDtoSchema.extend({
  recentEvents: z.array(WorkspaceActivityEventDtoSchema),
  tenantCreditAllocation: z
    .object({
      id: z.string().uuid(),
      allocatedAmountCents: z.number().int().nonnegative(),
      usedAmountCents: z.number().int().nonnegative(),
      balanceCents: z.number().int(),
      markupPercentage: z.number(),
      spendCapCents: z.number().int().nullable().optional(),
      status: z.string(),
    })
    .nullable()
    .optional(),
  assignmentTiming: z
    .object({
      deadlineAt: z.string().nullable().optional(),
      extendedMinutes: z.number().int().nonnegative().default(0),
      firstConnectAt: z.string().nullable().optional(),
      submittedAt: z.string().nullable().optional(),
      autoSubmitted: z.boolean().default(false),
      writeRevokedAt: z.string().nullable().optional(),
    })
    .optional(),
});
export type AdminWorkspaceDetailDto = z.infer<typeof AdminWorkspaceDetailDtoSchema>;

export const EmergencyDestroyWorkspaceDtoSchema = z.object({
  reason: z
    .string()
    .min(5, 'Destruction reason must be at least 5 characters')
    .max(500, 'Destruction reason cannot exceed 500 characters'),
});
export type EmergencyDestroyWorkspaceDto = z.infer<typeof EmergencyDestroyWorkspaceDtoSchema>;

export const EmergencyDestroyResponseDtoSchema = z.object({
  success: z.boolean(),
  workspaceId: z.string().uuid(),
  status: z.literal('destroyed'),
  destroyedAt: z.string(),
  assignmentRevoked: z.boolean(),
  reason: z.string(),
  limitations: z.object({
    runtimeTerminated: z.boolean(),
    snapshotSaved: z.boolean(),
    candidateNotified: z.boolean(),
    notice: z.string(),
  }),
});
export type EmergencyDestroyResponseDto = z.infer<typeof EmergencyDestroyResponseDtoSchema>;

