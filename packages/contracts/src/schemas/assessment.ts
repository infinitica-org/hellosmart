import { z } from 'zod';

export const AssessmentStatusSchema = z.enum([
  'draft',
  'dry_run_passed',
  'published',
  'closed',
  'archived',
]);
export type AssessmentStatus = z.infer<typeof AssessmentStatusSchema>;

export const TimingConfigSchema = z.object({
  type: z.enum(['duration', 'window', 'both']).default('duration'),
  durationMinutes: z.number().int().min(15).max(480).default(90),
  windowStartUtc: z.string().datetime().optional(),
  windowEndUtc: z.string().datetime().optional(),
  tz: z.string().default('UTC'),
  pauseTimerOnDisconnect: z.boolean().default(false),
});
export type TimingConfig = z.infer<typeof TimingConfigSchema>;

export const AiPolicySchema = z.object({
  enabled: z.boolean().default(true),
  providerKeyId: z.string().uuid().optional(),
  platformAllocationId: z.string().uuid().optional(),
  allowedModels: z.array(z.string()).default(['gpt-4o', 'claude-3-5-sonnet']),
  capPerCandidate: z
    .object({
      unit: z.enum(['tokens', 'cents']).default('tokens'),
      value: z.number().int().positive().default(50000),
    })
    .default({ unit: 'tokens', value: 50000 }),
  capPerAssessment: z
    .object({
      unit: z.enum(['tokens', 'cents']).default('tokens'),
      value: z.number().int().positive().default(500000),
    })
    .optional(),
  rpm: z.number().int().positive().default(20),
  onCap: z.enum(['warn_then_block', 'block']).default('warn_then_block'),
});
export type AiPolicy = z.infer<typeof AiPolicySchema>;

export const BriefOverridesSchema = z.object({
  scenario: z.string().max(4000).optional(),
  instructions: z.string().max(8000).optional(),
  deliverables: z.array(z.string().max(500)).max(20).optional(),
  customQuestions: z.array(z.string().max(1000)).max(10).optional(),
});
export type BriefOverrides = z.infer<typeof BriefOverridesSchema>;

export const CreateAssessmentDtoSchema = z.object({
  templateId: z.string().min(1, 'templateId is required'),
  templateVersionId: z.string().uuid().optional(),
  name: z.string().min(3, 'Name must be at least 3 characters').max(120),
  workspaceMode: z.enum(['cloud', 'chat']).default('cloud'),
  aiPolicy: AiPolicySchema.default({
    enabled: true,
    allowedModels: ['gpt-4o', 'claude-3-5-sonnet'],
    capPerCandidate: { unit: 'tokens', value: 50000 },
    rpm: 20,
    onCap: 'warn_then_block',
  }),
  timing: TimingConfigSchema.default({
    type: 'duration',
    durationMinutes: 90,
    tz: 'UTC',
    pauseTimerOnDisconnect: false,
  }),
  briefOverrides: BriefOverridesSchema.default({}),
  releaseResultsDefault: z.boolean().default(false),
});
export type CreateAssessmentDto = z.infer<typeof CreateAssessmentDtoSchema>;

export const UpdateAssessmentBriefDtoSchema = BriefOverridesSchema;
export type UpdateAssessmentBriefDto = z.infer<typeof UpdateAssessmentBriefDtoSchema>;

export const AssessmentSummaryDtoSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  templateId: z.string(),
  templateVersionId: z.string().uuid(),
  templateVersion: z.string(),
  name: z.string(),
  workspaceMode: z.enum(['cloud', 'chat']),
  status: AssessmentStatusSchema,
  timing: TimingConfigSchema,
  candidateCount: z.number().int().default(0),
  dryRunPassedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AssessmentSummaryDto = z.infer<typeof AssessmentSummaryDtoSchema>;

export const AssessmentDetailDtoSchema = AssessmentSummaryDtoSchema.extend({
  aiPolicy: AiPolicySchema,
  briefOverrides: BriefOverridesSchema,
  envRefs: z.array(z.string()).default([]),
  releaseResultsDefault: z.boolean(),
  effectiveBrief: z
    .object({
      scenario: z.string(),
      instructions: z.string(),
      deliverables: z.array(z.string()),
    })
    .optional(),
});
export type AssessmentDetailDto = z.infer<typeof AssessmentDetailDtoSchema>;
