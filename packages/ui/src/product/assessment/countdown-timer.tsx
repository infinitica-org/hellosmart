'use client';

import React, { useState, useEffect, forwardRef, HTMLAttributes } from 'react';

export interface CountdownTimerProps extends HTMLAttributes<HTMLDivElement> {
  deadlineUtc: string | Date;
  pauseTimerOnDisconnect?: boolean | undefined;
  onExpire?: (() => void) | undefined;
  warningThresholdMinutes?: number | undefined;
}

export const CountdownTimer = forwardRef<HTMLDivElement, CountdownTimerProps>(
  (
    {
      deadlineUtc,
      pauseTimerOnDisconnect = false,
      onExpire,
      warningThresholdMinutes = 15,
      className = '',
      ...props
    },
    ref
  ) => {
    const targetMs = new Date(deadlineUtc).getTime();
    const [mounted, setMounted] = useState(false);
    const [timeLeftMs, setTimeLeftMs] = useState<number>(0);

    useEffect(() => {
      setMounted(true);
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

    const totalSeconds = Math.floor(timeLeftMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (n: number) => n.toString().padStart(2, '0');
    const isWarning = totalSeconds > 0 && totalSeconds <= warningThresholdMinutes * 60;
    const isCritical = totalSeconds > 0 && totalSeconds <= 300; // 5 min
    const isExpired = totalSeconds === 0;

    const colorClasses = isExpired
      ? 'bg-rose-950/80 text-rose-300 border-rose-800'
      : isCritical
      ? 'bg-rose-950/60 text-rose-300 border-rose-800 animate-pulse'
      : isWarning
      ? 'bg-amber-950/60 text-amber-300 border-amber-800'
      : 'bg-slate-900/80 text-slate-100 border-slate-800';

    return (
      <div
        ref={ref}
        className={`inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl border font-mono select-none shadow-sm ${colorClasses} ${className}`}
        {...props}
      >
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>

        <span className="text-sm font-bold tracking-wider">
          {hours > 0 && `${pad(hours)}:`}
          {pad(minutes)}:{pad(seconds)}
        </span>

        {isCritical && !isExpired && (
          <span className="text-[10px] font-sans font-semibold uppercase bg-rose-900/80 text-rose-200 px-1.5 py-0.5 rounded">
            Low
          </span>
        )}

        {isExpired && (
          <span className="text-[10px] font-sans font-semibold uppercase bg-rose-900 text-white px-1.5 py-0.5 rounded">
            Ended
          </span>
        )}
      </div>
    );
  }
);
CountdownTimer.displayName = 'CountdownTimer';

