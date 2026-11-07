'use client';

import React, { useState, useEffect, forwardRef, HTMLAttributes } from 'react';
import { Clock, AlertTriangle, AlertOctagon } from 'lucide-react';

export interface CountdownTimerProps extends HTMLAttributes<HTMLDivElement> {
  deadlineUtc?: string | Date | undefined;
  formattedTime?: string | undefined;
  isWarning?: boolean | undefined;
  isExpired?: boolean | undefined;
  remainingMs?: number | undefined;
  pauseTimerOnDisconnect?: boolean | undefined;
  onExpire?: (() => void) | undefined;
  warningThresholdMinutes?: number | undefined;
}

export const CountdownTimer = forwardRef<HTMLDivElement, CountdownTimerProps>(
  (
    {
      deadlineUtc,
      formattedTime: controlledFormattedTime,
      isWarning: controlledIsWarning,
      isExpired: controlledIsExpired,
      remainingMs: _controlledRemainingMs,
      pauseTimerOnDisconnect = false,
      onExpire,
      warningThresholdMinutes = 15,
      className = '',
      ...props
    },
    ref
  ) => {
    const targetMs = deadlineUtc ? new Date(deadlineUtc).getTime() : 0;
    const [timeLeftMs, setTimeLeftMs] = useState<number>(() =>
      targetMs ? Math.max(0, targetMs - Date.now()) : 0
    );

    useEffect(() => {
      if (!targetMs) return;

      setTimeLeftMs(Math.max(0, targetMs - Date.now()));

      const interval = setInterval(() => {
        const remaining = Math.max(0, targetMs - Date.now());
        setTimeLeftMs(remaining);

        if (remaining <= 0) {
          clearInterval(interval);
          onExpire?.();
        }
      }, 1000);

      return () => clearInterval(interval);
    }, [targetMs, onExpire]);

    const pad = (n: number) => n.toString().padStart(2, '0');

    // Self-calculated timing if deadlineUtc is passed
    const totalSeconds = Math.floor(timeLeftMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const calculatedFormattedTime =
      hours > 0
        ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
        : `${pad(minutes)}:${pad(seconds)}`;

    // Final state determination (controlled props take precedence if passed)
    const isExpired =
      controlledIsExpired !== undefined
        ? controlledIsExpired
        : targetMs > 0 && totalSeconds === 0;

    const isWarning =
      controlledIsWarning !== undefined
        ? controlledIsWarning
        : totalSeconds > 0 && totalSeconds <= warningThresholdMinutes * 60;

    const isCritical = totalSeconds > 0 && totalSeconds <= 300; // 5 min

    const displayTime = controlledFormattedTime ?? calculatedFormattedTime;

    const testId = isExpired
      ? 'timer-expired-bar'
      : isWarning
        ? 'timer-warning-bar'
        : 'timer-normal-bar';

    if (isExpired) {
      return (
        <div
          ref={ref}
          data-testid={testId}
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-danger-muted border border-danger-border text-danger-foreground text-xs font-medium shadow-xs ${className}`}
          {...props}
        >
          <AlertOctagon className="w-3.5 h-3.5 text-danger shrink-0" />
          <span className="font-semibold text-danger-foreground">Expired:</span>
          <span className="font-mono font-bold text-xs tracking-tight text-danger">
            {displayTime || '00:00:00'}
          </span>
        </div>
      );
    }

    if (isWarning) {
      return (
        <div
          ref={ref}
          data-testid={testId}
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-warning-muted border border-warning-border text-warning-foreground text-xs font-medium animate-pulse shadow-xs ${className}`}
          {...props}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />
          <span className="font-semibold text-warning-foreground">Time Left:</span>
          <span className="font-mono font-bold text-xs tracking-tight text-warning-foreground">
            {displayTime}
          </span>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        data-testid={testId}
        className={`inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg bg-neutral-900 dark:bg-neutral-800 border border-neutral-800 dark:border-neutral-700 text-white text-xs shadow-xs ${className}`}
        {...props}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
        </span>
        <span className="text-[11px] font-medium text-neutral-400">Time Left</span>
        <div className="flex items-center gap-1.5 font-mono font-semibold text-xs tracking-tight text-white">
          <Clock className="w-3.5 h-3.5 text-neutral-400" />
          <span>{displayTime}</span>
        </div>
      </div>
    );
  }
);
CountdownTimer.displayName = 'CountdownTimer';
