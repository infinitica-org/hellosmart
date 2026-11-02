'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader, EmptyState, Button, Card } from '@hs/ui';
import { AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { AssessmentCard, type CandidateAssessment } from '@/components/candidate/assessment-card';
import { SystemDiagnosticsModal } from '@/components/candidate/diagnostics/diagnostics-modal';
import { AssessmentConsentModal } from '@/components/candidate/assessment-consent-modal';
import { useCandidateAssessments } from '@/hooks/candidate/use-candidate-assessments';
import { ROUTES } from '@/constants/routes';
import { ALERT_MESSAGES } from '@/constants/messages';

export default function CandidateDashboardPage() {
  const router = useRouter();
  const { data, isLoading, isRefetching, error, refetch } = useCandidateAssessments();
  const [selectedAssessmentForDiagnostics, setSelectedAssessmentForDiagnostics] = useState<CandidateAssessment | null>(null);
  const [selectedAssessmentForConsent, setSelectedAssessmentForConsent] = useState<CandidateAssessment | null>(null);

  const handleStart = (assessment: CandidateAssessment) => {
    setSelectedAssessmentForDiagnostics(assessment);
  };

  const handleContinueToConsent = (assessment: CandidateAssessment) => {
    setSelectedAssessmentForDiagnostics(null);
    setSelectedAssessmentForConsent(assessment);
  };

  const handleConsentSuccess = (assessment: CandidateAssessment) => {
    setSelectedAssessmentForConsent(null);
    const targetId = assessment.workspaceId || assessment.id;
    router.push(ROUTES.CANDIDATE.WORKSPACE(targetId));
  };

  const handleResume = (assessment: CandidateAssessment) => {
    const targetId = assessment.workspaceId || assessment.id;
    router.push(ROUTES.CANDIDATE.WORKSPACE(targetId));
  };

  const handleCountdownZero = (_assessment: CandidateAssessment) => {
    void refetch();
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Candidate Assessment Workspace"
          description="Complete practical work simulation tasks in a controlled cloud environment with real developer tools."
          badge={{ text: 'Candidate Portal', variant: 'info' }}
          data-testid="candidate-page-header"
        />

        {data && data.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isLoading || isRefetching}
            className="self-start sm:self-auto flex items-center gap-2 text-xs border-neutral-200"
            aria-label="Refresh assessments"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div data-testid="candidate-loading-skeleton" className="space-y-4">
          {[1, 2].map((i) => (
            <Card key={i} className="p-6 sm:p-8 animate-pulse border-neutral-200 bg-white">
              <div className="flex items-center justify-between pb-6 border-b border-neutral-100">
                <div className="space-y-2.5">
                  <div className="h-5 w-48 bg-neutral-200 rounded-md" />
                  <div className="h-4 w-72 bg-neutral-100 rounded-md" />
                </div>
                <div className="h-10 w-36 bg-neutral-200 rounded-xl" />
              </div>
              <div className="pt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="h-14 bg-neutral-50 rounded-xl border border-neutral-100" />
                <div className="h-14 bg-neutral-50 rounded-xl border border-neutral-100" />
                <div className="h-14 bg-neutral-50 rounded-xl border border-neutral-100" />
              </div>
            </Card>
          ))}
          <div className="flex items-center justify-center gap-2 py-4 text-xs text-neutral-400">
            <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
            Loading assigned assessments...
          </div>
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <Card
          data-testid="candidate-error-state"
          className="p-6 sm:p-8 border-red-200 bg-red-50/50 space-y-4"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-red-900">Failed to load assessments</h3>
              <p className="text-xs text-red-700 mt-1">
                {error.message || 'Unable to connect to the assessment service. Please try again.'}
              </p>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              className="border-red-300 text-red-700 hover:bg-red-100/60"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Try Again
            </Button>
          </div>
        </Card>
      )}

      {/* Empty State: exact ticket requirement */}
      {!isLoading && !error && (!data || data.length === 0) && (
        <Card className="p-6 sm:p-10 shadow-xs border-neutral-200 bg-white" data-testid="candidate-empty-container">
          <EmptyState
            title="No active assessments"
            description={ALERT_MESSAGES.CANDIDATES.EMPTY_ACTIVE_ASSESSMENTS}
            data-testid="candidate-empty-state"
          />
        </Card>
      )}

      {/* Assessment Cards List */}
      {!isLoading && !error && data && data.length > 0 && (
        <div className="space-y-5" data-testid="candidate-assessments-list">
          {data.map((assessment) => (
            <AssessmentCard
              key={assessment.id}
              assessment={assessment}
              onStartAssessment={handleStart}
              onResumeAssessment={handleResume}
              onCountdownZero={handleCountdownZero}
            />
          ))}
        </div>
      )}

      {/* Pre-Test System Diagnostics Modal (#118) */}
      <SystemDiagnosticsModal
        isOpen={Boolean(selectedAssessmentForDiagnostics)}
        assessment={selectedAssessmentForDiagnostics}
        onClose={() => setSelectedAssessmentForDiagnostics(null)}
        onContinueToConsent={handleContinueToConsent}
      />

      {/* Pre-Assessment Legal Agreement & Consent Modal (#119, BR-12) */}
      <AssessmentConsentModal
        isOpen={Boolean(selectedAssessmentForConsent)}
        assessment={selectedAssessmentForConsent}
        onClose={() => setSelectedAssessmentForConsent(null)}
        onConsentSuccess={handleConsentSuccess}
      />
    </div>
  );
}
