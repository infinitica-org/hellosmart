'use client';

import React from 'react';
import { Button } from '@hs/ui';
import { CheckCircle2, AlertTriangle, AlertCircle, ArrowRight, RotateCcw, ShieldCheck } from 'lucide-react';
import type { SystemDiagnosticsState } from '@/hooks/candidate/use-system-diagnostics';

export interface DiagnosticsSummaryProps {
  state: SystemDiagnosticsState;
  onProceed: () => void;
  onRetry: () => void;
  isLoading?: boolean;
}

export function DiagnosticsSummary({ state, onProceed, onRetry, isLoading = false }: DiagnosticsSummaryProps) {
  const { overallStatus, canProceed, isRunning } = state;

  const isReady = overallStatus === 'ready';
  const isWarning = overallStatus === 'warning';
  const isError = overallStatus === 'error';

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            isReady
              ? 'bg-emerald-100 text-emerald-700'
              : isWarning
                ? 'bg-amber-100 text-amber-700'
                : isError
                  ? 'bg-red-100 text-red-700'
                  : 'bg-neutral-200 text-neutral-600'
          }`}
        >
          {isReady ? (
            <ShieldCheck className="w-4 h-4" />
          ) : isWarning ? (
            <AlertTriangle className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
        </div>

        <div className="min-w-0">
          <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 block truncate">
            {isRunning
              ? 'Verifying system readiness...'
              : isReady
                ? 'System Readiness: Passed'
                : isWarning
                  ? 'System Readiness: Passed with Advisories'
                  : 'System Readiness: Action Required'}
          </span>
          <span className="text-[11px] text-neutral-500 dark:text-neutral-400 block truncate">
            {isRunning
              ? 'Checking workstation and connectivity'
              : isReady
                ? 'All diagnostic checks completed successfully.'
                : isWarning
                  ? 'Advisories noted. You may proceed.'
                  : 'Network connection failed. Please retry.'}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
        {isError && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRetry}
            disabled={isRunning || isLoading}
            className="text-xs border-red-300 text-red-700 hover:bg-red-50 h-9 px-3"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Retry
          </Button>
        )}

        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={onProceed}
          disabled={!canProceed || isRunning || isLoading}
          data-testid="continue-to-consent-button"
          className="h-9 px-4 text-xs font-semibold bg-primary hover:bg-primary-hover text-white shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
        >
          <span>Continue to Agreement</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
