import { z } from 'zod';

/**
 * Assessment Wizard Form & Domain Types (Stream 8.2 - #122)
 * Aligns with AGENTS.md Section 6.2 (Assessments Domain Model) and Section 8 (BR-03, BR-08, BR-09).
 */

export const TimingTypeEnum = z.enum(['duration', 'window', 'both']);
export type TimingType = z.infer<typeof TimingTypeEnum>;

export const AssessmentStatusEnum = z.enum([
  'draft',
  'dry_run_passed',
  'published',
  'closed',
  'archived',
]);
export type AssessmentStatus = z.infer<typeof AssessmentStatusEnum>;

// ─────────────────────────────────────────────────────────────────────────────
// Step 1: Template & Assessment Meta Schema
// ─────────────────────────────────────────────────────────────────────────────
export const Step1TemplateDetailsSchema = z.object({
  templateId: z.string().min(1, 'Template ID is required'),
  templateVersionId: z.string().min(1, 'Template Version ID is required (BR-03)'),
  name: z
    .string()
    .trim()
    .min(3, 'Assessment name must be at least 3 characters')
    .max(100, 'Assessment name must not exceed 100 characters'),
  requisitionId: z
    .string()
    .trim()
    .max(50, 'Requisition ID must not exceed 50 characters')
    .optional()
    .or(z.literal('')),
});
export type Step1TemplateDetails = z.infer<typeof Step1TemplateDetailsSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Step 2: Candidate Instructions & Deliverables Schema
// ─────────────────────────────────────────────────────────────────────────────
export const Step2InstructionsSchema = z.object({
  candidateInstructions: z
    .string()
    .trim()
    .min(20, 'Candidate instructions must be at least 20 characters to ensure clear task context'),
  deliverables: z
    .array(z.string().trim().min(2, 'Deliverable item cannot be blank'))
    .min(1, 'At least one deliverable item is required for candidate assessment submission'),
});
export type Step2Instructions = z.infer<typeof Step2InstructionsSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Step 3: Timing & Configuration Schema (BR-08, BR-09)
// ─────────────────────────────────────────────────────────────────────────────
export const Step3TimingSchema = z
  .object({
    type: TimingTypeEnum.default('duration'),
    durationMinutes: z
      .number({ invalid_type_error: 'Duration must be a number' })
      .int('Duration must be a whole number')
      .min(15, 'Assessment duration must be at least 15 minutes')
      .max(480, 'Assessment duration cannot exceed 480 minutes (8 hours)')
      .default(90),
    windowStartUtc: z.string().optional().or(z.literal('')),
    windowEndUtc: z.string().optional().or(z.literal('')),
    tz: z.string().default('UTC'),
    pauseTimerOnDisconnect: z.boolean().default(false), // Invariant BR-09: default false
  })
  .refine(
    (data) => {
      // If timing type includes window, windowStartUtc and windowEndUtc must be provided and ordered
      if (data.type === 'window' || data.type === 'both') {
        if (!data.windowStartUtc || !data.windowEndUtc) {
          return false;
        }
        const start = new Date(data.windowStartUtc).getTime();
        const end = new Date(data.windowEndUtc).getTime();
        return end > start;
      }
      return true;
    },
    {
      message: 'End date and time must be later than the start date and time',
      path: ['windowEndUtc'],
    }
  );
export type Step3Timing = z.infer<typeof Step3TimingSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Combined Wizard Form State
// ─────────────────────────────────────────────────────────────────────────────
export interface AssessmentFormValues {
  templateId: string;
  templateVersionId: string;
  name: string;
  requisitionId?: string;
  candidateInstructions: string;
  deliverables: string[];
  timing: Step3Timing;
}

// ─────────────────────────────────────────────────────────────────────────────
// Full Assessment Creation DTO & Response
// ─────────────────────────────────────────────────────────────────────────────
export const CreateAssessmentDtoSchema = z.object({
  templateId: z.string().min(1),
  templateVersionId: z.string().min(1),
  name: z.string().min(3).max(100),
  requisitionId: z.string().max(50).optional(),
  candidateInstructions: z.string().min(20),
  deliverables: z.array(z.string().min(2)).min(1),
  timing: Step3TimingSchema,
});
export type CreateAssessmentDto = z.infer<typeof CreateAssessmentDtoSchema>;

export interface AssessmentDto {
  id: string;
  orgId: string;
  templateVersionId: string;
  name: string;
  requisitionId?: string | null;
  candidateInstructions: string;
  deliverables: string[];
  timing: Step3Timing;
  status: AssessmentStatus;
  createdAt: string;
}

