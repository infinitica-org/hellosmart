'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { PageHeader, EmptyState, StatCard, Card, Alert, Button } from '@hs/ui';
import { getCompanyMetrics } from '@/lib/api-client';
import type { CompanyMetricsDto } from '@hs/contracts';

export interface CompanyDashboardViewProps {
  metrics?: CompanyMetricsDto | null | undefined;
  loading?: boolean | undefined;
  error?: string | null | undefined;
  onRefresh?: (() => void) | undefined;
}

export function CompanyDashboardView({
  metrics = null,
  loading = false,
  error = null,
  onRefresh,
}: CompanyDashboardViewProps) {
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
              ? `Remaining quota: ${metrics.remainingQuota} candidates (BR-06)`
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
              Assigned templates are private to your organization (BR-02).
            </p>
          </div>
          <Link href="/company/assessments">
            <Button variant="outline" size="sm">
              Manage Assessments →
            </Button>
          </Link>
        </div>

        {/* Clean Empty State */}
        <EmptyState
          title="No assessments created yet"
          description="No assessments published yet. Create your first assessment from assigned private templates and invite candidates to start real work simulation."
          data-testid="company-empty-state"
          action={{
            label: 'Create Assessment',
            href: '/company/assessments',
          }}
        />
      </Card>

      {/* Review Workflow Guideline */}
      <Alert variant="info" className="text-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full">
          <div className="space-y-1">
            <div className="font-semibold text-neutral-900">
              AI Reviewer Evaluation Process
            </div>
            <p className="text-neutral-600 font-normal">
              Submissions are scored independently by multi-dimensional agents citing direct evidence (BR-18, BR-19).
            </p>
          </div>
          <div className="font-mono text-primary bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/25 font-normal shrink-0">
            Human Final Override: Enforced
          </div>
        </div>
      </Alert>
    </div>
  );
}

export default function CompanyDashboardPage() {
  const [metrics, setMetrics] = useState<CompanyMetricsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCompanyMetrics();
      setMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pipeline metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  return (
    <CompanyDashboardView
      metrics={metrics}
      loading={loading}
      error={error}
      onRefresh={() => void loadMetrics()}
    />
  );
}
