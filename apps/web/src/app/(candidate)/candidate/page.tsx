import React from 'react';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';

export default function CandidateDashboardPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Candidate Assessment Workspace"
        description="Complete practical work simulation tasks in a controlled cloud environment with real developer tools."
        badge={{ text: 'Candidate Portal', variant: 'info' }}
        breadcrumbs={[
          { label: 'Candidate', href: '/candidate' },
          { label: 'Assessments' },
        ]}
      />

      {/* Candidate Guidance Card */}
      <div className="glass-card rounded-2xl border border-slate-800/80 p-6 sm:p-8 space-y-4">
        <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          Welcome to HelloSmart Assessment
        </h2>
        <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">
          You will be completing real-world engineering or technical tasks inside an isolated Linux container with VS Code, a live bash terminal, and governed AI coding assistants.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <div className="text-xs font-semibold text-indigo-400 mb-1">01. Timer on Disconnect</div>
            <p className="text-xs text-slate-400">
              The assessment timer keeps running if you disconnect (BR-09). Ensure a stable connection.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <div className="text-xs font-semibold text-cyan-400 mb-1">02. Full Screen Policy</div>
            <p className="text-xs text-slate-400">
              Connecting requests full screen. Exiting disconnects and logs activity (BR-10).
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <div className="text-xs font-semibold text-emerald-400 mb-1">03. Continuous Autosave</div>
            <p className="text-xs text-slate-400">
              Your files, git diffs, and terminal state persist continuously (RPO &le; 30s, BR-11).
            </p>
          </div>
        </div>
      </div>

      {/* Active Assignments Section */}
      <div className="glass-card rounded-2xl border border-slate-800/80 p-6 sm:p-8">
        <div className="mb-6">
          <h2 className="text-base font-semibold text-slate-100">Assigned Tasks</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Active invitations from hiring companies.
          </p>
        </div>

        <EmptyState
          title="No active assignments"
          description="You do not currently have any pending assessments. Please check your invitation email or contact your hiring recruiter."
        />
      </div>
    </div>
  );
}
