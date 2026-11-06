import { z } from 'zod';

export const ReviewerRubricItemSchema = z.object({
  id: z.string().uuid(),
  agent_id: z.string().min(1),
  name: z.string().min(1),
  goal: z.string().min(1),
  scale: z.object({
    min: z.number().int().default(1),
    max: z.number().int().default(5),
  }),
  weight: z.number().min(0).max(100),
  red_flags: z.array(z.string()).default([]),
});
export type ReviewerRubricItem = z.infer<typeof ReviewerRubricItemSchema>;

export const ReviewerDispatchJobSchema = z.object({
  jobId: z.string().uuid(),
  submissionId: z.string().uuid(),
  assignmentId: z.string().uuid(),
  candidateId: z.string().uuid(),
  orgId: z.string().uuid(),
  snapshotS3Uri: z.string().url(),
  aiTranscriptS3Uri: z.string().url().optional(),
  rubricItems: z.array(ReviewerRubricItemSchema).min(1),
  submittedAt: z.string().datetime(),
  autoSubmitted: z.boolean().default(false),
});
export type ReviewerDispatchJob = z.infer<typeof ReviewerDispatchJobSchema>;

export const AgentScoreEvidenceSchema = z.object({
  source: z.enum(['file', 'terminal', 'ai_chat', 'test_run']),
  citation: z.string().min(1),
  line_numbers: z.array(z.number().int().positive()).optional(),
  timestamp: z.string().datetime().optional(),
  snippet: z.string().optional(),
});
export type AgentScoreEvidence = z.infer<typeof AgentScoreEvidenceSchema>;

export const AgentScoreResultSchema = z.object({
  rubricItemId: z.string().uuid(),
  agentId: z.string().min(1),
  score: z.number().min(1).max(5),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1),
  evidence: z.array(AgentScoreEvidenceSchema).min(1),
  redFlagsTriggered: z.array(z.string()).default([]),
});
export type AgentScoreResult = z.infer<typeof AgentScoreResultSchema>;

export const ReviewerRunReportSchema = z.object({
  submissionId: z.string().uuid(),
  overallScore: z.number().min(0).max(100),
  status: z.enum(['success', 'partial_failure', 'flagged_disagreement']),
  agentScores: z.array(AgentScoreResultSchema).min(1),
  completedAt: z.string().datetime(),
  totalTokensConsumed: z.number().int().positive(),
  totalCostUsd: z.number().positive(),
});
export type ReviewerRunReport = z.infer<typeof ReviewerRunReportSchema>;
