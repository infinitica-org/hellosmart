'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogDescription,
  Checkbox,
  Button,
} from '@hs/ui';
import {
  ShieldCheck,
  Building2,
  Clock,
  Terminal,
  Cpu,
  Timer,
  Maximize2,
  AlertCircle,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import {
  CURRENT_CONSENT_TEXT_VERSION,
  type AssessmentConsentResponse,
} from '@hs/contracts';
import { useCandidateConsent } from '@/hooks/candidate/use-candidate-consent';
import type { CandidateAssessment } from './assessment-card';

export interface AssessmentConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  assessment: CandidateAssessment | null;
  onConsentSuccess: (
    assessment: CandidateAssessment,
    consentRecord: AssessmentConsentResponse
  ) => void;
  /** Whether governed AI coding assistance is enabled for this assessment (defaults to true) */
  aiEnabled?: boolean;
}

export function AssessmentConsentModal({
  isOpen,
  onClose,
  assessment,
  onConsentSuccess,
  aiEnabled = true,
}: AssessmentConsentModalProps) {
  const [hasAgreed, setHasAgreed] = useState(false);
  const { isSubmitting, error, submitConsent, resetError } = useCandidateConsent();

  if (!assessment) return null;

  const handleSubmit = async () => {
    if (!hasAgreed || isSubmitting) return;

    const result = await submitConsent(assessment.id);
    if (result && result.success) {
      onConsentSuccess(assessment, result);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setHasAgreed(false);
    resetError();
    onClose();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => !open && handleClose()}
      size="lg"
      className="!p-0 overflow-hidden rounded-2xl border border-neutral-200/90 shadow-2xl max-w-2xl w-full"
      data-testid="assessment-consent-modal"
    >
      <div className="flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 pb-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-5 h-5 rounded-md bg-primary/10 text-primary flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              Pre-Assessment Agreement
            </span>
          </div>

          <DialogTitle className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-neutral-100">
            Assessment Guidelines & Terms of Evaluation
          </DialogTitle>

          <DialogDescription className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Please carefully review the environment rules, telemetry recording policies, and timer terms before entering your evaluation session.
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

        {/* Scrollable Legal Terms Reader Container */}
        <div className="p-5 sm:p-6 py-4 overflow-y-auto space-y-3 flex-1 text-xs text-neutral-700 dark:text-neutral-300">
          {/* Section 1: Session Telemetry & Evidence Recording */}
          <div className="p-3.5 rounded-xl border border-neutral-200/80 bg-neutral-50/50 dark:bg-neutral-800/40 space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-neutral-900 dark:text-neutral-100 text-xs">
              <Terminal className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>1. Session Activity Recording (BR-12)</span>
            </div>
            <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed pl-5 text-[11px]">
              To verify practical technical capability, this workspace records candidate activity: terminal commands, file diffs, editor changes, git snapshots, and chat interactions. All recorded telemetry serves solely as evaluation evidence for automated reviewer agents and human hiring evaluators.
            </p>
          </div>

          {/* Section 2: AI Assistance Policy */}
          <div className="p-3.5 rounded-xl border border-neutral-200/80 bg-neutral-50/50 dark:bg-neutral-800/40 space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-neutral-900 dark:text-neutral-100 text-xs">
              <Cpu className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>2. Governed AI Assistance Policy (BR-14)</span>
            </div>
            <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed pl-5 text-[11px]">
              {aiEnabled
                ? 'Governed AI assistance is enabled for this assessment via the secure HelloSmart AI proxy. Prompts, responses, and token usage are monitored and policy-governed.'
                : 'AI coding assistance is disabled for this assessment. Outbound network egress to external AI domains is restricted by workspace firewall rules.'}
            </p>
          </div>

          {/* Section 3: Disconnection & Timer Rules */}
          <div className="p-3.5 rounded-xl border border-neutral-200/80 bg-neutral-50/50 dark:bg-neutral-800/40 space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-neutral-900 dark:text-neutral-100 text-xs">
              <Timer className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>3. Disconnection & Countdown Timer (BR-09, BR-11)</span>
            </div>
            <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed pl-5 text-[11px]">
              The assessment timer <strong>continues running while disconnected</strong> or if you close your browser. Reconnecting does not pause or reset your remaining time. Continuous state persistence (RPO &le; 30s) automatically saves and restores your files and terminal history upon reconnecting.
            </p>
          </div>

          {/* Section 4: Full-Screen Requirement (Cloud VM) */}
          <div className="p-3.5 rounded-xl border border-neutral-200/80 bg-neutral-50/50 dark:bg-neutral-800/40 space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-neutral-900 dark:text-neutral-100 text-xs">
              <Maximize2 className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>4. Full-Screen Workspace Integrity (BR-10)</span>
            </div>
            <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed pl-5 text-[11px]">
              Entering a cloud workspace requests full-screen mode. Exiting full-screen or switching windows disconnects the active session and logs an integrity event until you resume.
            </p>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div
            data-testid="consent-error-banner"
            className="mx-5 mb-2 p-3 rounded-lg border border-red-200 bg-red-50 text-red-800 text-xs flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <div className="flex-1 truncate">
              <span className="font-semibold">Consent Recording Failed:</span> {error}
            </div>
          </div>
        )}

        {/* Sticky Footer: Checkbox & Actions */}
        <div className="p-4 sm:p-5 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 space-y-3">
          <div className="flex items-center gap-3 bg-white dark:bg-neutral-800 p-3 rounded-xl border border-neutral-200/80 dark:border-neutral-700">
            <Checkbox
              id="assessment-agreement-checkbox"
              checked={hasAgreed}
              onChange={(e) => {
                setHasAgreed(e.target.checked);
                if (error) resetError();
              }}
              disabled={isSubmitting}
              data-testid="consent-agreement-checkbox"
              className="mt-0.5"
            />
            <label
              htmlFor="assessment-agreement-checkbox"
              className="text-xs sm:text-sm font-medium text-neutral-900 dark:text-neutral-100 leading-snug cursor-pointer select-none"
            >
              I agree to the assessment guidelines and terms of evaluation
            </label>
          </div>

          {/* Actions & Policy Version */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="text-[11px] text-neutral-400 font-mono">
              Policy {CURRENT_CONSENT_TEXT_VERSION}
            </span>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClose}
                disabled={isSubmitting}
                className="text-xs border-neutral-200 h-9 px-3"
              >
                Cancel
              </Button>

              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleSubmit}
                disabled={!hasAgreed || isSubmitting}
                data-testid="start-assessment-consent-button"
                className="h-9 px-4 text-xs font-semibold bg-primary hover:bg-primary-hover text-white shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Recording...</span>
                  </>
                ) : (
                  <>
                    <span>Start Assessment</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
