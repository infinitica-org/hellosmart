'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-3xl max-h-[92vh] overflow-y-auto p-6 sm:p-8 rounded-2xl bg-white border border-neutral-200 shadow-2xl shadow-black/10"
        data-testid="system-diagnostics-modal"
      >
        <DialogHeader className="pb-4 border-b border-neutral-100">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Pre-Assessment Check
            </span>
          </div>

          <DialogTitle className="text-xl font-bold text-neutral-900">
            System & Environment Diagnostics
          </DialogTitle>

          <DialogDescription className="text-xs text-neutral-500 mt-1">
            Verifying your workstation display, browser compatibility, and network connection before entering the assessment workspace.
          </DialogDescription>

          {/* Assessment Header Metadata */}
          <div className="mt-3.5 p-3 rounded-xl bg-neutral-50 border border-neutral-200/70 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-neutral-900">{assessment.title}</span>
              <span className="text-neutral-400">&bull;</span>
              <span className="inline-flex items-center gap-1 text-neutral-600">
                <Building2 className="w-3.5 h-3.5 text-neutral-400" />
                {assessment.companyName}
              </span>
            </div>

            <div className="inline-flex items-center gap-1.5 text-neutral-600 font-medium">
              <Clock className="w-3.5 h-3.5 text-neutral-400" />
              <span>{assessment.durationMinutes} Minutes</span>
            </div>
          </div>
        </DialogHeader>

        {/* If outside testing window: display countdown edge case */}
        {hasFutureWindow && assessment.windowStartUtc ? (
          <div className="my-5 p-6 rounded-2xl border border-amber-200 bg-amber-50/50 space-y-4">
            <div className="flex items-center gap-2.5 text-amber-900 font-semibold text-sm">
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
          <div className="py-5 space-y-4">
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

        {/* Diagnostics Summary & Navigation to Consent */}
        {!hasFutureWindow && (
          <div className="pt-2">
            <DiagnosticsSummary
              state={diagnostics}
              onProceed={handleProceed}
              onRetry={() => void diagnostics.runDiagnostics()}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

