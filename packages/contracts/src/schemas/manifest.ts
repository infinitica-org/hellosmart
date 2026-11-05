import { z } from 'zod';

export const ManifestWorkspaceModeSchema = z.enum(['cloud', 'chat']);
export type ManifestWorkspaceMode = z.infer<typeof ManifestWorkspaceModeSchema>;

export const ManifestRuntimeSizeSchema = z.enum(['small', 'medium', 'dedicated']);
export type ManifestRuntimeSize = z.infer<typeof ManifestRuntimeSizeSchema>;

export const ManifestRuntimeIsolationSchema = z.enum(['shared', 'dedicated']);
export type ManifestRuntimeIsolation = z.infer<typeof ManifestRuntimeIsolationSchema>;

export const ManifestCodingAgentSchema = z.enum(['claude-code', 'codex']);
export type ManifestCodingAgent = z.infer<typeof ManifestCodingAgentSchema>;

export const ManifestRuntimeSchema = z.object({
  image: z.string().min(1, 'Runtime image is required'),
  size: ManifestRuntimeSizeSchema,
  isolation: ManifestRuntimeIsolationSchema,
  services: z.string().optional(),
  coding_agents: z.array(ManifestCodingAgentSchema).optional().default([]),
  egress_allow: z
    .array(
      z.string().regex(/^[a-z0-9.-]+$/, 'Egress domain must be a valid lowercase hostname'),
    )
    .optional()
    .default([]),
});
export type ManifestRuntime = z.infer<typeof ManifestRuntimeSchema>;

export const ManifestRepoSchema = z.object({
  source: z.string().min(1, 'Repo source URL or reference is required'),
  ref: z
    .string()
    .regex(/^[0-9a-f]{7,40}$/i, 'Repo ref must be a 7 to 40 character hexadecimal commit SHA'),
});
export type ManifestRepo = z.infer<typeof ManifestRepoSchema>;

export const ManifestEnvSlotSchema = z.object({
  name: z
    .string()
    .regex(/^[A-Z][A-Z0-9_]{1,63}$/, 'Env slot name must be uppercase alphanumeric with underscores (e.g. API_KEY)'),
  secret: z.boolean().default(false),
  required: z.boolean().default(true),
});
export type ManifestEnvSlot = z.infer<typeof ManifestEnvSlotSchema>;

export const ManifestAiDefaultsSchema = z.object({
  enabled: z.boolean(),
  models: z.array(z.string()).optional().default([]),
  cap_usd: z.number().min(0, 'cap_usd cannot be negative').optional(),
  rpm: z.number().int().min(1, 'rpm must be at least 1').optional(),
});
export type ManifestAiDefaults = z.infer<typeof ManifestAiDefaultsSchema>;

export const ManifestTimingDefaultSchema = z.object({
  type: z.enum(['duration', 'window', 'both']),
  duration_minutes: z
    .number()
    .int()
    .min(5, 'Duration must be at least 5 minutes')
    .max(1440, 'Duration cannot exceed 1440 minutes (24 hours)')
    .optional(),
});
export type ManifestTimingDefault = z.infer<typeof ManifestTimingDefaultSchema>;

export const DeliverableItemSchema = z.union([
  z.string().min(1, 'Deliverable path or description cannot be empty'),
  z.object({
    path: z.string().optional(),
    description: z.string().optional(),
    hidden_tests: z.string().optional(),
  }),
]);
export type DeliverableItem = z.infer<typeof DeliverableItemSchema>;

/**
 * HelloSmart Template Manifest Schema v1 (NF-018)
 * Conforms to JSON Schema specification in templates/_schema/manifest.schema.json
 */
export const TemplateManifestSchema = z
  .object({
    template: z
      .string()
      .regex(
        /^[a-z0-9][a-z0-9-]{2,62}$/,
        'Template slug must be 3-63 characters, lowercase alphanumeric and hyphens, starting with alphanumeric',
      ),
    name: z.string().min(3, 'Template display name must be at least 3 characters').optional(),
    version: z
      .string()
      .regex(
        /^\d+\.\d+\.\d+$/,
        'Version must follow semantic versioning format major.minor.patch (e.g. 1.0.0)',
      ),
    mode: ManifestWorkspaceModeSchema,
    category: z.string().optional(),
    difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']).optional(),
    tags: z.array(z.string()).optional().default([]),
    runtime: ManifestRuntimeSchema.optional(),
    repo: ManifestRepoSchema.optional(),
    seed: z.string().optional(),
    env_slots: z.array(ManifestEnvSlotSchema).optional().default([]),
    ai_defaults: ManifestAiDefaultsSchema,
    brief: z.string().min(10, 'Candidate brief must be at least 10 characters and provide task details'),
    deliverables: z.array(DeliverableItemSchema).optional().default([]),
    reviewers: z
      .array(z.string().min(1, 'Reviewer rubric dimension cannot be empty'))
      .min(2, 'Manifest must specify at least 2 distinct reviewer rubric dimensions')
      .refine(
        (items) => new Set(items).size === items.length,
        'Reviewer rubric dimensions cannot contain duplicate keys',
      ),
    golden_submissions: z.string().optional(),
    timing_default: ManifestTimingDefaultSchema,
  })
  .refine(
    (data) => {
      if (data.mode === 'cloud') {
        return !!data.runtime && !!data.runtime.image && !!data.runtime.size && !!data.runtime.isolation;
      }
      return true;
    },
    {
      message: "Cloud workspace mode requires a complete 'runtime' configuration (image, size, isolation)",
      path: ['runtime'],
    },
  );

export type TemplateManifest = z.infer<typeof TemplateManifestSchema>;

/**
 * Validates arbitrary input as a Template Manifest v1.
 */
export function validateTemplateManifest(input: unknown): {
  success: boolean;
  data?: TemplateManifest;
  errors?: z.ZodIssue[];
} {
  const result = TemplateManifestSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues };
}
