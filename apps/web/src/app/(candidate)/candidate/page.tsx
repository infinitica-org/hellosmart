'use client';

import React, { useState } from 'react';
import { PageHeader, EmptyState, Badge, Button } from '@hs/ui';

interface AssessmentItem {
  id: string;
  title: string;
  companyName: string;
  status: 'ready' | 'in_progress' | 'submitted';
  durationMinutes: number;
  mode: string;
}

export default function CandidateDashboardPage() {
  // Real candidate assignments state (starts empty with zero dummy data)
  const [assignments, setAssignments] = useState<AssessmentItem[]>([]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Candidate Assessment Workspace"
        description="Complete practical work simulation tasks in a controlled cloud environment with real developer tools."
        badge={{ text: 'Candidate Portal', variant: 'info' }}
        data-testid="candidate-page-header"
        breadcrumbs={[
          { label: 'Candidate', href: '/candidate' },
          { label: 'Assessments' },
        ]}
      />

      {/* Main Area: Show Assigned Assessment Card(s) or Clean Empty State */}
      {assignments.length > 0 ? (
        <div className="space-y-4">
          {assignments.map((task) => (
            <div
              key={task.id}
              className="glass-card rounded-2xl border border-slate-800/80 p-6 sm:p-8 space-y-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-800/80">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-white">{task.title}</h2>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {task.status === 'ready'
                        ? 'Ready to Start'
                        : task.status === 'in_progress'
                          ? 'In Progress'
                          : 'Submitted'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Issued by <span className="text-slate-200 font-medium">{task.companyName}</span> &bull; {task.durationMinutes} minutes duration
                  </p>
                </div>

                <Button
                  type="button"
                  variant="primary"
                  data-testid="start-assessment-button"
                  className="flex-shrink-0"
                >
                  Start Assessment →
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-400 block mb-0.5">Environment</span>
                  <span className="text-slate-200 font-medium">{task.mode}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-400 block mb-0.5">Duration</span>
                  <span className="text-slate-200 font-medium">{task.durationMinutes} Minutes</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-400 block mb-0.5">AI Assistance</span>
                  <span className="text-slate-200 font-medium">Governed AI Proxy</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
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
            data-testid="candidate-empty-state"
          />
        </div>
      )}
    </div>
  );
}
