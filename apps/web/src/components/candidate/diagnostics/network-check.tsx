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
                ? 'bg-success-muted text-success'
                : isWarning
                  ? 'bg-warning-muted text-warning'
                  : 'bg-danger-muted text-danger'
            }`}
          >
            <Wifi className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Network &amp; Internet Speed</h4>
            <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 flex-wrap mt-0.5">
              <span>
                Speed: <strong className="font-semibold text-neutral-800 dark:text-neutral-200">{result.downloadSpeedMbps !== null ? `${result.downloadSpeedMbps} Mbps` : 'Testing...'}</strong>
              </span>
              <span>&bull;</span>
              <span>
                Ping: <strong className="font-semibold text-neutral-800 dark:text-neutral-200">{result.latencyMs !== null ? `${result.latencyMs} ms` : 'Testing...'}</strong>
              </span>
              <span>&bull;</span>
              <span>
                Stability: <strong className={`font-semibold ${isPass ? 'text-success' : isWarning ? 'text-warning' : 'text-danger'}`}>{result.stability || 'Testing...'}</strong>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isRunning ? (
            <Badge variant="default" dot className="text-xs">
              <Loader2 className="w-3 h-3 animate-spin mr-1" />
              Testing Speed
            </Badge>
          ) : isPass ? (
            <Badge variant="success" size="sm" className="gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Stable
            </Badge>
          ) : isWarning ? (
            <Badge variant="warning" size="sm" className="gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Moderate
            </Badge>
          ) : (
            <Badge variant="danger" size="sm" className="gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              Unstable
            </Badge>
          )}

          {isError && onRetry && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRetry}
              disabled={isRunning}
              className="text-xs h-7 px-2 border-danger-border text-danger-foreground hover:bg-danger-muted"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Retry Test
            </Button>
          )}
        </div>
      </div>

      {!isRunning && result.message && (
        <p className={`mt-2 text-xs leading-relaxed ${isPass ? 'text-neutral-500' : isWarning ? 'text-warning-foreground' : 'text-danger-foreground'}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}
