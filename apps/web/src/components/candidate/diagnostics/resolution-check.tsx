'use client';

import React from 'react';
import { Badge } from '@hs/ui';
import { Monitor, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import type { ResolutionCheckResult } from '@/hooks/candidate/use-system-diagnostics';

export interface ResolutionCheckProps {
  result: ResolutionCheckResult;
  isRunning?: boolean;
}

export function ResolutionCheck({ result, isRunning = false }: ResolutionCheckProps) {
  const isPass = result.status === 'pass';

  return (
    <div className="p-3.5 sm:p-4 rounded-xl border border-neutral-200/80 bg-white dark:bg-neutral-900 transition-colors">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              isPass
                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
            }`}
          >
            <Monitor className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Screen Resolution</h4>
            <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 flex-wrap mt-0.5">
              <span>
                Detected: <strong className="font-semibold text-neutral-800 dark:text-neutral-200">{result.screenWidth > 0 ? `${result.screenWidth} × ${result.screenHeight}` : 'Measuring...'}</strong>
              </span>
              <span>&bull;</span>
              <span>Min. required: {result.minWidth} × {result.minHeight}</span>
            </div>
          </div>
        </div>

        {isRunning ? (
          <Badge variant="default" dot className="shrink-0 text-xs">
            <Loader2 className="w-3 h-3 animate-spin mr-1" />
            Checking
          </Badge>
        ) : isPass ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-success-muted text-success-foreground border border-success-border shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Pass
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-warning-muted text-warning-foreground border border-warning-border shrink-0">
            <AlertTriangle className="w-3.5 h-3.5" />
            Warning
          </span>
        )}
      </div>

      {!isRunning && result.message && (
        <p className={`mt-2 text-xs leading-relaxed ${isPass ? 'text-neutral-500' : 'text-warning-foreground'}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}
