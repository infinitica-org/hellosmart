import { HttpException, Injectable } from '@nestjs/common';
import type { TimingConfig } from '@hs/contracts';
import { problem } from '../../common/errors/app-http.exception.js';

export const MAX_PAUSE_EXTENSION_MS = 24 * 60 * 60 * 1000;

export type WindowStatus = 'window_not_open' | 'ready' | 'expired';

export interface TimingWindowConfig {
  type?: 'duration' | 'window' | 'both' | undefined;
  durationMinutes?: number | undefined;
  windowStartUtc?: string | null | undefined;
  windowEndUtc?: string | null | undefined;
  tz?: string | null | undefined;
  pauseTimerOnDisconnect?: boolean | undefined;
}

export interface WindowDecision {
  status: WindowStatus;
  secondsUntilWindowStart: number | null;
  windowStartsAtUtc: string | null;
}

/**
 * Validates an IANA timezone. Throws 422 when the zone is not recognized.
 * Storage keeps this string beside UTC instants; it is never used for deadline math (BR-08).
 */
export function assertIanaTimeZone(tz: string): string {
  const zone = tz.trim();
  if (!zone) {
    throw problem({
      title: 'Unprocessable Entity',
      status: 422,
      detail: 'A configured IANA timezone is required.',
      code: 'INVALID_TIMEZONE',
    });
  }
  try {
    Intl.DateTimeFormat('en-US', { timeZone: zone }).format(new Date());
  } catch {
    throw problem({
      title: 'Unprocessable Entity',
      status: 422,
      detail: `Timezone '${zone}' is not a valid IANA zone.`,
      code: 'INVALID_TIMEZONE',
    });
  }
  return zone;
}

/** Formats a UTC instant in the configured IANA zone for emails and UI. Arithmetic stays in UTC. */
export function formatInstantInTimeZone(instant: Date, timeZone: string): string {
  const zone = assertIanaTimeZone(timeZone);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'short',
  }).format(instant);
}

export function calculateDeadline(
  firstConnectAt: Date,
  durationMinutes: number,
  extendedMinutes = 0,
): Date {
  if (Number.isNaN(firstConnectAt.getTime())) {
    throw new TypeError('Invalid firstConnectAt date');
  }
  const totalMinutes = durationMinutes + extendedMinutes;
  return new Date(firstConnectAt.getTime() + totalMinutes * 60_000);
}

export function checkWindowStatus(timing: TimingWindowConfig, referenceTime: Date): WindowStatus {
  return evaluateWindow(timing, referenceTime).status;
}

export function evaluateWindow(timing: TimingWindowConfig, referenceTime: Date): WindowDecision {
  if (Number.isNaN(referenceTime.getTime())) {
    throw new TypeError('Invalid referenceTime date');
  }

  if (timing.type === 'duration' && !timing.windowStartUtc && !timing.windowEndUtc) {
    return { status: 'ready', secondsUntilWindowStart: null, windowStartsAtUtc: null };
  }

  if (timing.windowStartUtc) {
    const startMs = new Date(timing.windowStartUtc).getTime();
    if (referenceTime.getTime() < startMs) {
      const secondsUntilWindowStart = Math.max(0, Math.ceil((startMs - referenceTime.getTime()) / 1000));
      return {
        status: 'window_not_open',
        secondsUntilWindowStart,
        windowStartsAtUtc: new Date(startMs).toISOString(),
      };
    }
  }

  if (timing.windowEndUtc) {
    const endMs = new Date(timing.windowEndUtc).getTime();
    if (referenceTime.getTime() > endMs) {
      return { status: 'expired', secondsUntilWindowStart: null, windowStartsAtUtc: null };
    }
  }

  return { status: 'ready', secondsUntilWindowStart: null, windowStartsAtUtc: null };
}

/**
 * Effective deadline (CO-030, CO-031 Reading A):
 * duration: first_connect + duration + extended_minutes
 * window:   window_end + extended_minutes
 * both:     min(first_connect + duration, window_end) + extended_minutes
 * All addition is UTC milliseconds, so DST and leap days cannot stretch or shrink the duration.
 */
export function calculateEffectiveDeadline(
  timing: TimingWindowConfig,
  firstConnectAt: Date,
  extendedMinutes = 0,
): Date {
  const duration = timing.durationMinutes ?? 90;
  const durationDeadline = calculateDeadline(firstConnectAt, duration, 0);

  if (timing.type === 'window') {
    if (!timing.windowEndUtc) {
      throw new Error('windowEndUtc is required for window timing mode');
    }
    const windowEnd = new Date(timing.windowEndUtc);
    return new Date(windowEnd.getTime() + extendedMinutes * 60_000);
  }

  if (timing.type === 'both') {
    if (!timing.windowEndUtc) {
      return new Date(durationDeadline.getTime() + extendedMinutes * 60_000);
    }
    const windowEnd = new Date(timing.windowEndUtc);
    const earliestCeilingMs = Math.min(durationDeadline.getTime(), windowEnd.getTime());
    return new Date(earliestCeilingMs + extendedMinutes * 60_000);
  }

  return new Date(durationDeadline.getTime() + extendedMinutes * 60_000);
}

/**
 * BR-09: the clock keeps running unless pauseTimerOnDisconnect is explicitly true.
 * A pause longer than 24 hours is capped so a stuck client cannot extend the test forever.
 * Combined and window modes cannot be pushed past window_end + extended minutes.
 */
export function calculateResumeDeadline(params: {
  currentDeadline: Date;
  disconnectedAt: Date;
  resumedAt: Date;
  pauseTimerOnDisconnect: boolean;
  windowEndUtc?: string | null | undefined;
  extendedMinutes?: number | undefined;
}): Date {
  const {
    currentDeadline,
    disconnectedAt,
    resumedAt,
    pauseTimerOnDisconnect,
    windowEndUtc,
    extendedMinutes = 0,
  } = params;

  if (!pauseTimerOnDisconnect) {
    return new Date(currentDeadline.getTime());
  }

  if (resumedAt.getTime() <= disconnectedAt.getTime()) {
    return new Date(currentDeadline.getTime());
  }

  const disconnectDurationMs = Math.min(
    resumedAt.getTime() - disconnectedAt.getTime(),
    MAX_PAUSE_EXTENSION_MS,
  );
  const adjustedDeadlineMs = currentDeadline.getTime() + disconnectDurationMs;

  if (windowEndUtc) {
    const windowCeilingMs = new Date(windowEndUtc).getTime() + extendedMinutes * 60_000;
    return new Date(Math.min(adjustedDeadlineMs, windowCeilingMs));
  }

  return new Date(adjustedDeadlineMs);
}

export function isSubmissionTimely(submittedAt: Date, deadlineAt: Date): boolean {
  return submittedAt.getTime() <= deadlineAt.getTime();
}

export function remainingSeconds(deadlineAt: Date, now: Date): number {
  return Math.max(0, Math.floor((deadlineAt.getTime() - now.getTime()) / 1000));
}

export function isExpired(deadlineAt: Date, now: Date): boolean {
  return now.getTime() >= deadlineAt.getTime();
}

export function parseTimingConfig(value: unknown): TimingConfig {
  const raw = (value && typeof value === 'object' ? value : {}) as TimingWindowConfig;
  const tz = typeof raw.tz === 'string' && raw.tz.trim() ? raw.tz : 'UTC';
  return {
    type: raw.type ?? 'duration',
    durationMinutes: raw.durationMinutes ?? 90,
    ...(raw.windowStartUtc ? { windowStartUtc: raw.windowStartUtc } : {}),
    ...(raw.windowEndUtc ? { windowEndUtc: raw.windowEndUtc } : {}),
    tz: assertIanaTimeZone(tz),
    pauseTimerOnDisconnect: raw.pauseTimerOnDisconnect ?? false,
  };
}

export function windowForbidden(decision: WindowDecision, code: 'WINDOW_NOT_OPEN' | 'WINDOW_EXPIRED') {
  const detail =
    code === 'WINDOW_NOT_OPEN'
      ? `This assessment is not open yet. It opens in ${decision.secondsUntilWindowStart ?? 0} seconds.`
      : 'This assessment window has closed.';
  return new HttpException(
    {
      type: `https://hellosmart.ai/problems/${code.toLowerCase()}`,
      title: 'Forbidden',
      status: 403,
      detail,
      code,
      secondsUntilWindowStart: decision.secondsUntilWindowStart,
      windowStartsAtUtc: decision.windowStartsAtUtc,
    },
    403,
  );
}

@Injectable()
export class TimingService {
  assertIanaTimeZone(tz: string): string {
    return assertIanaTimeZone(tz);
  }

  formatInstantInTimeZone(instant: Date, timeZone: string): string {
    return formatInstantInTimeZone(instant, timeZone);
  }

  calculateEffectiveDeadline(
    timing: TimingWindowConfig,
    firstConnectAt: Date,
    extendedMinutes = 0,
  ): Date {
    return calculateEffectiveDeadline(timing, firstConnectAt, extendedMinutes);
  }

  evaluateWindow(timing: TimingWindowConfig, referenceTime: Date): WindowDecision {
    return evaluateWindow(timing, referenceTime);
  }

  calculateResumeDeadline(
    params: Parameters<typeof calculateResumeDeadline>[0],
  ): Date {
    return calculateResumeDeadline(params);
  }

  status(params: {
    timing: TimingWindowConfig;
    deadlineAt: Date | null;
    now: Date;
  }) {
    const zone = assertIanaTimeZone(params.timing.tz ?? 'UTC');
    const decision = evaluateWindow(params.timing, params.now);
    if (!params.deadlineAt) {
      return {
        deadlineAtUtc: null,
        remainingSeconds: null,
        isExpired: decision.status === 'expired',
        timezone: zone,
        serverNowUtc: params.now.toISOString(),
        windowStatus: decision.status,
        pauseTimerOnDisconnect: params.timing.pauseTimerOnDisconnect ?? false,
        secondsUntilWindowStart: decision.secondsUntilWindowStart,
      };
    }
    return {
      deadlineAtUtc: params.deadlineAt.toISOString(),
      remainingSeconds: remainingSeconds(params.deadlineAt, params.now),
      isExpired: isExpired(params.deadlineAt, params.now) || decision.status === 'expired',
      timezone: zone,
      serverNowUtc: params.now.toISOString(),
      windowStatus: decision.status,
      pauseTimerOnDisconnect: params.timing.pauseTimerOnDisconnect ?? false,
      secondsUntilWindowStart: decision.secondsUntilWindowStart,
    };
  }
}
