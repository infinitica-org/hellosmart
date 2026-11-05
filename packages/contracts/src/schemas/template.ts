import { z } from 'zod';
import { TemplateManifestSchema } from './manifest.js';

export const TemplateCategorySchema = z.enum([
  'Full Stack',
  'Backend',
  'Frontend',
  'Data',
  'QA',
  'Product',
  'DevOps',
]);
export type TemplateCategory = z.infer<typeof TemplateCategorySchema>;

export const TemplateDifficultySchema = z.enum(['Beginner', 'Intermediate', 'Advanced']);
export type TemplateDifficulty = z.infer<typeof TemplateDifficultySchema>;

export const TemplateStatusSchema = z.enum(['draft', 'tested', 'published']);
export type TemplateStatus = z.infer<typeof TemplateStatusSchema>;

export const TemplateSummaryDtoSchema = z.object({
  id: z.string().min(1),
  versionId: z.string().min(1),
  name: z.string().min(1),
  category: z.string(),
  difficulty: z.string(),
  durationMinutes: z.number().int().positive(),
  workspaceMode: z.enum(['cloud', 'chat']),
  description: z.string(),
  tags: z.array(z.string()),
  status: TemplateStatusSchema.optional().default('published'),
  isAssigned: z.boolean().optional(),
});
export type TemplateSummaryDto = z.infer<typeof TemplateSummaryDtoSchema>;

export const TemplateDetailDtoSchema = TemplateSummaryDtoSchema.extend({
  manifest: TemplateManifestSchema,
  candidateBrief: z.string().optional(),
  scenario: z.string().optional(),
  starterRepository: z
    .object({
      name: z.string(),
      branch: z.string(),
      fileStructure: z.array(z.string()).optional(),
    })
    .optional(),
  rubricPreview: z
    .array(
      z.object({
        dimension: z.string(),
        weight: z.number(),
        description: z.string().optional(),
      }),
    )
    .optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type TemplateDetailDto = z.infer<typeof TemplateDetailDtoSchema>;

export const CreateTemplateDtoSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  slug: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{2,62}$/, 'Slug must be 3-63 lowercase alphanumeric characters or hyphens'),
  category: TemplateCategorySchema,
  difficulty: TemplateDifficultySchema,
  description: z.string().min(10, 'Description must be at least 10 characters'),
  tags: z.array(z.string()).default([]),
  workspaceMode: z.enum(['cloud', 'chat']).default('cloud'),
  initialManifest: TemplateManifestSchema,
});
export type CreateTemplateDto = z.infer<typeof CreateTemplateDtoSchema>;

export const UpdateTemplateDtoSchema = z.object({
  name: z.string().min(3).optional(),
  category: TemplateCategorySchema.optional(),
  difficulty: TemplateDifficultySchema.optional(),
  description: z.string().min(10).optional(),
  tags: z.array(z.string()).optional(),
});
export type UpdateTemplateDto = z.infer<typeof UpdateTemplateDtoSchema>;

export const AssignTemplateDtoSchema = z.object({
  orgId: z.string().uuid('orgId must be a valid UUID'),
});
export type AssignTemplateDto = z.infer<typeof AssignTemplateDtoSchema>;

export const BulkAssignTemplateDtoSchema = z.object({
  orgIds: z.array(z.string().uuid('Each orgId must be a valid UUID')).min(1, 'Provide at least one orgId'),
});
export type BulkAssignTemplateDto = z.infer<typeof BulkAssignTemplateDtoSchema>;

export const CloneTemplateDtoSchema = z.object({
  newVersion: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, 'Version must be semver (e.g. 1.1.0)')
    .optional(),
  versionType: z.enum(['patch', 'minor', 'major']).default('minor'),
});
export type CloneTemplateDto = z.infer<typeof CloneTemplateDtoSchema>;
