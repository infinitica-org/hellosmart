'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageHeader, Card, Checkbox, Button } from '@hs/ui';
import {
  ArrowLeft,
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
import { useCandidateAssessments } from '@/hooks/candidate/use-candidate-assessments';
import { useCandidateConsent } from '@/hooks/candidate/use-candidate-consent';
import { ROUTES } from '@/constants/routes';

export default function CandidateConsentPage() {
  const params = useParams();
  const router = useRouter();
  const assessmentId = params?.id as string;

  const [hasAgreed, setHasAgreed] = useState(false);
  const { data: assessments, isLoading: isAssessmentsLoading } = useCandidateAssessments();
  const { isSubmitting, error, submitConsent, resetError } = useCandidateConsent();

  const assessment = assessments?.find((a) => a.id === assessmentId) ?? (assessmentId ? {
    id: assessmentId,
    title: 'Candidate Technical Assessment',
    companyName: 'Evaluating Organization',
    durationMinutes: 90,
    status: 'ready' as const,
  } : null);

  const handleSubmit = async () => {
    if (!hasAgreed || isSubmitting || !assessment) return;

    const result = await submitConsent(assessment.id);
    if (result && result.success) {
      const targetId = assessment.workspaceId || assessment.id;
      router.push(ROUTES.CANDIDATE.WORKSPACE(targetId));
    }
  };

  const handleBackToDiagnostics = () => {
    if (assessmentId) {
      router.push(ROUTES.CANDIDATE.DIAGNOSTICS(assessmentId));
    } else {
      router.push(ROUTES.CANDIDATE.DASHBOARD);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto py-4">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleBackToDiagnostics}
          disabled={isSubmitting}
          className="text-xs border-neutral-200"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          Back to Diagnostics
        </Button>
      </div>

      <PageHeader
        title="Assessment Guidelines & Legal Agreement"
        description="Review the evaluation parameters, telemetry recording disclosure, and timing conditions before entering your evaluation workspace."
        badge={{ text: 'Consent Agreement #119', variant: 'info' }}
        data-testid="consent-page-header"
      />

      {isAssessmentsLoading && !assessment ? (
        <Card className="p-8 text-center text-xs text-neutral-400">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
          Loading assessment information...
        </Card>
      ) : assessment ? (
        <div className="space-y-5">
          {/* Assessment Header Metadata */}
          <Card className="p-4 sm:p-5 border-neutral-200 bg-white flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                Assigned Assessment
              </span>
              <h2 className="text-base font-semibold text-neutral-900">{assessment.title}</h2>
              <div className="flex items-center gap-3 text-xs text-neutral-500">
                <span className="flex items-center gap-1 text-neutral-700">
                  <Building2 className="w-3.5 h-3.5 text-neutral-400" />
                  {assessment.companyName}
                </span>
                <span>&bull;</span>
                <span className="flex items-center gap-1 text-neutral-700">
                  <Clock className="w-3.5 h-3.5 text-neutral-400" />
                  {assessment.durationMinutes} Minutes
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </span>
              <span className="text-xs font-medium text-neutral-800">BR-12 Binding</span>
            </div>
          </Card>

          {/* Mandatory Legal Notices */}
          <div className="space-y-3.5 text-xs text-neutral-700">
            <Card className="p-4 border-neutral-200 bg-white rounded-xl space-y-1.5 shadow-2xs">
              <div className="flex items-center gap-2 font-semibold text-neutral-900">
                <Terminal className="w-4 h-4 text-primary shrink-0" />
                <span>1. Session Activity Recording (BR-12)</span>
              </div>
              <p className="text-neutral-600 leading-relaxed pl-6">
                All candidate actions inside the workspace—including terminal commands, git commits, file changes, and chat interactions—are logged as evaluation evidence for independent AI rubric agents and hiring evaluators.
              </p>
            </Card>

            <Card className="p-4 border-neutral-200 bg-white rounded-xl space-y-1.5 shadow-2xs">
              <div className="flex items-center gap-2 font-semibold text-neutral-900">
                <Cpu className="w-4 h-4 text-primary shrink-0" />
                <span>2. Governed AI Assistance Policy (BR-14)</span>
              </div>
              <p className="text-neutral-600 leading-relaxed pl-6">
                AI coding assistance is governed by platform policy via the secure HelloSmart AI proxy. Direct external network access to unauthorized AI providers is blocked.
              </p>
            </Card>

            <Card className="p-4 border-neutral-200 bg-white rounded-xl space-y-1.5 shadow-2xs">
              <div className="flex items-center gap-2 font-semibold text-neutral-900">
                <Timer className="w-4 h-4 text-primary shrink-0" />
                <span>3. Disconnection & Countdown Timer (BR-09, BR-11)</span>
              </div>
              <p className="text-neutral-600 leading-relaxed pl-6">
                The assessment timer <strong>continues running while disconnected</strong> or if you close your browser. Reconnecting does not pause or reset the timer. Autosave continuously persists your code so no work is lost on reconnect.
              </p>
            </Card>

            <Card className="p-4 border-neutral-200 bg-white rounded-xl space-y-1.5 shadow-2xs">
              <div className="flex items-center gap-2 font-semibold text-neutral-900">
                <Maximize2 className="w-4 h-4 text-primary shrink-0" />
                <span>4. Full-Screen Workspace Integrity (BR-10)</span>
              </div>
              <p className="text-neutral-600 leading-relaxed pl-6">
                Entering the workspace requests full-screen mode. Exiting full screen disconnects the session until resumed and records an activity event.
              </p>
            </Card>
          </div>

          {/* Error Banner */}
          {error && (
            <div
              data-testid="consent-page-error-banner"
              className="p-3.5 rounded-xl border border-red-200 bg-red-50 text-red-800 text-xs flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold">Consent Submission Failed:</span> {error}
              </div>
            </div>
          )}

          {/* Mandatory Checkbox & Actions Card */}
          <Card className="p-5 border-neutral-200 bg-white rounded-xl space-y-4 shadow-xs">
            <div className="flex items-start gap-3 bg-neutral-50 p-3.5 rounded-xl border border-neutral-200/80">
              <Checkbox
                id="page-assessment-agreement-checkbox"
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
                htmlFor="page-assessment-agreement-checkbox"
                className="text-xs sm:text-sm font-medium text-neutral-900 leading-snug cursor-pointer select-none"
              >
                I agree to the assessment guidelines and terms of evaluation
              </label>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-neutral-100">
              <span className="text-[11px] text-neutral-400 font-mono">
                Policy Version: {CURRENT_CONSENT_TEXT_VERSION}
              </span>

              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleSubmit}
                disabled={!hasAgreed || isSubmitting}
                data-testid="start-assessment-consent-button"
                className="h-10 px-6 text-xs sm:text-sm font-medium bg-primary hover:bg-primary-hover text-white shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none self-end sm:self-auto"
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
          </Card>
        </div>
      ) : (
        <Card className="p-8 text-center text-xs text-neutral-500">
          Assessment not found. Please return to your candidate dashboard.
        </Card>
      )}
    </div>
  );
}

