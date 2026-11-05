import { z } from 'zod';

export const UploadedArtifactMetadataSchema = z.object({
  id: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().max(52428800, 'File size cannot exceed 50 MB'),
  downloadUrl: z.string().url(),
  uploadedAt: z.string(),
});

export const SaveCandidateDraftDtoSchema = z.object({
  repositoryUrl: z.string().optional().or(z.literal('')),
  branchName: z.string().max(100).optional().or(z.literal('')),
  uploadedArtifact: UploadedArtifactMetadataSchema.optional().nullable(),
  architectureNotes: z.string().max(20000).default(''),
  version: z.number().int().nonnegative().optional(),
});

export type SaveCandidateDraftDto = z.infer<typeof SaveCandidateDraftDtoSchema>;

