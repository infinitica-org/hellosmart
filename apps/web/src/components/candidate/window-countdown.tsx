'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';

export interface WindowCountdownProps {
  /** Target opening timestamp in UTC (ISO 8601 string or Date) */
  targetDateUtc: string | Date;
  /** Callback fired exactly once when the countdown hits zero */
  onZero?: () => void;
  /** Optional container class name */
  className?: string;
  /** Whether to show seconds block (default: true) */
  showSeconds?: boolean;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

function calculateTimeRemaining(targetUtc: string | Date): TimeRemaining {
  const targetTime = typeof targetUtc === 'string' ? new Date(targetUtc).getTime() : targetUtc.getTime();
  const now = Date.now();
  const totalMs = Math.max(0, targetTime - now);

  const totalSeconds = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds, totalMs };
}

function padZero(value: number): string {
  return String(value).padStart(2, '0');
}

export function WindowCountdown({
  targetDateUtc,
  onZero,
  className = '',
  showSeconds = true,
}: WindowCountdownProps): React.JSX.Element {
  const [timeLeft, setTimeLeft] = useState<TimeRemaining>(() => calculateTimeRemaining(targetDateUtc));
  const hasTriggeredZeroRef = useRef(false);
  const onZeroRef = useRef(onZero);
  onZeroRef.current = onZero;

  useEffect(() => {
    // Reset zero guard if target date changes
    hasTriggeredZeroRef.current = false;

    // Check immediate status
    const initial = calculateTimeRemaining(targetDateUtc);
    setTimeLeft(initial);

    if (initial.totalMs <= 0) {
      if (!hasTriggeredZeroRef.current) {
        hasTriggeredZeroRef.current = true;
        onZeroRef.current?.();
      }
      return;
    }

    const intervalId = window.setInterval(() => {
      const remaining = calculateTimeRemaining(targetDateUtc);
      setTimeLeft(remaining);

      if (remaining.totalMs <= 0) {
        window.clearInterval(intervalId);
        if (!hasTriggeredZeroRef.current) {
          hasTriggeredZeroRef.current = true;
          onZeroRef.current?.();
        }
      }
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [targetDateUtc]);

  return (
    <div
      className={`rounded-lg bg-neutral-50/80 dark:bg-neutral-800/40 border border-neutral-200/80 dark:border-neutral-700/80 p-3 sm:p-3.5 ${className}`}
      role="timer"
      aria-live="polite"
      aria-label="Assessment opening countdown"
    >
      <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" aria-hidden="true" />
          <span className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Assessment opens in
          </span>
        </div>
        <span className="text-[11px] font-medium text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/50 border border-sky-200/80 dark:border-sky-800/80 px-2 py-0.5 rounded-full">
          Not yet open
        </span>
      </div>

      {/* Countdown digit tiles */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-2.5" data-testid="countdown-blocks">
        {/* Days */}
        <div className="flex flex-col items-center justify-center py-2 px-3 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-2xs">
          <span className="text-lg sm:text-xl font-bold font-mono tracking-tight text-neutral-900 dark:text-neutral-100" data-testid="countdown-days">
            {padZero(timeLeft.days)}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mt-0.5 font-medium">
            Days
          </span>
        </div>

        {/* Hours */}
        <div className="flex flex-col items-center justify-center py-2 px-3 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-2xs">
          <span className="text-lg sm:text-xl font-bold font-mono tracking-tight text-neutral-900 dark:text-neutral-100" data-testid="countdown-hours">
            {padZero(timeLeft.hours)}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mt-0.5 font-medium">
            Hours
          </span>
        </div>

        {/* Minutes */}
        <div className="flex flex-col items-center justify-center py-2 px-3 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-2xs">
          <span className="text-lg sm:text-xl font-bold font-mono tracking-tight text-neutral-900 dark:text-neutral-100" data-testid="countdown-minutes">
            {padZero(timeLeft.minutes)}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mt-0.5 font-medium">
            Minutes
          </span>
        </div>

        {/* Seconds (shown on sm+ or when showSeconds is true) */}
        {showSeconds && (
          <div className="hidden sm:flex flex-col items-center justify-center py-2 px-3 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-2xs">
            <span className="text-lg sm:text-xl font-bold font-mono tracking-tight text-neutral-900 dark:text-neutral-100" data-testid="countdown-seconds">
              {padZero(timeLeft.seconds)}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mt-0.5 font-medium">
              Seconds
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

