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

export const MfaVerifyDtoSchema = z.object({
  preAuthToken: z.string().min(1, 'Pre-authentication token is required'),
  totpCode: z.string().regex(/^[0-9]{6}$/, 'TOTP code must be exactly 6 digits'),
});
export type MfaVerifyDto = z.infer<typeof MfaVerifyDtoSchema>;

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
