'use client';

import React from 'react';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@hs/ui';
import { Building2, Clock, ShieldCheck, Lock } from 'lucide-react';
import { ResolutionCheck } from './resolution-check';
import { BrowserCheck } from './browser-check';
import { NetworkCheck } from './network-check';
import { DiagnosticsSummary } from './diagnostics-summary';
import { WindowCountdown } from '../window-countdown';
import { useSystemDiagnostics } from '@/hooks/candidate/use-system-diagnostics';
import type { CandidateAssessment } from '../assessment-card';

export interface SystemDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  assessment: CandidateAssessment | null;
  onContinueToConsent: (assessment: CandidateAssessment) => void;
}

export function SystemDiagnosticsModal({
  isOpen,
  onClose,
  assessment,
  onContinueToConsent,
}: SystemDiagnosticsModalProps) {
  const diagnostics = useSystemDiagnostics(isOpen);

  if (!assessment) return null;

  // Window edge case check: if window is not open yet
  const hasFutureWindow =
    assessment.status === 'window_not_open' ||
    Boolean(assessment.windowStartUtc && new Date(assessment.windowStartUtc).getTime() > Date.now());

  const handleProceed = () => {
    if (diagnostics.canProceed && !hasFutureWindow) {
      onContinueToConsent(assessment);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      size="lg"
      className="!p-0 overflow-hidden rounded-2xl border border-neutral-200/90 shadow-2xl max-w-2xl w-full"
      data-testid="system-diagnostics-modal"
    >
      <div className="flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 pb-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-5 h-5 rounded-md bg-primary/10 text-primary flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              Pre-Assessment Check
            </span>
          </div>

          <DialogTitle className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-neutral-100">
            System & Environment Diagnostics
          </DialogTitle>

          <DialogDescription className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Verifying your workstation display, browser compatibility, and network connection before entering the workspace.
          </DialogDescription>

          {/* Assessment Header Metadata Chip */}
          <div className="mt-3 py-2 px-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-700/60 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-medium text-neutral-900 dark:text-neutral-100 truncate">{assessment.title}</span>
              <span className="text-neutral-300 dark:text-neutral-600 select-none">&bull;</span>
              <span className="inline-flex items-center gap-1 text-neutral-500 dark:text-neutral-400 truncate">
                <Building2 className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                {assessment.companyName}
              </span>
            </div>

            <div className="inline-flex items-center gap-1 text-neutral-600 dark:text-neutral-300 font-medium shrink-0">
              <Clock className="w-3.5 h-3.5 text-neutral-400" />
              <span>{assessment.durationMinutes} Minutes</span>
            </div>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 py-4 overflow-y-auto space-y-3 flex-1">
          {/* If outside testing window: display countdown edge case */}
          {hasFutureWindow && assessment.windowStartUtc ? (
            <div className="p-5 rounded-xl border border-amber-200 bg-amber-50/50 space-y-3">
              <div className="flex items-center gap-2 text-amber-900 font-semibold text-sm">
                <Lock className="w-4 h-4 text-amber-600" />
                <span>Testing Window Not Yet Open</span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                This assessment is scheduled for a specific testing window. You cannot start the evaluation until the window officially opens.
              </p>
              <WindowCountdown targetDateUtc={assessment.windowStartUtc} />
            </div>
          ) : (
            /* Main Diagnostic Checks List */
            <div className="space-y-2.5">
              <ResolutionCheck
                result={diagnostics.resolution}
                isRunning={diagnostics.isRunning}
              />

              <BrowserCheck
                result={diagnostics.browser}
                isRunning={diagnostics.isRunning}
              />

              <NetworkCheck
                result={diagnostics.network}
                isRunning={diagnostics.isRunning}
                onRetry={() => void diagnostics.runDiagnostics()}
              />
            </div>
          )}
        </div>

        {/* Sticky Footer: Diagnostics Summary & Actions */}
        {!hasFutureWindow && (
          <div className="p-4 sm:p-5 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
            <DiagnosticsSummary
              state={diagnostics}
              onProceed={handleProceed}
              onRetry={() => void diagnostics.runDiagnostics()}
            />
          </div>
        )}
      </div>
    </Dialog>
  );
}
