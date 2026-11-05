'use client';

import React from 'react';
import { Clock, AlertTriangle, AlertOctagon } from 'lucide-react';

export interface ActiveTimerBarProps {
  formattedTime: string;
  isWarning: boolean;
  isExpired: boolean;
  remainingMs: number;
  className?: string;
}

export function ActiveTimerBar({
  formattedTime,
  isWarning,
  isExpired,
  remainingMs: _remainingMs,
  className = '',
}: ActiveTimerBarProps): React.JSX.Element {
  if (isExpired) {
    return (
      <div
        data-testid="timer-expired-bar"
        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 text-xs font-medium shadow-xs ${className}`}
      >
        <AlertOctagon className="w-3.5 h-3.5 text-red-600 shrink-0" />
        <span className="font-semibold text-red-900 dark:text-red-100">Expired:</span>
        <span className="font-mono font-bold text-xs tracking-tight text-red-700 dark:text-red-300">
          00:00:00
        </span>
      </div>
    );
  }

  if (isWarning) {
    return (
      <div
        data-testid="timer-warning-bar"
        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100 text-xs font-medium animate-pulse shadow-xs ${className}`}
      >
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        <span className="font-semibold text-amber-900 dark:text-amber-200">Time Left:</span>
        <span className="font-mono font-bold text-xs tracking-tight text-amber-700 dark:text-amber-300">
          {formattedTime}
        </span>
      </div>
    );
  }

  return (
    <div
      data-testid="timer-normal-bar"
      className={`inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg bg-neutral-900 dark:bg-neutral-800 border border-neutral-800 dark:border-neutral-700 text-white text-xs shadow-xs ${className}`}
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      <span className="text-[11px] font-medium text-neutral-400">Time Left</span>
      <div className="flex items-center gap-1.5 font-mono font-semibold text-xs tracking-tight text-white">
        <Clock className="w-3.5 h-3.5 text-neutral-400" />
        <span>{formattedTime}</span>
      </div>
    </div>
  );
}

