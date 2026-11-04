/**
 * Pure timing and window boundary logic (BR-08, BR-09, CO-028, CO-030, CO-031).
 *
 * This module contains pure, deterministic calculations for assessment deadlines,
 * window boundary status, pause-on-disconnect adjustments, and timely submission validation.
 * It is completely independent of external I/O, database clocks, or HTTP servers,
 * making it suitable for exhaustive unit testing with simulated time travel.
 */

export interface TimingWindowConfig {
  type?: 'duration' | 'window' | 'both';
  durationMinutes?: number;
  windowStartUtc?: string | null;
  windowEndUtc?: string | null;
  tz?: string;
  pauseTimerOnDisconnect?: boolean;
}

export type WindowStatus = 'window_not_open' | 'ready' | 'expired';

/**
 * Calculates deadline from first connect time and duration in minutes,
 * optionally adding extended minutes granted by company admin (CO-031).
 */
export function calculateDeadline(
  firstConnectAt: Date,
  durationMinutes: number,
  extendedMinutes: number = 0,
): Date {
  if (isNaN(firstConnectAt.getTime())) {
    throw new TypeError('Invalid firstConnectAt date');
  }
  const totalMinutes = durationMinutes + extendedMinutes;
  return new Date(firstConnectAt.getTime() + totalMinutes * 60_000);
}

/**
 * Determines whether current reference time is within, before, or after the assessment window.
 * Window start and window end are both INCLUSIVE (BR-08 boundary decision):
 * - referenceTime < windowStartUtc => 'window_not_open' (HTTP 403 WINDOW_NOT_OPEN)
 * - windowStartUtc <= referenceTime <= windowEndUtc => 'ready'
 * - referenceTime > windowEndUtc => 'expired' (HTTP 403 WINDOW_EXPIRED or ASSIGNMENT_EXPIRED - Open Question for Vishal V)
 */
export function checkWindowStatus(timing: TimingWindowConfig, referenceTime: Date): WindowStatus {
  if (isNaN(referenceTime.getTime())) {
    throw new TypeError('Invalid referenceTime date');
  }

  // Pure duration assessments without window bounds are always ready to launch
  if (timing.type === 'duration' && !timing.windowStartUtc && !timing.windowEndUtc) {
    return 'ready';
  }

  if (timing.windowStartUtc) {
    const startMs = new Date(timing.windowStartUtc).getTime();
    if (referenceTime.getTime() < startMs) {
      return 'window_not_open';
    }
  }

  if (timing.windowEndUtc) {
    const endMs = new Date(timing.windowEndUtc).getTime();
    if (referenceTime.getTime() > endMs) {
      return 'expired';
    }
  }

  return 'ready';
}

/**
 * Convenience predicate checking if reference time is within window.
 */
export function isWithinWindow(timing: TimingWindowConfig, referenceTime: Date): boolean {
  return checkWindowStatus(timing, referenceTime) === 'ready';
}

/**
 * Calculates effective deadline for all three timing modes (duration, window, both).
 * For 'both' mode (CO-030):
 *   base_deadline = min(firstConnectAt + duration_minutes, window_end_utc)
 *   effective_deadline = base_deadline + extended_minutes
 */
export function calculateEffectiveDeadline(
  timing: TimingWindowConfig,
  firstConnectAt: Date,
  extendedMinutes: number = 0,
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
    // Ceiling is whichever comes first: duration expiry or window end
    const earliestCeilingMs = Math.min(durationDeadline.getTime(), windowEnd.getTime());
    return new Date(earliestCeilingMs + extendedMinutes * 60_000);
  }

  // Default: duration mode
  return new Date(durationDeadline.getTime() + extendedMinutes * 60_000);
}

/**
 * Calculates updated deadline on session resume after a disconnect (BR-09).
 *
 * Invariant (BR-09):
 * - If pauseTimerOnDisconnect is false (default):
 *   The timer keeps running while disconnected. Deadline remains completely unchanged.
 * - If pauseTimerOnDisconnect is true:
 *   Deadline is shifted forward by the exact disconnect duration (resumedAt - disconnectedAt).
 *   However, in 'window' or 'both' mode, the deadline CANNOT extend past the hard ceiling
 *   of windowEndUtc + extendedMinutes (CO-030).
 * - Clock moving backwards or zero disconnect time leaves deadline unchanged.
 */
export function calculateResumeDeadline(params: {
  currentDeadline: Date;
  disconnectedAt: Date;
  resumedAt: Date;
  pauseTimerOnDisconnect: boolean;
  windowEndUtc?: string | null;
  extendedMinutes?: number;
}): Date {
  const {
    currentDeadline,
    disconnectedAt,
    resumedAt,
    pauseTimerOnDisconnect,
    windowEndUtc,
    extendedMinutes = 0,
  } = params;

  // Rule BR-09 default: timer NEVER pauses on disconnect
  if (!pauseTimerOnDisconnect) {
    return new Date(currentDeadline.getTime());
  }

  // Safety: if resumedAt <= disconnectedAt (clock skew or backwards leap), do not extend deadline
  if (resumedAt.getTime() <= disconnectedAt.getTime()) {
    return new Date(currentDeadline.getTime());
  }

  const disconnectDurationMs = resumedAt.getTime() - disconnectedAt.getTime();
  const adjustedDeadlineMs = currentDeadline.getTime() + disconnectDurationMs;

  // If there is a window end, apply the hard window ceiling
  if (windowEndUtc) {
    const windowCeilingMs = new Date(windowEndUtc).getTime() + extendedMinutes * 60_000;
    return new Date(Math.min(adjustedDeadlineMs, windowCeilingMs));
  }

  return new Date(adjustedDeadlineMs);
}

/**
 * Checks whether a submission timestamp is timely against the deadline (BR-08).
 * Boundary rule:
 * - submittedAt <= deadlineAt is timely (inclusive: submitted exactly at deadline is ACCEPTED).
 * - submittedAt > deadlineAt is late / rejected (auto-submit sweeper should have handled it).
 */
export function isSubmissionTimely(submittedAt: Date, deadlineAt: Date): boolean {
  return submittedAt.getTime() <= deadlineAt.getTime();
}
