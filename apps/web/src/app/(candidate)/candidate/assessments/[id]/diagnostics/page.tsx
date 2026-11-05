'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageHeader, Button } from '@hs/ui';
import { ArrowLeft, Building2, Clock, ShieldCheck, Lock, Loader2, ArrowRight } from 'lucide-react';
import { ResolutionCheck } from '@/components/candidate/diagnostics/resolution-check';
import { BrowserCheck } from '@/components/candidate/diagnostics/browser-check';
import { NetworkCheck } from '@/components/candidate/diagnostics/network-check';
import { WindowCountdown } from '@/components/candidate/window-countdown';
import { useSystemDiagnostics } from '@/hooks/candidate/use-system-diagnostics';
import { useCandidateAssessments } from '@/hooks/candidate/use-candidate-assessments';
import { ROUTES } from '@/constants/routes';

export default function StandaloneDiagnosticsPage() {
  const params = useParams();
  const router = useRouter();
  const assessmentId = params?.id as string;

  const { data: assessments, isLoading: isAssessmentsLoading } = useCandidateAssessments();
  const assessment = assessments?.find((a) => a.id === assessmentId) ?? (assessments?.[0]) ?? (assessmentId ? {
    id: assessmentId,
    title: 'Assessment',
    companyName: '',
    durationMinutes: 90,
    status: 'ready' as const,
  } : null);

  const diagnostics = useSystemDiagnostics(true);

  const hasFutureWindow = Boolean(
    assessment?.status === 'window_not_open' ||
    (assessment?.windowStartUtc && new Date(assessment.windowStartUtc).getTime() > Date.now())
  );

  const handleProceed = () => {
    if (assessment && diagnostics.canProceed && !hasFutureWindow) {
      router.push(ROUTES.CANDIDATE.CONSENT(assessment.id));
    }
  };

  const handleBack = () => {
    router.push(ROUTES.CANDIDATE.DASHBOARD);
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto py-2">
      <PageHeader
        title="System & Environment Diagnostics"
        description="Verifying your workstation display, browser compatibility, and network connection before entering the assessment workspace."
        badge={{ text: 'Pre-Assessment Check', variant: 'info' }}
        data-testid="diagnostics-page-header"
      />

      {isAssessmentsLoading && !assessment ? (
        <div className="p-8 text-center text-xs text-neutral-400 rounded-xl bg-white border border-neutral-200">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
          Loading assessment details...
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

            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 shrink-0 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Active Verification</span>
            </div>
          </div>

          {/* Window Edge Case (If scheduled for the future) */}
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
          ) : null}

          {/* Clean Diagnostic Checks List */}
          <div className="space-y-3" data-testid="diagnostics-checks-container">
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

          {/* Bottom Action Section (Seamless bottom integration) */}
          {!hasFutureWindow && (
            <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    diagnostics.overallStatus === 'ready'
                      ? 'bg-emerald-500'
                      : diagnostics.overallStatus === 'warning'
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                  }`}
                />
                <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  {diagnostics.isRunning
                    ? 'Verifying system readiness...'
                    : diagnostics.overallStatus === 'ready'
                      ? 'All diagnostic checks passed. System ready.'
                      : diagnostics.overallStatus === 'warning'
                        ? 'Passed with advisories. Ready to proceed.'
                        : 'Action required before starting.'}
                </span>
              </div>

              <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  className="!rounded-lg px-4 py-2"
                  onClick={handleBack}
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  className="!rounded-lg px-5 py-2 font-semibold"
                  onClick={handleProceed}
                  disabled={!diagnostics.canProceed || diagnostics.isRunning}
                  data-testid="continue-to-consent-button"
                  rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                >
                  Continue to Legal Agreement
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-8 text-center text-xs text-neutral-500 rounded-xl bg-white border border-neutral-200">
          Assessment not found or invalid link. Please return to your candidate dashboard.
        </div>
      )}
    </div>
  );
}
