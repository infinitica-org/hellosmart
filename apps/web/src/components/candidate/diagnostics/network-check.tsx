'use client';

import React from 'react';
import { Badge, Button } from '@hs/ui';
import { Wifi, CheckCircle2, AlertTriangle, AlertCircle, Loader2, RotateCcw } from 'lucide-react';
import type { NetworkCheckResult } from '@/hooks/candidate/use-system-diagnostics';

export interface NetworkCheckProps {
  result: NetworkCheckResult;
  isRunning?: boolean;
  onRetry?: () => void;
}

export function NetworkCheck({ result, isRunning = false, onRetry }: NetworkCheckProps) {
  const isPass = result.status === 'pass';
  const isError = result.status === 'error';
  const isWarning = result.status === 'warning';

  return (
    <div className="p-3.5 sm:p-4 rounded-xl border border-neutral-200/80 bg-white dark:bg-neutral-900 transition-colors">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              isPass
                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                : isWarning
                  ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                  : 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400'
            }`}
          >
            <Wifi className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Network Latency</h4>
            <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 flex-wrap mt-0.5">
              <span>
                Endpoint: <span className="text-neutral-700 dark:text-neutral-300 font-medium">{result.endpoint}</span>
              </span>
              <span>&bull;</span>
              <span>
                Latency: <strong className="font-semibold text-neutral-800 dark:text-neutral-200">{result.latencyMs !== null ? `${result.latencyMs} ms` : 'Testing...'}</strong>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isRunning ? (
            <Badge variant="default" dot className="text-xs">
              <Loader2 className="w-3 h-3 animate-spin mr-1" />
              Testing
            </Badge>
          ) : isPass ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Optimal
            </span>
          ) : isWarning ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80">
              <AlertTriangle className="w-3.5 h-3.5" />
              High Latency
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200/80">
              <AlertCircle className="w-3.5 h-3.5" />
              Failed
            </span>
          )}

          {isError && onRetry && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRetry}
              disabled={isRunning}
              className="text-xs h-7 px-2 border-red-200 text-red-700 hover:bg-red-50"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Retry
            </Button>
          )}
        </div>
      </div>

      {!isRunning && result.message && (
        <p className={`mt-2 text-xs leading-relaxed ${isPass ? 'text-neutral-500' : isWarning ? 'text-amber-700' : 'text-red-700'}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}
