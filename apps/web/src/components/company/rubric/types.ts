import { z } from 'zod';

/**
 * Rubric Customizer Types & Zod Schemas (Stream 8.3 - #123)
 * Aligns with AGENTS.md Section 6.2 (RubricItem / Reviewer Agent Config) and BR-18.
 *
 * Core Business Invariant: Total rubric weight across all dimensions must equal exactly 100%.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Scoring Anchors (Levels: 1 = Inadequate, 3 = Competent, 5 = Exemplary)
// ─────────────────────────────────────────────────────────────────────────────
export const ScoringAnchorLevelEnum = z.union([z.literal(1), z.literal(3), z.literal(5)]);
export type ScoringAnchorLevel = z.infer<typeof ScoringAnchorLevelEnum>;

export const ScoringAnchorSchema = z.object({
  score: ScoringAnchorLevelEnum,
  label: z.string().min(1, 'Anchor label is required'),
  description: z.string().trim().min(5, 'Anchor description must be at least 5 characters'),
});
export type ScoringAnchor = z.infer<typeof ScoringAnchorSchema>;

export const DEFAULT_SCORING_ANCHORS: readonly ScoringAnchor[] = [
  {
    score: 1,
    label: 'Inadequate',
    description: 'Does not meet expected performance standards; critical gaps in implementation or reasoning.',
  },
  {
    score: 3,
    label: 'Competent',
    description: 'Meets production expectations; solid implementation handling standard constraints and test cases.',
  },
  {
    score: 5,
    label: 'Exemplary',
    description: 'Exceeds expectations; highly robust architecture, exceptional error handling, and optimal execution.',
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Single Rubric Dimension Schema
// ─────────────────────────────────────────────────────────────────────────────
export const RubricDimensionSchema = z.object({
  id: z.string().min(1, 'Dimension ID is required'),
  name: z
    .string()
    .trim()
    .min(2, 'Dimension name must be at least 2 characters')
    .max(80, 'Dimension name must not exceed 80 characters'),
  description: z
    .string()
    .trim()
    .min(10, 'Description must be at least 10 characters to clearly guide AI evaluation agents'),
  weight: z
    .number({ invalid_type_error: 'Weight must be a number' })
    .int('Weight must be an integer')
    .min(1, 'Dimension weight must be at least 1%')
    .max(100, 'Dimension weight cannot exceed 100%'),
  signals: z.array(z.string().trim().min(2, 'Signal cannot be blank')).default([]),
  redFlags: z.array(z.string().trim().min(2, 'Red flag condition cannot be blank')).default([]),
  scoringAnchors: z
    .array(ScoringAnchorSchema)
    .min(3, 'All three scoring levels (1, 3, 5) must be configured'),
});
export type RubricDimension = z.infer<typeof RubricDimensionSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Assessment Rubric Container Schema (Enforces 100% Sum Invariant)
// ─────────────────────────────────────────────────────────────────────────────
export const AssessmentRubricSchema = z
  .object({
    assessmentId: z.string().min(1, 'Assessment ID is required'),
    templateId: z.string().min(1, 'Template ID is required'),
    templateVersionId: z.string().min(1, 'Template Version ID is required (BR-03)'),
    dimensions: z
      .array(RubricDimensionSchema)
      .min(1, 'At least one scoring dimension is required in the rubric'),
  })
  .refine(
    (data) => {
      const sum = data.dimensions.reduce((acc, dim) => acc + (dim.weight || 0), 0);
      return sum === 100;
    },
    {
      message: 'Rubric dimensions must sum to exactly 100% before saving',
      path: ['dimensions'],
    }
  );
export type AssessmentRubric = z.infer<typeof AssessmentRubricSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Weight Calculation & Balance Status Utilities
// ─────────────────────────────────────────────────────────────────────────────
export type WeightBalanceStatus = 'under' | 'balanced' | 'over';

export interface WeightBalanceResult {
  totalWeight: number;
  remainingWeight: number;
  status: WeightBalanceStatus;
  isBalanced: boolean;
  difference: number;
  message: string;
}

/**
 * Calculates total allocated weight and balance status across rubric dimensions.
 * Avoids floating point issues by treating weights as integer percentages.
 */
export function calculateWeightBalance(
  dimensions: Array<{ weight: number }>
): WeightBalanceResult {
  const totalWeight = dimensions.reduce((acc, dim) => acc + (Number(dim.weight) || 0), 0);
  const remainingWeight = 100 - totalWeight;

  if (totalWeight === 100) {
    return {
      totalWeight,
      remainingWeight: 0,
      status: 'balanced',
      isBalanced: true,
      difference: 0,
      message: 'Rubric is perfectly balanced (100%)',
    };
  }

  if (totalWeight < 100) {
    const diff = 100 - totalWeight;
    return {
      totalWeight,
      remainingWeight,
      status: 'under',
      isBalanced: false,
      difference: diff,
      message: `${diff}% remaining to allocate`,
    };
  }

  const diff = totalWeight - 100;
  return {
    totalWeight,
    remainingWeight,
    status: 'over',
    isBalanced: false,
    difference: diff,
    message: `${diff}% over allocated (must total 100%)`,
  };
}

