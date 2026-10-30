import { z } from 'zod';
import { MeDtoSchema } from './user.js';

export const LoginDtoSchema = z.object({
  email: z.string().email('Invalid email address format').max(254),
  password: z.string().min(1, 'Password is required').max(256),
  mfaCode: z
    .string()
    .regex(/^[0-9]{6}$/, 'MFA code must be exactly 6 digits')
    .optional(),
});
export type LoginDto = z.infer<typeof LoginDtoSchema>;

export const SsoProviderEnum = z.enum(['google', 'microsoft']);
export type SsoProvider = z.infer<typeof SsoProviderEnum>;

export const SsoVerifyDtoSchema = z.object({
  provider: SsoProviderEnum,
  idToken: z.string().min(1, 'ID token is required'),
});
export type SsoVerifyDto = z.infer<typeof SsoVerifyDtoSchema>;

/** Normalizes backup codes to canonical `XXXX-XXXX` (accepts 8 chars without dash). */
export function normalizeMfaBackupCodeInput(raw: unknown): string | undefined {
  if (typeof raw !== 'string') {
    return undefined;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  const cleaned = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.length === 8) {
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
  }
  return trimmed.toUpperCase();
}

export const MfaVerifyDtoSchema = z
  .object({
    preAuthToken: z.string().min(1, 'Pre-authentication token is required'),
    totpCode: z
      .string()
      .regex(/^[0-9]{6}$/, 'TOTP code must be exactly 6 digits')
      .optional(),
    backupCode: z.preprocess(
      normalizeMfaBackupCodeInput,
      z
        .string()
        .regex(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/i, 'Backup code must be formatted XXXX-XXXX')
        .optional(),
    ),
  })
  .refine((v) => Boolean(v.totpCode || v.backupCode), {
    message: 'Either a TOTP code or backup code is required',
    path: ['totpCode'],
  });
export type MfaVerifyDto = z.infer<typeof MfaVerifyDtoSchema>;

export const MfaStatusResponseSchema = z.object({
  enrolled: z.boolean(),
  backupCodesRemaining: z.number().int().nonnegative(),
});
export type MfaStatusResponse = z.infer<typeof MfaStatusResponseSchema>;

export const MfaSetupStartResponseSchema = z.object({
  secret: z.string(),
  otpauthUri: z.string(),
});
export type MfaSetupStartResponse = z.infer<typeof MfaSetupStartResponseSchema>;

export const MfaSetupConfirmDtoSchema = z.object({
  totpCode: z.string().regex(/^[0-9]{6}$/, 'TOTP code must be exactly 6 digits'),
});
export type MfaSetupConfirmDto = z.infer<typeof MfaSetupConfirmDtoSchema>;

export const MfaSetupConfirmResponseSchema = z.object({
  backupCodes: z.array(z.string()),
});
export type MfaSetupConfirmResponse = z.infer<typeof MfaSetupConfirmResponseSchema>;

export const MfaBackupRegenerateDtoSchema = MfaSetupConfirmDtoSchema;
export type MfaBackupRegenerateDto = z.infer<typeof MfaBackupRegenerateDtoSchema>;

export const ChangePasswordDtoSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required').max(128),
  newPassword: z.string().min(1, 'New password is required').max(128),
});
export type ChangePasswordDto = z.infer<typeof ChangePasswordDtoSchema>;

export const ChangePasswordResponseDtoSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type ChangePasswordResponseDto = z.infer<typeof ChangePasswordResponseDtoSchema>;

export const LogoutResponseDtoSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});
export type LogoutResponseDto = z.infer<typeof LogoutResponseDtoSchema>;

export const LoginResponseDtoSchema = z.union([
  MeDtoSchema,
  z.object({
    mfaRequired: z.literal(true),
    preAuthToken: z.string(),
  }),
]);
export type LoginResponseDto = z.infer<typeof LoginResponseDtoSchema>;

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

/**
 * Request body for POST /auth/login
 */
export const LoginRequestSchema = z.object({
  email: z.string().email('Valid email is required').max(254),
  password: z.string().min(1, 'Password is required').max(256),
  mfaCode: z.string().regex(/^[0-9]{6}$/, 'MFA code must be 6 digits').optional(),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

/**
 * Request body for POST /auth/password/change
 */
export const ChangePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1).max(256).optional(),
  newPassword: PasswordPolicySchema,
});

export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;

/**
 * Common success response (e.g. for POST /auth/logout, POST /auth/password/change)
 */
export const SimpleSuccessResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});

export type SimpleSuccessResponse = z.infer<typeof SimpleSuccessResponseSchema>;

/**
 * Active Session Schema (S0-T16-2)
 */
export const ActiveSessionSchema = z.object({
  id: z.string(),
  sessionId: z.string().optional(),
  userAgent: z.string().optional(),
  device: z.string().optional(),
  ipAddress: z.string().optional(),
  ip: z.string().optional(),
  createdAt: z.string(),
  lastActiveAt: z.string(),
  lastSeenAt: z.string().optional(),
  isCurrent: z.boolean(),
  current: z.boolean().optional(),
});

export type ActiveSession = z.infer<typeof ActiveSessionSchema>;

export const ActiveSessionsResponseSchema = z.object({
  sessions: z.array(ActiveSessionSchema),
});

export type ActiveSessionsResponse = z.infer<typeof ActiveSessionsResponseSchema>;
