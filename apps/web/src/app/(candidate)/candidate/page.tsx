'use client';

import React from 'react';
import Link from 'next/link';
import { PageHeader, EmptyState, Badge, Button, Card } from '@hs/ui';
import {
  useGetCandidateAssessmentsQuery,
  type CandidateAssessmentItem,
} from '@/store/candidate/candidateApi';
import { Laptop, MessageSquare, Clock } from 'lucide-react';

export default function CandidateDashboardPage() {
  const { data: rawAssignments } = useGetCandidateAssessmentsQuery();

  const assignments: CandidateAssessmentItem[] = React.useMemo(() => {
    if (!rawAssignments) return [];
    if (Array.isArray(rawAssignments)) return rawAssignments;
    return (rawAssignments as { items?: CandidateAssessmentItem[] })?.items || [];
  }, [rawAssignments]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Candidate Assessment Workspace"
        description="Complete practical work simulation tasks in a controlled cloud environment with real developer tools."
        badge={{ text: 'Candidate Portal', variant: 'info' }}
        data-testid="candidate-page-header"
      />

      {/* Main Area: Show Assigned Assessment Card(s) or Clean Empty State */}
      {assignments.length > 0 ? (
        <div className="space-y-4">
          {assignments.map((task) => {
            const isReady = task.status === 'ready' || task.status === 'invited';
            const isInProgress = task.status === 'in_progress' || task.status === 'disconnected';
            const isSubmitted = task.status === 'submitted';
            const isCloud = task.workspaceMode === 'cloud';

            return (
              <Card key={task.id} className="p-6 sm:p-8 space-y-5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-neutral-100">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-base font-medium text-neutral-900">{task.title}</h2>
                      <Badge
                        variant={
                          isReady
                            ? 'success'
                            : isInProgress
                            ? 'warning'
                            : isSubmitted
                            ? 'default'
                            : 'default'
                        }
                        dot
                      >
                        {isReady
                          ? 'Ready to Start'
                          : isInProgress
                          ? 'In Progress'
                          : isSubmitted
                          ? 'Submitted'
                          : task.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1 font-light">
                      Issued by{' '}
                      <span className="text-neutral-800 font-medium">
                        {task.companyName || 'Hiring Company'}
                      </span>{' '}
                      &bull; {task.durationMinutes} minutes duration
                    </p>
                  </div>

                  <Link href={`/candidate/assessments/${task.id}`}>
                    <Button
                      type="button"
                      variant="primary"
                      data-testid="start-assessment-button"
                      className="flex-shrink-0 bg-primary hover:bg-primary-hover text-white border-transparent font-medium"
                    >
                      {isReady
                        ? 'Start Assessment →'
                        : isInProgress
                        ? 'Resume Assessment →'
                        : 'View Details →'}
                    </Button>
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/80">
                    <span className="text-neutral-500 block mb-0.5 font-light">Environment</span>
                    <span className="text-neutral-800 font-medium inline-flex items-center gap-1.5">
                      {isCloud ? (
                        <Laptop className="w-3.5 h-3.5 text-neutral-500" />
                      ) : (
                        <MessageSquare className="w-3.5 h-3.5 text-neutral-500" />
                      )}
                      <span>{isCloud ? 'Cloud VM' : 'Chat Workspace'}</span>
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/80">
                    <span className="text-neutral-500 block mb-0.5 font-light">Duration</span>
                    <span className="text-neutral-800 font-medium inline-flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-neutral-500" />
                      <span>{task.durationMinutes} Minutes</span>
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/80">
                    <span className="text-neutral-500 block mb-0.5 font-light">AI Assistance</span>
                    <span className="text-neutral-800 font-medium">Governed AI Proxy</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-6 sm:p-8 shadow-xs space-y-6">
          <div>
            <h2 className="text-base font-medium text-neutral-900">Assigned Tasks</h2>
            <p className="text-xs text-neutral-500 font-normal mt-0.5">
              Active invitations from hiring companies.
            </p>
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
