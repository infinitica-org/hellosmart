'use client';

import React from 'react';
import Link from 'next/link';
import {
  PageHeader,
  EmptyState,
  StatCard,
  Card,
  Alert,
  Button,
  Badge,
  AssessmentStatusBadge,
} from '@hs/ui';
import {
  Laptop,
  MessageSquare,
  Clock,
  Users,
  ArrowRight,
  Sliders,
} from 'lucide-react';
import {
  useGetCompanyMetricsQuery,
  useGetAssessmentsQuery,
  type CompanyMetricsDto,
} from '@/store/company/companyApi';
import type { AssessmentSummaryDto } from '@hs/contracts';
import { ROUTES } from '@/constants';

export interface CompanyDashboardViewProps {
  metrics?: CompanyMetricsDto | null | undefined;
  assessments?: AssessmentSummaryDto[] | null | undefined;
  loading?: boolean | undefined;
  error?: string | null | undefined;
  onRefresh?: (() => void) | undefined;
}

export function CompanyDashboardView({
  metrics = null,
  assessments = [],
  loading = false,
  error = null,
  onRefresh,
}: CompanyDashboardViewProps) {
  const activeAssessments = assessments || [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Hiring Pipeline"
          description="Configure work simulation assessments, invite candidates, and review rubric evaluations."
          badge={{ text: 'MMP Active', variant: 'info' }}
          data-testid="company-page-header"
        />
        <div className="flex items-center gap-2 self-start sm:self-center">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            data-testid="refresh-metrics-button"
          >
            {loading ? 'Refreshing...' : '↻ Refresh Metrics'}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="error" data-testid="metrics-error-alert">
          <div className="flex items-center justify-between w-full">
            <span>{error}</span>
            {onRefresh && (
              <Button variant="outline" size="sm" onClick={onRefresh}>
                Retry
              </Button>
            )}
          </div>
        </Alert>
      )}

      {/* Real Pipeline Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard
          label="Configured Assessments"
          value={loading && !metrics ? '—' : String(metrics?.configuredAssessments ?? 0)}
          description={
            metrics
              ? `${metrics.configuredAssessments} active blueprint${metrics.configuredAssessments === 1 ? '' : 's'}`
              : 'Assigned template blueprints'
          }
          data-testid="metric-configured-assessments"
        />
        <StatCard
          label="Invited Candidates"
          value={loading && !metrics ? '—' : String(metrics?.invitedCandidates ?? 0)}
          description={
            metrics
              ? `Remaining quota: ${metrics.remainingQuota} candidates`
              : 'Remaining quota: calculating...'
          }
          data-testid="metric-invited-candidates"
        />
        <StatCard
          label="Submissions to Review"
          value={loading && !metrics ? '—' : String(metrics?.submissionsToReview ?? 0)}
          description={
            metrics
              ? metrics.submissionsToReview === 0
                ? 'Zero pending agent evaluations'
                : `${metrics.submissionsToReview} submission(s) pending review`
              : 'Pending agent evaluations'
          }
          data-testid="metric-submissions-to-review"
        />
      </div>

      {/* Assessments Section */}
      <Card className="p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">Live Assessments</h2>
            <p className="text-xs text-neutral-500 font-normal mt-0.5">
              Assigned templates are private to your organization.
             </p>
          </div>
          <Link href={ROUTES.COMPANY.ASSESSMENTS}>
            <Button variant="outline" size="sm">
              Manage Assessments →
            </Button>
          </Link>
        </div>

        {/* Live Assessments List or Clean Empty State */}
        {activeAssessments.length > 0 ? (
          <div className="divide-y divide-neutral-100">
            {activeAssessments.slice(0, 5).map((assessment) => {
              const isCloud = assessment.workspaceMode === 'cloud';
              const duration = assessment.timing?.durationMinutes || 90;

              return (
                <div
                  key={assessment.id}
                  className="py-4.5 first:pt-0 last:pb-0 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-neutral-50/50 p-3 rounded-xl transition-colors"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <Link
                        href={`/company/assessments/${encodeURIComponent(assessment.id)}`}
                        className="text-sm font-semibold text-neutral-900 hover:text-primary transition-colors truncate"
                      >
                        {assessment.name}
                      </Link>
                      <AssessmentStatusBadge status={assessment.status} size="sm" />
                      <Badge variant="default" size="sm" className="font-mono text-[10px]">
                        v{assessment.templateVersion}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-neutral-500">
                      <span className="flex items-center gap-1">
                        {isCloud ? (
                          <Laptop className="w-3.5 h-3.5 text-neutral-400" />
                        ) : (
                          <MessageSquare className="w-3.5 h-3.5 text-neutral-400" />
                        )}
                        <span>{isCloud ? 'Cloud VM' : 'Chat'}</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-neutral-400" />
                        <span>{duration}m</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-neutral-400" />
                        <span>{assessment.candidateCount ?? 0} candidates</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-auto">
                    <Link
                      href={`/company/assessments/${encodeURIComponent(assessment.id)}/rubric?templateId=${encodeURIComponent(assessment.templateId)}&versionId=${encodeURIComponent(assessment.templateVersionId)}`}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<Sliders className="w-3.5 h-3.5 text-neutral-500" />}
                        className="text-xs h-8"
                      >
                        Rubric
                      </Button>
                    </Link>
                    <Link href={`/company/assessments/${encodeURIComponent(assessment.id)}`}>
                      <Button
                        variant="outline"
                        size="sm"
                        rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                        className="text-xs h-8"
                      >
                        Details
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No assessments created yet"
            description="No assessments published yet. Create your first assessment from assigned private templates and invite candidates to start real work simulation."
            data-testid="company-empty-state"
            action={{
              label: 'Create Assessment',
              href: ROUTES.COMPANY.ASSESSMENTS,
            }}
          />
        )}
      </Card>

    </div>
  );
}

export default function CompanyDashboardPage() {
  const {
    data: metrics,
    isLoading: loadingMetrics,
    error: metricsError,
    refetch: refetchMetrics,
  } = useGetCompanyMetricsQuery();

  const {
    data: rawAssessments,
    isLoading: loadingAssessments,
    refetch: refetchAssessments,
  } = useGetAssessmentsQuery();

  const assessments: AssessmentSummaryDto[] = React.useMemo(() => {
    if (!rawAssessments) return [];
    if (Array.isArray(rawAssessments)) return rawAssessments;
    return (rawAssessments as { items?: AssessmentSummaryDto[] })?.items || [];
  }, [rawAssessments]);

  const loading = loadingMetrics || loadingAssessments;
  const error = metricsError
    ? 'data' in metricsError
      ? String((metricsError as any).data?.detail || 'Failed to load pipeline metrics')
      : 'Failed to load pipeline metrics'
    : null;

  return (
    <CompanyDashboardView
      metrics={metrics}
      assessments={assessments}
      loading={loading}
      error={error}
      onRefresh={() => {
        void refetchMetrics();
        void refetchAssessments();
      }}
    />
  );
}
