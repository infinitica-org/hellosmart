import { z } from 'zod';

export const TaskDomainSchema = z.enum([
  'software_engineering',
  'data_science',
  'devops_cloud',
  'qa_automation',
]);
export type TaskDomain = z.infer<typeof TaskDomainSchema>;

export const TaskTypeSchema = z.enum([
  'bug_fix',
  'feature_build',
  'code_review',
  'api_integration',
  'debug_investigate',
  'test_writing',
]);
export type TaskType = z.infer<typeof TaskTypeSchema>;

export const TaskCategorySchema = z.enum([
  'micro',
  'short',
  'standard',
  'long',
  'multi_session',
]);
export type TaskCategory = z.infer<typeof TaskCategorySchema>;

export const VmClassSchema = z.enum(['XS', 'S', 'M', 'L']);
export type VmClass = z.infer<typeof VmClassSchema>;

export const ToolPackSchema = z.enum([
  'core-dev',
  'api-tools',
  'container',
  'db-tools',
  'ai-assistant',
  'recorder',
  'node20',
  'python312',
  'postman',
  'docker',
]);
export type ToolPack = z.infer<typeof ToolPackSchema>;

export const TaskLimitsSchema = z.object({
  duration_min: z.number().int().min(5).max(1440),
  budget_usd: z.number().min(0).max(500),
  max_idle_min: z.number().int().min(1).max(60).default(5),
});
export type TaskLimits = z.infer<typeof TaskLimitsSchema>;

export const TaskAiConfigSchema = z.object({
  enabled: z.boolean(),
  models: z.array(z.string()).default([]),
  cap: z
    .object({
      tokens: z.number().int().positive().optional(),
      usd: z.number().positive().optional(),
    })
    .optional(),
  on_cap: z.enum(['warn_then_block', 'block_immediate']).default('warn_then_block'),
});
export type TaskAiConfig = z.infer<typeof TaskAiConfigSchema>;

export const TaskRepoConfigSchema = z.object({
  name: z.string().min(1),
  commit: z.string().regex(/^[0-9a-f]{7,40}$/i, 'Commit must be 7-40 hex characters'),
  seed_data: z.string().optional(),
});
export type TaskRepoConfig = z.infer<typeof TaskRepoConfigSchema>;

export const TaskSecretSlotSchema = z.object({
  slot: z.string().regex(/^[A-Z][A-Z0-9_]{1,63}$/),
  source: z.enum(['injected_at_launch', 'vault']).default('injected_at_launch'),
});
export type TaskSecretSlot = z.infer<typeof TaskSecretSlotSchema>;

export const TaskNetworkProfileSchema = z.object({
  profile: z.enum(['restricted', 'package_mirror_only', 'ai_proxy_only', 'open']).default('restricted'),
  allow: z.array(z.string()).default([]),
  deny: z.array(z.string()).default([]),
});
export type TaskNetworkProfile = z.infer<typeof TaskNetworkProfileSchema>;

export const TaskReviewConfigSchema = z.object({
  mode: z.enum(['post_session', 'live']).default('post_session'),
  agents: z.array(z.string()).min(1),
});
export type TaskReviewConfig = z.infer<typeof TaskReviewConfigSchema>;

export const TaskSpecSchema = z.object({
  task_id: z.string().min(1),
  version: z.number().int().positive(),
  domain: TaskDomainSchema.default('software_engineering'),
  type: TaskTypeSchema,
  category: TaskCategorySchema,
  title: z.string().min(1).max(255),
  repo: TaskRepoConfigSchema,
  image: z.object({
    family: z.string().min(1),
    version: z.string().min(1),
    tool_packs: z.array(z.string()).default([]),
  }),
  vm_class: VmClassSchema,
  limits: TaskLimitsSchema,
  ai: TaskAiConfigSchema,
  secrets: z.array(TaskSecretSlotSchema).default([]),
  network: TaskNetworkProfileSchema.default({
    profile: 'restricted',
    allow: ['package_mirror', 'ai_proxy'],
    deny: ['open_internet'],
  }),
  deliverables: z.array(z.string()).default(['patch_file', 'short_note']),
  review: TaskReviewConfigSchema,
  retention_days: z.number().int().min(1).max(365).default(90),
});
export type TaskSpec = z.infer<typeof TaskSpecSchema>;

