import { z } from 'zod';

/**
 * Current authoritative consent legal text version (BR-12).
 * Updated whenever the legal notice, session telemetry disclosure, or timer rules change.
 */
export const CURRENT_CONSENT_TEXT_VERSION = 'v1.0';

/**
 * Schema for candidate assessment consent submission (BR-12).
 * Client submits assessmentId and the displayed textVersion.
 * Server validates assignment eligibility and generates authoritative acceptedAt UTC timestamp,
 * capturing client IP address and User-Agent from trusted request headers.
 */
export const assessmentConsentSchema = z.object({
  assessmentId: z.string().min(1, 'Assessment ID is required'),
  textVersion: z.string().min(1, 'Text version is required'),
});

export type AssessmentConsentInput = z.infer<typeof assessmentConsentSchema>;

/**
 * Server response schema upon durable consent recording in database.
 */
export const assessmentConsentResponseSchema = z.object({
  success: z.boolean(),
  consentId: z.string(),
  assessmentId: z.string(),
  textVersion: z.string(),
  acceptedAt: z.string().datetime({ offset: true }),
});

export type AssessmentConsentResponse = z.infer<typeof assessmentConsentResponseSchema>;

