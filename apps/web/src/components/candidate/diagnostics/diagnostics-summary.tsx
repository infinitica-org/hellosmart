'use client';

import React from 'react';
import { Card, Button } from '@hs/ui';
import { CheckCircle2, AlertTriangle, AlertCircle, ArrowRight, RotateCcw, ShieldCheck } from 'lucide-react';
import type { SystemDiagnosticsState } from '@/hooks/candidate/use-system-diagnostics';

export interface DiagnosticsSummaryProps {
  state: SystemDiagnosticsState;
  onProceed: () => void;
  onRetry: () => void;
  isLoading?: boolean;
}

export function DiagnosticsSummary({ state, onProceed, onRetry, isLoading = false }: DiagnosticsSummaryProps) {
  const { overallStatus, canProceed, isRunning, resolution, browser, network } = state;

  const isReady = overallStatus === 'ready';
  const isWarning = overallStatus === 'warning';
  const isError = overallStatus === 'error';

  return (
    <Card
      className={`p-5 sm:p-6 border transition-all ${
        isReady
          ? 'border-emerald-200 bg-emerald-50/40'
          : isWarning
            ? 'border-amber-200 bg-amber-50/40'
            : isError
              ? 'border-red-200 bg-red-50/40'
              : 'border-neutral-200 bg-neutral-50/40'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
              isReady
                ? 'bg-emerald-100 text-emerald-700 shadow-2xs shadow-emerald-500/10'
                : isWarning
                  ? 'bg-amber-100 text-amber-700 shadow-2xs shadow-amber-500/10'
                  : isError
                    ? 'bg-red-100 text-red-700 shadow-2xs shadow-red-500/10'
                    : 'bg-neutral-200 text-neutral-600'
            }`}
          >
            {isReady ? (
              <ShieldCheck className="w-6 h-6" />
            ) : isWarning ? (
              <AlertTriangle className="w-6 h-6" />
            ) : (
              <AlertCircle className="w-6 h-6" />
            )}
          </div>

          <div>
            <h3 className="text-base font-semibold text-neutral-900">
              {isRunning
                ? 'Running System Readiness Checks...'
                : isReady
                  ? 'System Readiness: Passed'
                  : isWarning
                    ? 'System Readiness: Passed with Advisories'
                    : 'System Readiness: Action Required'}
            </h3>
            <p className="text-xs text-neutral-600 mt-0.5">
              {isRunning
                ? 'Analyzing display, browser environment, and network connectivity.'
                : isReady
                  ? 'All pre-test system diagnostics completed successfully. You are ready to continue.'
                  : isWarning
                    ? 'Minor environment warnings detected. You may proceed, but optimal setup is recommended.'
                    : 'Network connection failed. Please resolve network issues before proceeding.'}
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
          {isError && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRetry}
              disabled={isRunning || isLoading}
              className="text-xs border-red-300 text-red-700 hover:bg-red-50 h-10 px-4"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Retry Checks
            </Button>
          )}

          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={onProceed}
            disabled={!canProceed || isRunning || isLoading}
            data-testid="continue-to-consent-button"
            className="h-10 px-5 text-xs sm:text-sm font-medium bg-primary hover:bg-primary-hover text-white shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
          >
            <span>Continue to Assessment Consent</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Mini status bar breakdown */}
      <div className="mt-4 pt-3.5 border-t border-black/5 flex items-center justify-between gap-2 text-xs flex-wrap">
        <span className="text-neutral-500 text-[11px]">Diagnostics Breakdown:</span>
        <div className="flex items-center gap-3 text-[11px] font-medium">
          <span className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                resolution.status === 'pass' ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            Resolution ({resolution.status.toUpperCase()})
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                browser.status === 'pass' ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            Browser ({browser.status.toUpperCase()})
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                network.status === 'pass'
                  ? 'bg-emerald-500'
                  : network.status === 'warning'
                    ? 'bg-amber-500'
                    : 'bg-red-500'
              }`}
            />
            Latency ({network.status.toUpperCase()})
          </span>
        </div>
      </div>
    </Card>
  );
}

