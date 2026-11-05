'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { PageHeader, EmptyState, Badge, Button, Card, Input } from '@hs/ui';
import {
  useGetCandidateAssessmentsQuery,
  type CandidateAssessmentItem,
} from '@/store/candidate/candidateApi';
import { Laptop, MessageSquare, Clock, Search, CheckCircle2, AlertCircle } from 'lucide-react';

export default function CandidateAssessmentsPage() {
  const { data: rawAssignments } = useGetCandidateAssessmentsQuery();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'submitted'>('all');

  const assignments: CandidateAssessmentItem[] = useMemo(() => {
    if (!rawAssignments) return [];
    if (Array.isArray(rawAssignments)) return rawAssignments;
    return (rawAssignments as { items?: CandidateAssessmentItem[] })?.items || [];
  }, [rawAssignments]);

  const filteredAssignments = useMemo(() => {
    return assignments.filter((item) => {
      // Status filter
      if (statusFilter === 'active') {
        if (item.status === 'submitted' || item.status === 'expired' || item.status === 'revoked') {
          return false;
        }
      } else if (statusFilter === 'submitted') {
        if (item.status !== 'submitted') {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(query);
        const matchesCompany = item.companyName?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesCompany) {
          return false;
        }
      }

      return true;
    });
  }, [assignments, statusFilter, searchQuery]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Assessments"
        description="Assigned work simulations and practical evaluation workspaces."
        badge={{ text: 'Candidate Portal', variant: 'info' }}
        data-testid="candidate-assessments-header"
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={statusFilter === 'all' ? 'primary' : 'outline'}
            onClick={() => setStatusFilter('all')}
            data-testid="filter-all"
          >
            {`All (${assignments.length})`}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={statusFilter === 'active' ? 'primary' : 'outline'}
            onClick={() => setStatusFilter('active')}
            data-testid="filter-active"
          >
            {`Active (${
              assignments.filter(
                (a) => a.status !== 'submitted' && a.status !== 'expired' && a.status !== 'revoked',
              ).length
            })`}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={statusFilter === 'submitted' ? 'primary' : 'outline'}
            onClick={() => setStatusFilter('submitted')}
            data-testid="filter-submitted"
          >
            {`Submitted (${assignments.filter((a) => a.status === 'submitted').length})`}
          </Button>
        </div>

        <div className="relative w-full sm:w-72">
          <Input
            type="text"
            placeholder="Search by title or company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs sm:text-sm"
            data-testid="assessments-search-input"
          />
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Assessment Listing */}
      {filteredAssignments.length > 0 ? (
        <div className="space-y-4">
          {filteredAssignments.map((task) => {
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
                      variant={isSubmitted ? 'outline' : 'primary'}
                      data-testid={`assessment-action-${task.id}`}
                      className="flex-shrink-0 font-medium"
                    >
                      {isReady
                        ? 'Start Assessment →'
                        : isInProgress
                        ? 'Resume Assessment →'
                        : isSubmitted
                        ? 'View Details →'
                        : 'View Assessment →'}
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
                    <span className="text-neutral-500 block mb-0.5 font-light">Status & Results</span>
                    <span className="text-neutral-800 font-medium inline-flex items-center gap-1.5">
                      {isSubmitted ? (
                        task.releaseResults ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">Results Released</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-3.5 h-3.5 text-neutral-500" />
                            <span className="text-neutral-600">Under Review</span>
                          </>
                        )
                      ) : (
                        <span>Governed AI Proxy</span>
                      )}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-6 sm:p-8">
          <EmptyState
            title={
              searchQuery || statusFilter !== 'all'
                ? 'No matching assessments found'
                : 'No active assignments'
            }
            description={
              searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search query or filter criteria.'
                : 'You do not currently have any pending assessments. Please check your invitation email or contact your hiring recruiter.'
            }
          />
        </Card>
      )}
    </div>
  );
}
