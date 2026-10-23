import React from 'react';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';

export default function CompanyDashboardPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Hiring Pipeline"
        description="Configure work simulation assessments, invite candidates, and review rubric evaluations."
        badge={{ text: 'MMP Active', variant: 'info' }}
        breadcrumbs={[
          { label: 'Company', href: '/company' },
          { label: 'Dashboard' },
        ]}
      />

      {/* Real Pipeline Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="glass-card rounded-2xl border border-slate-800/80 p-6">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Configured Assessments
          </div>
          <div className="text-3xl font-extrabold font-mono text-white mt-2">0</div>
          <div className="text-[11px] text-slate-500 mt-2">
            No active assessment blueprints
          </div>
        </div>

        <div className="glass-card rounded-2xl border border-slate-800/80 p-6">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Invited Candidates
          </div>
          <div className="text-3xl font-extrabold font-mono text-white mt-2">0</div>
          <div className="text-[11px] text-slate-500 mt-2">
            Remaining quota: 20 candidates (BR-06)
          </div>
        </div>

        <div className="glass-card rounded-2xl border border-slate-800/80 p-6">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Submissions to Review
          </div>
          <div className="text-3xl font-extrabold font-mono text-white mt-2">0</div>
          <div className="text-[11px] text-slate-500 mt-2">
            Zero pending agent evaluations
          </div>
        </div>
      </div>

      {/* Assessments Section */}
      <div className="glass-card rounded-2xl border border-slate-800/80 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-base font-semibold text-slate-100">Live Assessments</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Assigned templates are private to your organization (BR-02).
            </p>
          </div>
        </div>

        <EmptyState
          title="No assessments published yet"
          description="Create your first assessment from assigned private templates and invite candidates to start real work simulation."
          action={{
            label: 'Explore Templates',
            href: '/company',
          }}
        />
      </div>

      {/* Review Workflow Guideline */}
      <div className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-400">
        <div className="space-y-1">
          <div className="font-semibold text-slate-200">
            AI Reviewer Evaluation Process
          </div>
          <p>
            Submissions are scored independently by multi-dimensional agents citing direct evidence (BR-18, BR-19).
          </p>
        </div>
        <div className="font-mono text-indigo-400 bg-indigo-950/50 px-3 py-1.5 rounded-lg border border-indigo-800/60">
          Human Final Override: Enforced
        </div>
      </div>
    </div>
  );
}
