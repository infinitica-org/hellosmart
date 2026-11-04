import { describe, expect, it } from 'vitest';
import { ExtendAssignmentTimeDtoSchema, TimingConfigSchema } from '@hs/contracts';
import {
  MAX_PAUSE_EXTENSION_MS,
  calculateDeadline,
  calculateEffectiveDeadline,
  calculateResumeDeadline,
  evaluateWindow,
  formatInstantInTimeZone,
  remainingSeconds,
  windowForbidden,
} from '../../src/modules/assessments/timing.service.js';

describe('Server timing calculator (BR-08, BR-09, S1-T03)', () => {
  it('adds duration in UTC across a DST fallback, a leap day, and a year boundary', () => {
    const dstStart = new Date('2026-11-01T05:30:00.000Z');
    const dstDeadline = calculateDeadline(dstStart, 90);
    expect(dstDeadline.toISOString()).toBe('2026-11-01T07:00:00.000Z');
    expect(dstDeadline.getTime() - dstStart.getTime()).toBe(90 * 60_000);

    const leap = new Date('2028-02-29T23:30:00.000Z');
    expect(calculateDeadline(leap, 90).toISOString()).toBe('2028-03-01T01:00:00.000Z');

    const yearEnd = new Date('2026-12-31T23:45:00.000Z');
    expect(calculateDeadline(yearEnd, 90).toISOString()).toBe('2027-01-01T01:15:00.000Z');
  });

  it('stores the IANA zone for display and does not use it in the deadline', () => {
    const connect = new Date('2026-11-01T05:30:00.000Z');
    const deadline = calculateEffectiveDeadline(
      { type: 'duration', durationMinutes: 90, tz: 'America/New_York' },
      connect,
    );
    expect(deadline.toISOString()).toBe('2026-11-01T07:00:00.000Z');
    const shown = formatInstantInTimeZone(deadline, 'America/New_York');
    expect(shown).toContain('2026');
    expect(TimingConfigSchema.parse({ tz: 'America/New_York' }).tz).toBe('America/New_York');
  });

  it('caps a combined assessment at the window end when duration would run past it', () => {
    const deadline = calculateEffectiveDeadline(
      {
        type: 'both',
        durationMinutes: 60,
        windowStartUtc: '2026-11-07T13:00:00.000Z',
        windowEndUtc: '2026-11-08T01:00:00.000Z',
        tz: 'America/New_York',
      },
      new Date('2026-11-08T00:45:00.000Z'),
    );
    expect(deadline.toISOString()).toBe('2026-11-08T01:00:00.000Z');
  });

  it('returns 403 with a countdown when the window has not opened', () => {
    const now = new Date('2026-11-07T12:00:00.000Z');
    const decision = evaluateWindow(
      {
        type: 'window',
        windowStartUtc: '2026-11-07T13:00:00.000Z',
        windowEndUtc: '2026-11-08T01:00:00.000Z',
      },
      now,
    );
    expect(decision.secondsUntilWindowStart).toBe(3600);
    const error = windowForbidden(decision, 'WINDOW_NOT_OPEN');
    const body = error.getResponse() as { code: string; secondsUntilWindowStart: number; status: number };
    expect(error.getStatus()).toBe(403);
    expect(body.code).toBe('WINDOW_NOT_OPEN');
    expect(body.secondsUntilWindowStart).toBe(3600);
  });

  it('keeps the clock running on disconnect unless pause is explicitly enabled (BR-09)', () => {
    const currentDeadline = new Date('2026-11-03T12:00:00.000Z');
    const disconnectedAt = new Date('2026-11-03T11:00:00.000Z');
    const resumedAt = new Date('2026-11-03T11:15:00.000Z');
    const unchanged = calculateResumeDeadline({
      currentDeadline,
      disconnectedAt,
      resumedAt,
      pauseTimerOnDisconnect: false,
    });
    expect(unchanged.toISOString()).toBe(currentDeadline.toISOString());
    expect(remainingSeconds(currentDeadline, resumedAt)).toBe(45 * 60);

    const paused = calculateResumeDeadline({
      currentDeadline,
      disconnectedAt,
      resumedAt,
      pauseTimerOnDisconnect: true,
    });
    expect(paused.getTime() - currentDeadline.getTime()).toBe(15 * 60_000);
  });

  it('caps a pause extension at 24 hours', () => {
    const currentDeadline = new Date('2026-11-03T12:00:00.000Z');
    const disconnectedAt = new Date('2026-11-01T12:00:00.000Z');
    const resumedAt = new Date('2026-11-04T12:00:00.000Z');
    const paused = calculateResumeDeadline({
      currentDeadline,
      disconnectedAt,
      resumedAt,
      pauseTimerOnDisconnect: true,
    });
    expect(paused.getTime() - currentDeadline.getTime()).toBe(MAX_PAUSE_EXTENSION_MS);
  });

  it('accepts snake_case additional_minutes on the accommodation payload', () => {
    const parsed = ExtendAssignmentTimeDtoSchema.parse({
      additional_minutes: 30,
      reason: 'Documented accommodation',
    });
    expect(parsed.additionalMinutes).toBe(30);
  });
});
