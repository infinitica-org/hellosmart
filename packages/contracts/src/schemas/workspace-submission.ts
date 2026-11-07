import { z } from 'zod';

/**
 * Authoritative timing response from Stream 3 timing engine
 */
export const AssessmentTimingResponseSchema = z.object({
  assessmentId: z.string(),
  serverTimeUtc: z.string().datetime(),
  deadlineUtc: z.string().datetime(),
  durationMinutes: z.number().int().positive(),
  pauseTimerOnDisconnect: z.boolean().default(false),
  isExpired: z.boolean().default(false),
  remainingMs: z.number().int().nonnegative(),
});
export type AssessmentTimingResponse = z.infer<typeof AssessmentTimingResponseSchema>;

/**
 * Uploaded deliverable artifact metadata (Stream 4 storage integration)
 */
export const UploadedArtifactMetadataSchema = z.object({
  id: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().max(52428800, 'File size cannot exceed 50 MB'),
  downloadUrl: z.string().url(),
  uploadedAt: z.string().datetime(),
});
export type UploadedArtifactMetadata = z.infer<typeof UploadedArtifactMetadataSchema>;

/**
 * Candidate assessment draft payload for 30-second autosave (BR-11)
 */
export const CandidateDraftSchema = z.object({
  assessmentId: z.string(),
  repositoryUrl: z.string().url().optional().or(z.literal('')),
  branchName: z.string().max(100).optional().or(z.literal('')),
  uploadedArtifact: UploadedArtifactMetadataSchema.optional().nullable(),
  architectureNotes: z.string().max(20000).default(''),
  version: z.number().int().nonnegative().default(1),
  updatedAt: z.string().datetime().optional(),
});
export type CandidateDraft = z.infer<typeof CandidateDraftSchema>;

/**
 * Submit assessment DTO
 */
export const SubmitAssessmentDtoSchema = z.object({
  assessmentId: z.string(),
  repositoryUrl: z.string().url('A valid repository URL is required'),
  branchName: z.string().min(1, 'Branch name is required'),
  uploadedArtifactId: z.string().optional().nullable(),
  architectureNotes: z.string().min(10, 'Architecture notes must be at least 10 characters'),
  confirmChecklist: z.boolean().refine((val) => val === true, {
    message: 'You must confirm that all deliverables are completed',
  }),
});
export type SubmitAssessmentDto = z.infer<typeof SubmitAssessmentDtoSchema>;

/**
 * Final submission confirmation response
 */
export const SubmitAssessmentResponseSchema = z.object({
  success: z.boolean(),
  submissionId: z.string(),
  assessmentId: z.string(),
  receiptId: z.string(),
  submittedAt: z.string().datetime(),
});
export type SubmitAssessmentResponse = z.infer<typeof SubmitAssessmentResponseSchema>;

/**
 * Workspace activity heartbeat response (I174, BR-08, BR-11)
 */
export const WorkspaceHeartbeatResponseSchema = z.object({
  success: z.boolean(),
  serverTimeUtc: z.string().datetime(),
  workspaceStatus: z.string(),
  assignmentStatus: z.string(),
  deadlineUtc: z.string().datetime().nullable().optional(),
  remainingMs: z.number().int().nonnegative().nullable().optional(),
});
export type WorkspaceHeartbeatResponse = z.infer<typeof WorkspaceHeartbeatResponseSchema>;


