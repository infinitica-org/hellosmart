'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader, EmptyState, Button, Card } from '@hs/ui';
import { AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { AssessmentCard, type CandidateAssessment } from '@/components/candidate/assessment-card';
import { useGetCandidateAssignmentsQuery } from '@/store/candidate/candidateApi';
import { ROUTES } from '@/constants/routes';

export default function CandidateDashboardPage() {
  const router = useRouter();
  const {
    data,
    isLoading,
    isFetching,
    error: rtkError,
    refetch,
  } = useGetCandidateAssignmentsQuery();

  const isRefetching = !isLoading && isFetching;
  const error = rtkError ? (rtkError as any).data || rtkError : null;

  const handleStart = (assessment: CandidateAssessment) => {
    router.push(ROUTES.CANDIDATE.DIAGNOSTICS(assessment.id));
  };

  const handleResume = (assessment: CandidateAssessment) => {
    const targetId = assessment.workspaceId || assessment.id;
    router.push(ROUTES.CANDIDATE.WORKSPACE(targetId));
  };

  const handleCountdownZero = (_assessment: CandidateAssessment) => {
    void refetch();
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="Candidate Assessment Workspace"
        description="Complete practical work simulation tasks in a controlled cloud environment with real developer tools."
        badge={{ text: 'Candidate Portal', variant: 'info' }}
        data-testid="candidate-page-header"
        actions={
          data && data.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              disabled={isLoading || isRefetching}
              className="flex items-center gap-2 text-xs border-neutral-200 hover:bg-neutral-50"
              aria-label="Refresh assessments"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          ) : undefined
        }
      />

      {/* Error State */}
      {!isLoading && error && (
        <Card
          data-testid="candidate-error-state"
          className="p-6 sm:p-8 border-danger-border bg-danger-muted/40 space-y-4"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-danger-muted flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 text-danger" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-danger-foreground">Failed to load assessments</h3>
              <p className="text-xs text-danger-foreground/80 mt-1">
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
              className="border-danger-border text-danger-foreground hover:bg-danger-muted"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Try Again
            </Button>
          </div>
        </Card>
      )}

      {/* Main Content: Assigned Tasks or Empty State */}
      {data && data.length > 0 ? (
        <div className="space-y-5" data-testid="candidate-assessments-list">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-medium text-neutral-900">Assigned Tasks</h2>
              <p className="text-xs text-neutral-500 font-normal mt-0.5">
                Active invitations from hiring companies.
              </p>
            </div>
            {isFetching && (
              <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Refreshing…</span>
              </div>
            )}
          </div>
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
      ) : (
        <Card className="p-6 sm:p-8 shadow-xs space-y-6" data-testid="candidate-empty-container">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-medium text-neutral-900">Assigned Tasks</h2>
              <p className="text-xs text-neutral-500 font-normal mt-0.5">
                Active invitations from hiring companies.
              </p>
            </div>
            {isLoading && (
              <div className="flex items-center gap-1.5 text-xs text-neutral-400" data-testid="candidate-loading-indicator">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Loading…</span>
              </div>
            )}
          </div>

          <EmptyState
            title="No active assignments"
            description="You do not currently have any pending assessments. Please check your invitation email or contact your hiring recruiter."
            data-testid="candidate-empty-state"
          />
        </Card>
      )}
    </div>
  );
}
