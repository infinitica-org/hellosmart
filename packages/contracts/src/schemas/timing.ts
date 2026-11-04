import { z } from 'zod';

/**
 * Server-enforced assessment timing (BR-08, BR-09, CO-028, CO-029, CO-030).
 * Instants are UTC. `tz` is the IANA zone used only for display and company configuration.
 * Arithmetic never uses the local wall clock, so DST and leap days do not distort deadlines.
 */
export const TimingConfigSchema = z.object({
  type: z.enum(['duration', 'window', 'both']).default('duration'),
  durationMinutes: z.number().int().min(15).max(480).default(90),
  windowStartUtc: z.string().datetime().optional(),
  windowEndUtc: z.string().datetime().optional(),
  tz: z.string().default('UTC'),
  pauseTimerOnDisconnect: z.boolean().default(false),
});
export type TimingConfig = z.infer<typeof TimingConfigSchema>;

export const TimingStatusSchema = z.object({
  deadlineAtUtc: z.string().datetime().nullable(),
  remainingSeconds: z.number().int().nonnegative().nullable(),
  isExpired: z.boolean(),
  timezone: z.string(),
  serverNowUtc: z.string().datetime(),
  windowStatus: z.enum(['window_not_open', 'ready', 'expired']),
  pauseTimerOnDisconnect: z.boolean(),
  secondsUntilWindowStart: z.number().int().nonnegative().nullable(),
});
export type TimingStatus = z.infer<typeof TimingStatusSchema>;

export const ExtendAssignmentTimeDtoSchema = z.preprocess((input) => {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    const raw = input as Record<string, unknown>;
    if ('additional_minutes' in raw || 'additionalMinutes' in raw) {
      return {
        additionalMinutes: raw.additionalMinutes ?? raw.additional_minutes,
        reason: raw.reason,
      };
    }
  }
  return input;
}, z.object({
  additionalMinutes: z.number().int().min(1).max(480),
  reason: z.string().trim().min(3).max(500),
}));
export type ExtendAssignmentTimeDto = z.infer<typeof ExtendAssignmentTimeDtoSchema>;

export const WorkspaceEventDtoSchema = z.object({
  eventType: z.enum(['connect', 'disconnect', 'resume', 'fullscreen_exit']),
  clientTimestamp: z.string().datetime().optional(),
});
export type WorkspaceEventDto = z.infer<typeof WorkspaceEventDtoSchema>;
