'use client';

import React from 'react';
import { Badge } from '@hs/ui';
import { Globe, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import type { BrowserCheckResult } from '@/hooks/candidate/use-system-diagnostics';

export interface BrowserCheckProps {
  result: BrowserCheckResult;
  isRunning?: boolean;
}

export function BrowserCheck({ result, isRunning = false }: BrowserCheckProps) {
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
            <Globe className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Browser Compatibility</h4>
            <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 flex-wrap mt-0.5">
              <span>
                Detected: <strong className="font-semibold text-neutral-800 dark:text-neutral-200">{result.browserName} {result.browserVersion ? `(${result.browserVersion.split('.')[0]})` : ''}</strong>
              </span>
              <span>&bull;</span>
              <span>WebSockets & Fullscreen supported</span>
            </div>
          </div>
        </div>

        {isRunning ? (
          <Badge variant="default" dot className="shrink-0 text-xs">
            <Loader2 className="w-3 h-3 animate-spin mr-1" />
            Detecting
          </Badge>
        ) : isPass ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Supported
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80 shrink-0">
            <AlertTriangle className="w-3.5 h-3.5" />
            Warning
          </span>
        )}
      </div>

      {!isRunning && result.message && (
        <p className={`mt-2 text-xs leading-relaxed ${isPass ? 'text-neutral-500' : 'text-amber-700'}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}
