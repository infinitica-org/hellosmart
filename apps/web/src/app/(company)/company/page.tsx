import React from 'react';
import { PageHeader, EmptyState, StatCard } from '@hs/ui';

export default function CompanyDashboardPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Hiring Pipeline"
        description="Configure work simulation assessments, invite candidates, and review rubric evaluations."
        badge={{ text: 'MMP Active', variant: 'info' }}
        data-testid="company-page-header"
        breadcrumbs={[
          { label: 'Company', href: '/company' },
          { label: 'Dashboard' },
        ]}
      />

      {/* Real Pipeline Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard
          label="Configured Assessments"
          value="0"
          description="No active assessment blueprints"
          data-testid="metric-configured-assessments"
        />
        <StatCard
          label="Invited Candidates"
          value="0"
          description="Remaining quota: 20 candidates (BR-06)"
          data-testid="metric-invited-candidates"
        />
        <StatCard
          label="Submissions to Review"
          value="0"
          description="Zero pending agent evaluations"
          data-testid="metric-submissions-to-review"
        />
      </div>

      {/* Assessments Section */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-base font-medium text-neutral-900">Live Assessments</h2>
            <p className="text-xs text-neutral-500 font-normal mt-0.5">
              Assigned templates are private to your organization (BR-02).
            </p>
          </div>
        </div>

        {/* Clean Empty State */}
        <EmptyState
          title="No assessments created yet"
          description="No assessments published yet. Create your first assessment from assigned private templates and invite candidates to start real work simulation."
          data-testid="company-empty-state"
          action={{
            label: 'Create Assessment',
            href: '/company',
          }}
        />
      </div>

      {/* Review Workflow Guideline */}
      <div className="rounded-2xl border border-neutral-200/80 bg-neutral-50/70 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-neutral-600">
        <div className="space-y-1">
          <div className="font-medium text-neutral-800">
            AI Reviewer Evaluation Process
          </div>
          <p className="font-normal">
            Submissions are scored independently by multi-dimensional agents citing direct evidence (BR-18, BR-19).
          </p>
        </div>
        <div className="font-mono text-primary bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/25 font-normal">
          Human Final Override: Enforced
        </div>
      </div>
    </div>
  );
}
