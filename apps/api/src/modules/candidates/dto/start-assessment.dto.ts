import { z } from 'zod';

export const StartAssessmentDtoSchema = z.object({
  diagnosticsPassed: z.boolean().optional(),
});

export type StartAssessmentDto = z.infer<typeof StartAssessmentDtoSchema>;

