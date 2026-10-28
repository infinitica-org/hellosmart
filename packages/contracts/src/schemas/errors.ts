import { z } from 'zod';

/**
 * Standard RFC 7807 / RFC 9457 Problem Details schema.
 * All non-2xx responses from the HelloSmart API must conform to this schema.
 */
export const ProblemDetailsSchema = z.object({
  type: z.string().url().or(z.string().min(1)),
  title: z.string().min(1),
  status: z.number().int().min(100).max(599),
  detail: z.string().optional(),
  instance: z.string().optional(),
  code: z.string().optional(),
  requestId: z.string().optional(),
  invalidParams: z
    .array(
      z.object({
        name: z.string(),
        reason: z.string(),
      })
    )
    .optional(),
});

export type ProblemDetailsDto = z.infer<typeof ProblemDetailsSchema>;
