'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageHeader, Card, Button } from '@hs/ui';
import { ArrowLeft, Building2, Clock, ShieldCheck, Lock, Loader2 } from 'lucide-react';
import { ResolutionCheck } from '@/components/candidate/diagnostics/resolution-check';
import { BrowserCheck } from '@/components/candidate/diagnostics/browser-check';
import { NetworkCheck } from '@/components/candidate/diagnostics/network-check';
import { DiagnosticsSummary } from '@/components/candidate/diagnostics/diagnostics-summary';
import { WindowCountdown } from '@/components/candidate/window-countdown';
import { useSystemDiagnostics } from '@/hooks/candidate/use-system-diagnostics';
import { useCandidateAssessments } from '@/hooks/candidate/use-candidate-assessments';
import { ROUTES } from '@/constants/routes';

export default function StandaloneDiagnosticsPage() {
  const params = useParams();
  const router = useRouter();
  const assessmentId = params?.id as string;

  const { data: assessments, isLoading: isAssessmentsLoading } = useCandidateAssessments();
  const assessment = assessments?.find((a) => a.id === assessmentId) ?? (assessmentId ? {
    id: assessmentId,
    title: 'Candidate Technical Assessment',
    companyName: 'Evaluating Organization',
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
    <div className="space-y-6 max-w-4xl mx-auto py-2">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleBack}
          className="text-xs border-neutral-200"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          Back to Dashboard
        </Button>
      </div>

      <PageHeader
        title="Pre-Assessment System Diagnostics"
        description="Verify your screen resolution, browser capabilities, and network connection before entering the assessment workspace."
        badge={{ text: 'System Check #118', variant: 'info' }}
        data-testid="diagnostics-page-header"
      />

      {isAssessmentsLoading && !assessment ? (
        <Card className="p-8 text-center text-xs text-neutral-400">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
          Loading assessment details...
        </Card>
      ) : assessment ? (
        <div className="space-y-6">
          {/* Assessment Overview Card */}
          <Card className="p-4 sm:p-5 border-neutral-200 bg-white flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                Selected Assessment
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
              <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </span>
              <span className="text-xs font-medium text-emerald-800">Diagnostics Active</span>
            </div>
          </Card>

          {/* Window Edge Case */}
          {hasFutureWindow && assessment.windowStartUtc ? (
            <div className="p-6 rounded-2xl border border-amber-200 bg-amber-50/50 space-y-4">
              <div className="flex items-center gap-2.5 text-amber-900 font-semibold text-sm">
                <Lock className="w-4 h-4 text-amber-600" />
                <span>Testing Window Not Yet Open</span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                This assessment cannot be started before the official window opens. You may review your system diagnostics below, but entry will remain locked until the countdown completes.
              </p>
              <WindowCountdown targetDateUtc={assessment.windowStartUtc} />
            </div>
          ) : null}

          {/* Checks List */}
          <div className="space-y-4" data-testid="diagnostics-checks-container">
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

          {/* Summary & Next Step */}
          {!hasFutureWindow && (
            <DiagnosticsSummary
              state={diagnostics}
              onProceed={handleProceed}
              onRetry={() => void diagnostics.runDiagnostics()}
            />
          )}
        </div>
      ) : (
        <Card className="p-8 text-center text-xs text-neutral-500">
          Assessment not found or invalid link. Please return to your candidate dashboard.
        </Card>
      )}
    </div>
  );
}

