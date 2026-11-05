'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageHeader, Checkbox, Button } from '@hs/ui';
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
import {
  useRecordConsentMutation,
  useGetCandidateAssignmentsQuery,
} from '@/store/candidate/candidateApi';
import { ROUTES } from '@/constants/routes';

export default function CandidateConsentPage() {
  const params = useParams();
  const router = useRouter();
  const assessmentId = params?.id as string;

  const [hasAgreed, setHasAgreed] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const error = submitError;
  const resetError = () => setSubmitError(null);
  const { data: assessments, isLoading: isAssessmentsLoading } = useGetCandidateAssignmentsQuery();
  const [recordConsentMutation, { isLoading: isSubmitting }] = useRecordConsentMutation();

  const assessment = assessments?.find((a) => a.id === assessmentId) ?? (assessments?.[0]) ?? (assessmentId ? {
    id: assessmentId,
    title: 'Assessment',
    companyName: '',
    durationMinutes: 90,
    status: 'ready' as const,
  } : null);

  const handleSubmit = async () => {
    if (!hasAgreed || isSubmitting || !assessment) return;

    try {
      setSubmitError(null);
      const result = await recordConsentMutation({
        id: assessment.id,
        textVersion: CURRENT_CONSENT_TEXT_VERSION,
      }).unwrap();

      if (result && result.success) {
        const targetId = assessment.workspaceId || assessment.id;
        router.push(ROUTES.CANDIDATE.WORKSPACE(targetId));
      }
    } catch (err: any) {
      setSubmitError(err?.data?.detail || err?.message || 'Unable to record legal consent. Please retry.');
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
    <div className="space-y-6 max-w-3xl mx-auto py-2">
      <PageHeader
        title="Assessment Guidelines & Legal Agreement"
        description="Please review the evaluation environment rules, telemetry recording disclosure, and timing conditions before entering your evaluation session."
        badge={{ text: 'Pre-Assessment Agreement', variant: 'info' }}
        data-testid="consent-page-header"
      />

      {isAssessmentsLoading && !assessment ? (
        <div className="p-8 text-center text-xs text-neutral-400 rounded-xl bg-white border border-neutral-200">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
          Loading assessment information...
        </div>
      ) : assessment ? (
        /* Single, cohesive, aesthetic container */
        <div className="rounded-2xl border border-neutral-200/90 bg-white dark:bg-neutral-900 p-6 sm:p-8 shadow-xs space-y-6">
          {/* Assessment Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-neutral-100 dark:border-neutral-800">
            <div className="space-y-1 min-w-0">
            
              <h2 className="text-lg sm:text-xl font-normal text-neutral-900 dark:text-neutral-100 tracking-tight truncate">
                {assessment.title}
              </h2>
              <div className="flex items-center gap-3 text-xs text-neutral-500 flex-wrap">
                {assessment.companyName ? (
                  <>
                    <span className="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300 font-medium">
                      <Building2 className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      {assessment.companyName}
                    </span>
                    <span className="text-neutral-300 select-none">&bull;</span>
                  </>
                ) : null}
                <span className="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300 font-medium">
                  <Clock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  {assessment.durationMinutes} Minutes Duration
                </span>
              </div>
            </div>

          </div>

          {/* Unified Guidelines & Rules List (Divide-y clean list instead of separate bulky cards) */}
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800 text-xs text-neutral-700 dark:text-neutral-300">
            {/* Section 1: Session Activity Recording */}
            <div className="py-4 first:pt-0 space-y-1">
              <div className="flex items-center gap-2 font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
                <Terminal className="w-4 h-4 text-primary shrink-0" />
                <span>1. Session Activity Recording </span>
              </div>
              <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed pl-6 text-xs">
                To verify practical technical capability, this workspace records candidate activity: terminal commands, file diffs, editor changes, git snapshots, and chat interactions. All recorded telemetry serves solely as evaluation evidence for automated reviewer agents and human hiring evaluators.
              </p>
            </div>

            {/* Section 2: AI Assistance Policy */}
            <div className="py-4 space-y-1">
              <div className="flex items-center gap-2 font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
                <Cpu className="w-4 h-4 text-primary shrink-0" />
                <span>2. Governed AI Assistance Policy</span>
              </div>
              <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed pl-6 text-xs">
                Governed AI assistance is enabled for this assessment via the secure HelloSmart AI proxy. Prompts, responses, and token usage are monitored and policy-governed. Direct external network access to unauthorized AI providers is blocked.
              </p>
            </div>

            {/* Section 3: Disconnection & Timer Rules */}
            <div className="py-4 space-y-1">
              <div className="flex items-center gap-2 font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
                <Timer className="w-4 h-4 text-primary shrink-0" />
                <span>3. Disconnection & Countdown Timer </span>
              </div>
              <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed pl-6 text-xs">
                The assessment timer <strong>continues running while disconnected</strong> or if you close your browser. Reconnecting does not pause or reset your remaining time. Continuous state persistence (RPO &le; 30s) automatically saves and restores your files and terminal history upon reconnecting.
              </p>
            </div>

            {/* Section 4: Full-Screen Requirement */}
            <div className="py-4 last:pb-0 space-y-1">
              <div className="flex items-center gap-2 font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
                <Maximize2 className="w-4 h-4 text-primary shrink-0" />
                <span>4. Full-Screen Workspace Integrity</span>
              </div>
              <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed pl-6 text-xs">
                Entering a cloud workspace requests full-screen mode. Exiting full-screen or switching windows disconnects the active session and logs an integrity event until you resume.
              </p>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div
              data-testid="consent-page-error-banner"
              className="p-3.5 rounded-xl border border-red-200 bg-red-50 text-red-800 text-xs flex items-center gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <div className="flex-1">
                <span className="font-semibold">Consent Submission Failed:</span> {error}
              </div>
            </div>
          )}

          {/* Agreement Checkbox & Action Row (Seamless bottom integration) */}
          <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800 space-y-4">
            <div className="flex items-start gap-3 p-3.5 ">
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
                className="text-xs sm:text-sm font-medium text-neutral-900 dark:text-neutral-100 leading-snug cursor-pointer select-none"
              >
                I agree to the assessment guidelines and terms of evaluation
              </label>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <span className="text-[11px] text-neutral-400 ">
                Policy Version: {CURRENT_CONSENT_TEXT_VERSION}
              </span>

              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  className="!rounded-lg px-4 py-2"
                  onClick={handleBackToDiagnostics}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  className="!rounded-lg px-5 py-2 text-normal"
                  onClick={handleSubmit}
                  disabled={!hasAgreed || isSubmitting}
                  isLoading={isSubmitting}
                  data-testid="start-assessment-consent-button"
                  rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                >
                  Start Assessment
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-xs text-neutral-500 rounded-xl bg-white border border-neutral-200">
          Assessment not found. Please return to your candidate dashboard.
        </div>
      )}
    </div>
  );
}
