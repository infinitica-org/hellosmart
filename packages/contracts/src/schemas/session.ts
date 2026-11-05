import { z } from 'zod';

export const SessionPublicDtoSchema = z.object({
  sessionId: z.string().uuid(),
  device: z.string(),
  ip: z.string(),
  createdAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
  current: z.boolean(),
});
export type SessionPublicDto = z.infer<typeof SessionPublicDtoSchema>;

export const SessionListResponseSchema = z.object({
  sessions: z.array(SessionPublicDtoSchema),
});
export type SessionListResponse = z.infer<typeof SessionListResponseSchema>;

export const RevokeSessionResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});
export type RevokeSessionResponse = z.infer<typeof RevokeSessionResponseSchema>;

export const LogoutAllResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});
export type LogoutAllResponse = z.infer<typeof LogoutAllResponseSchema>;

