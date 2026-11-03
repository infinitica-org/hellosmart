import { z } from 'zod';

export const SubmitDeliverablesDtoSchema = z.object({
  repositoryUrl: z.string().url('A valid repository URL is required'),
  branchName: z.string().min(1, 'Branch name is required'),
  uploadedArtifactId: z.string().optional().nullable(),
  architectureNotes: z.string().min(10, 'Architecture notes must be at least 10 characters'),
  confirmChecklist: z.boolean().refine((val) => val === true, {
    message: 'You must confirm that all deliverables are completed',
  }),
});

export type SubmitDeliverablesDto = z.infer<typeof SubmitDeliverablesDtoSchema>;

