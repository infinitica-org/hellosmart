import { z } from 'zod';

/**
 * Shared Password Policy (S0-T17 coordination):
 * - Min 12 characters, max 128 characters
 * - At least one uppercase letter ([A-Z])
 * - At least one lowercase letter ([a-z])
 * - At least one numeric digit ([0-9])
 * - At least one special symbol ([^A-Za-z0-9])
 */
export const PasswordPolicySchema = z
  .string()
  .min(12, 'Password must be at least 12 characters long')
  .max(128, 'Password must be at most 128 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export type PasswordPolicy = z.infer<typeof PasswordPolicySchema>;

/**
 * Public response returned by GET /auth/invitations/:token
 * when the invitation token is valid, unused, and unexpired.
 */
export const InvitationDetailsResponseSchema = z.object({
  email: z.string().email(),
  role: z.enum(['company_admin', 'candidate']),
  orgName: z.string().min(1),
});

export type InvitationDetailsResponse = z.infer<typeof InvitationDetailsResponseSchema>;

/**
 * Request body for POST /auth/invitations/accept
 */
export const AcceptInvitationRequestSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: PasswordPolicySchema,
});

export type AcceptInvitationRequest = z.infer<typeof AcceptInvitationRequestSchema>;

/**
 * Successful response for POST /auth/invitations/accept
 */
export const AcceptInvitationResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});

export type AcceptInvitationResponse = z.infer<typeof AcceptInvitationResponseSchema>;

