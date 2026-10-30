'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import type { CandidateAssignmentDto } from '@hs/contracts';
import {
  PageHeader,
  EmptyState,
  Card,
  Badge,
  Button,
  Spinner,
  Alert,
  RefreshCw,
} from '@hs/ui';
import { listCandidateAssignments } from '@/lib/api-client';

export default function CandidateAssessmentsPage(): React.JSX.Element {
  const [assignments, setAssignments] = useState<CandidateAssignmentDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssignments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listCandidateAssignments();
      setAssignments(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load assessments.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="My Assessments"
          description="Assigned work simulations and practical evaluation workspaces."
          badge={{ text: 'Candidate Portal', variant: 'info' }}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={fetchAssignments}
          disabled={isLoading}
          leftIcon={<RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />}
        >
          Refresh
        </Button>
      </div>

      {error && (
        <Alert
          variant="error"
          title="Error"
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {isLoading ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <Spinner size="lg" className="text-primary mb-3" />
          <p className="text-sm text-neutral-500 font-medium">Loading assessments...</p>
        </Card>
      ) : assignments.length === 0 ? (
        <Card className="p-6 sm:p-8">
          <EmptyState
            title="No active assignments"
            description="You do not currently have any pending assessments. Please check your invitation email or contact your hiring recruiter."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {assignments.map((task) => (
            <Card key={task.id} className="p-6 sm:p-8 space-y-4 border border-neutral-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-neutral-100">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-base font-semibold text-neutral-900">{task.title}</h2>
                    <Badge
                      variant={
                        task.status === 'ready'
                          ? 'success'
                          : task.status === 'in_progress'
                            ? 'warning'
                            : 'default'
                      }
                      dot
                    >
                      {task.status === 'ready'
                        ? 'Ready to Start'
                        : task.status === 'in_progress'
                          ? 'In Progress'
                          : 'Submitted'}
                    </Badge>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">
                    Issued by <span className="font-medium text-neutral-800">{task.companyName}</span> &bull; {task.durationMinutes} minutes duration
                  </p>
                </div>

                <Link href="/candidate">
                  <Button variant="primary" size="sm">
                    {task.status === 'ready' ? 'Open & Start →' : task.status === 'in_progress' ? 'Resume Workspace →' : 'View Submission'}
                  </Button>
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200/70">
                  <span className="text-neutral-500 block mb-0.5 font-light">Workspace Mode</span>
                  <span className="text-neutral-800 font-medium">{task.mode === 'cloud' ? 'Cloud VM (Terminal/IDE)' : 'Interactive Chat'}</span>
                </div>
                <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200/70">
                  <span className="text-neutral-500 block mb-0.5 font-light">Duration Allowed</span>
                  <span className="text-neutral-800 font-medium">{task.durationMinutes} Minutes</span>
                </div>
                <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200/70">
                  <span className="text-neutral-500 block mb-0.5 font-light">Governed AI Proxy</span>
                  <span className="text-neutral-800 font-medium">Enabled (BR-13)</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
