'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Card,
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className="max-w-3xl max-h-[92vh] overflow-y-auto p-6 sm:p-8 rounded-2xl bg-white border border-neutral-200 shadow-2xl shadow-black/10"
        data-testid="assessment-consent-modal"
      >
        <DialogHeader className="pb-4 border-b border-neutral-100">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Pre-Assessment Agreement
            </span>
          </div>

          <DialogTitle className="text-xl font-bold text-neutral-900">
            Assessment Guidelines & Terms of Evaluation
          </DialogTitle>

          <DialogDescription className="text-xs text-neutral-500 mt-1">
            Please carefully review the environment rules, telemetry recording policies, and timer terms before entering your evaluation session.
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

        {/* Mandatory Legal Notices (BR-12, BR-09, BR-10, BR-14) */}
        <div className="py-5 space-y-3.5 text-xs text-neutral-700">
          {/* Section 1: Session Telemetry & Evidence Recording */}
          <Card className="p-4 border-neutral-200 bg-neutral-50/60 rounded-xl space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-neutral-900">
              <Terminal className="w-4 h-4 text-primary shrink-0" />
              <span>1. Session Activity Recording (BR-12)</span>
            </div>
            <p className="text-neutral-600 leading-relaxed pl-6">
              To verify practical technical capability, this workspace records candidate activity: terminal commands, file diffs, editor changes, git snapshots, and chat interactions. All recorded telemetry serves solely as evaluation evidence for automated reviewer agents and human hiring evaluators.
            </p>
          </Card>

          {/* Section 2: AI Assistance Policy */}
          <Card className="p-4 border-neutral-200 bg-neutral-50/60 rounded-xl space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-neutral-900">
              <Cpu className="w-4 h-4 text-primary shrink-0" />
              <span>2. Governed AI Assistance Policy (BR-14)</span>
            </div>
            <p className="text-neutral-600 leading-relaxed pl-6">
              {aiEnabled
                ? 'Governed AI assistance is enabled for this assessment via the secure HelloSmart AI proxy. Prompts, responses, and token usage are monitored and policy-governed.'
                : 'AI coding assistance is disabled for this assessment. Outbound network egress to external AI domains is restricted by workspace firewall rules.'}
            </p>
          </Card>

          {/* Section 3: Disconnection & Timer Rules */}
          <Card className="p-4 border-neutral-200 bg-neutral-50/60 rounded-xl space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-neutral-900">
              <Timer className="w-4 h-4 text-primary shrink-0" />
              <span>3. Disconnection & Countdown Timer (BR-09, BR-11)</span>
            </div>
            <p className="text-neutral-600 leading-relaxed pl-6">
              The assessment timer <strong>continues running while disconnected</strong> or if you close your browser. Reconnecting does not pause or reset your remaining time. Continuous state persistence (RPO &le; 30s) automatically saves and restores your files and terminal history upon reconnecting.
            </p>
          </Card>

          {/* Section 4: Full-Screen Requirement (Cloud VM) */}
          <Card className="p-4 border-neutral-200 bg-neutral-50/60 rounded-xl space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-neutral-900">
              <Maximize2 className="w-4 h-4 text-primary shrink-0" />
              <span>4. Full-Screen Workspace Integrity (BR-10)</span>
            </div>
            <p className="text-neutral-600 leading-relaxed pl-6">
              Entering a cloud workspace requests full-screen mode. Exiting full-screen or switching windows disconnects the active session and logs an integrity event until you resume.
            </p>
          </Card>
        </div>

        {/* Error Banner */}
        {error && (
          <div
            data-testid="consent-error-banner"
            className="mb-4 p-3.5 rounded-xl border border-red-200 bg-red-50 text-red-800 text-xs flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold">Consent Recording Failed:</span> {error}
            </div>
          </div>
        )}

        {/* Mandatory Agreement Checkbox */}
        <div className="pt-2 pb-4 border-t border-neutral-100 space-y-4">
          <div className="flex items-start gap-3 bg-neutral-50/80 p-3.5 rounded-xl border border-neutral-200/80">
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
              className="text-xs sm:text-sm font-medium text-neutral-900 leading-snug cursor-pointer select-none"
            >
              I agree to the assessment guidelines and terms of evaluation
            </label>
          </div>

          {/* Actions & Policy Version Attribution */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="text-[11px] text-neutral-400 font-mono">
              Legal Text Policy {CURRENT_CONSENT_TEXT_VERSION}
            </div>

            <div className="flex items-center gap-2.5 self-end sm:self-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClose}
                disabled={isSubmitting}
                className="text-xs border-neutral-200"
              >
                Cancel
              </Button>

              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleSubmit}
                disabled={!hasAgreed || isSubmitting}
                data-testid="start-assessment-consent-button"
                className="h-10 px-5 text-xs sm:text-sm font-medium bg-primary hover:bg-primary-hover text-white shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Recording Consent...</span>
                  </>
                ) : (
                  <>
                    <span>Start Assessment</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

