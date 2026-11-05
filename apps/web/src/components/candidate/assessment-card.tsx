'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
  Button,
  Badge,
  Card,
} from '@hs/ui';
import { Building2, Clock, CheckCircle2, AlertCircle, Play, RotateCcw, FileText, Lock, Terminal, ShieldCheck, Loader2 } from 'lucide-react';
import { WindowCountdown } from './window-countdown';
import { fetchCandidateAssessmentDetails, fetchCandidateAssignments } from '@/lib/candidate-api';

export type AssessmentStatus = 'window_not_open' | 'ready' | 'in_progress' | 'submitted' | 'expired';

export interface CandidateAssessment {
  id: string;
  title: string;
  companyName: string;
  durationMinutes: number;
  status: AssessmentStatus;
  /** ISO 8601 UTC timestamp for when the window opens (required for window_not_open) */
  windowStartUtc?: string | null;
  /** ISO 8601 UTC timestamp for window end/deadline */
  windowEndUtc?: string | null;
  /** ISO 8601 UTC timestamp for when submission occurred (required for submitted) */
  submittedAt?: string | null;
  /** Mode: cloud or chat */
  workspaceMode?: 'cloud' | 'chat';
  /** Associated workspace session id if available */
  workspaceId?: string | null;
  /** Candidate task instructions / brief (markdown) */
  instructions?: string | null;
  /** Short scenario or task description */
  description?: string | null;
}

export interface AssessmentCardProps {
  assessment?: CandidateAssessment | undefined;
  assessmentId?: string | undefined;
  /** Triggered when Start Assessment is clicked (routes to System Diagnostics #118) */
  onStartAssessment?: (assessment: CandidateAssessment) => void;
  /** Triggered when Resume Assessment is clicked (routes to Workspace #120) */
  onResumeAssessment?: (assessment: CandidateAssessment) => void;
  /** Triggered when live countdown hits zero to refresh assessment state from server */
  onCountdownZero?: (assessment: CandidateAssessment) => void;
  className?: string;
}

function formatSubmittedDate(dateString?: string | null): string {
  if (!dateString) return 'Completed';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Completed';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return 'Completed';
  }
}

export function AssessmentCard({
  assessment: initialAssessment,
  assessmentId,
  onStartAssessment,
  onResumeAssessment,
  onCountdownZero,
  className = '',
}: AssessmentCardProps): React.JSX.Element {
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);

  // Dynamic variable data calling (Fetches real data by ID if not provided)
  const [data, setData] = useState<CandidateAssessment | null>(initialAssessment ?? null);
  const [isLoading, setIsLoading] = useState<boolean>(!initialAssessment && Boolean(assessmentId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialAssessment) {
      setData(initialAssessment);
      setIsLoading(false);
      return;
    }

    if (!assessmentId) return;

    let isCancelled = false;

    async function fetchCardData() {
      setIsLoading(true);
      setError(null);

      try {
        // Direct variable data-calling from API
        try {
          const detail = await fetchCandidateAssessmentDetails(assessmentId!);
          if (!isCancelled && detail && detail.id) {
            setData({
              id: detail.assignmentId || detail.id,
              title: detail.name,
              companyName: detail.companyName,
              durationMinutes: detail.durationMinutes,
              status: (detail.status as any) || 'ready',
              workspaceMode: detail.workspaceMode,
              instructions: detail.instructions ?? null,
              description: detail.scenario ?? null,
              windowStartUtc: detail.windowStartUtc ?? null,
              windowEndUtc: detail.windowEndUtc ?? null,
            });
            return;
          }
        } catch {
          // Fallback to assignments list query
        }

        const items = await fetchCandidateAssignments();
        const found = items.find((item: any) => item.id === assessmentId || item.workspaceId === assessmentId || item.assessmentId === assessmentId);
        if (!isCancelled && found) {
          setData(found);
          return;
        }

        if (!isCancelled) {
          setError('Assessment not found');
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load assessment card');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void fetchCardData();
    return () => {
      isCancelled = true;
    };
  }, [initialAssessment, assessmentId]);

  // Loading skeleton when fetching via assessmentId
  if (isLoading) {
    return (
      <div className={`rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-5 sm:p-6 animate-pulse space-y-4 ${className}`}>
        <div className="flex justify-between items-center pb-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="space-y-2">
            <div className="h-5 w-48 bg-neutral-200 dark:bg-neutral-800 rounded" />
            <div className="h-3 w-64 bg-neutral-100 dark:bg-neutral-800/60 rounded" />
          </div>
          <div className="h-9 w-32 bg-neutral-200 dark:bg-neutral-800 rounded-md" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="h-14 bg-neutral-50 dark:bg-neutral-800/40 rounded-lg" />
          <div className="h-14 bg-neutral-50 dark:bg-neutral-800/40 rounded-lg" />
          <div className="h-14 bg-neutral-50 dark:bg-neutral-800/40 rounded-lg" />
        </div>
      </div>
    );
  }

  // Error state if assessment could not be fetched
  if (error || !data) {
    return (
      <div className={`rounded-xl bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 p-4 text-xs text-red-700 dark:text-red-400 flex items-center gap-2.5 ${className}`}>
        <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
        <span>{error || 'Assessment details unavailable'}</span>
      </div>
    );
  }

  const {
    id,
    title,
    companyName,
    durationMinutes,
    status,
    windowStartUtc,
    submittedAt,
    workspaceMode = 'cloud',
  } = data;

  // Render Status Badge
  const renderStatusBadge = () => {
    switch (status) {
      case 'window_not_open':
        return (
          <Badge
            variant="info"
            size="sm"
            data-testid="status-badge-window_not_open"
            className="gap-1.5"
          >
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            Window Not Open
          </Badge>
        );
      case 'ready':
        return (
          <Badge
            variant="success"
            size="sm"
            data-testid="status-badge-ready"
            className="gap-1.5"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
            Ready to Start
          </Badge>
        );
      case 'in_progress':
        return (
          <Badge
            variant="warning"
            size="sm"
            data-testid="status-badge-in_progress"
            className="gap-1.5"
          >
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" aria-hidden="true" />
            In Progress
          </Badge>
        );
      case 'submitted':
        return (
          <Badge
            variant="default"
            size="sm"
            data-testid="status-badge-submitted"
            className="gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
            Submitted {submittedAt ? `• ${formatSubmittedDate(submittedAt)}` : ''}
          </Badge>
        );
      case 'expired':
      default:
        return (
          <Badge
            variant="default"
            size="sm"
            data-testid="status-badge-expired"
            className="gap-1.5"
          >
            <AlertCircle className="w-3.5 h-3.5 text-neutral-500" aria-hidden="true" />
            Window Closed
          </Badge>
        );
    }
  };

  // Render Action Button: clean horizontal row with exactly one icon
  const renderActionButton = () => {
    switch (status) {
      case 'window_not_open':
        return (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={true}
            title="Start will become available when the opening window begins"
            data-testid="btn-start-disabled"
            leftIcon={<Lock className="w-4 h-4 text-neutral-400 shrink-0" aria-hidden="true" />}
            className="whitespace-nowrap cursor-not-allowed select-none"
          >
            Start Assessment
          </Button>
        );

      case 'ready':
        return (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => onStartAssessment?.(data)}
            data-testid="btn-start-assessment"
            leftIcon={<Play className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true" />}
            className="whitespace-nowrap shadow-xs hover:shadow transition-all"
          >
            Start Assessment
          </Button>
        );

      case 'in_progress':
        return (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => onResumeAssessment?.(data)}
            data-testid="btn-resume-assessment"
            leftIcon={<RotateCcw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
            className="whitespace-nowrap shadow-xs hover:shadow transition-all bg-amber-600 hover:bg-amber-700 text-white"
          >
            Resume Assessment
          </Button>
        );

      case 'submitted':
        return (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowReceiptDialog(true)}
            data-testid="btn-view-receipt"
            leftIcon={<FileText className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />}
            className="whitespace-nowrap transition-colors"
          >
            View Submission
          </Button>
        );

      case 'expired':
      default:
        return null;
    }
  };

  return (
    <>
      <Card
        className={`rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-xs hover:border-neutral-300 dark:hover:border-neutral-700 transition-all p-5 sm:p-6 ${className}`}
        data-testid={`assessment-card-${id}`}
      >
        <div className="flex flex-col gap-4">
          {/* Top Section: Title, Company, Status, and Action Button */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-neutral-100 dark:border-neutral-800">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-base sm:text-lg font-semibold text-neutral-900 dark:text-neutral-100 truncate" data-testid="assessment-title">
                  {title}
                </h2>
                {renderStatusBadge()}
              </div>

              {/* Company Name & Metadata Row */}
              <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400 flex-wrap">
                {companyName ? (
                  <>
                    <span className="flex items-center gap-1.5" data-testid="company-name">
                      <Building2 className="w-3.5 h-3.5 text-neutral-400 shrink-0" aria-hidden="true" />
                      <span className="font-medium text-neutral-700 dark:text-neutral-300">{companyName}</span>
                    </span>
                    <span className="text-neutral-300 dark:text-neutral-700 select-none">&bull;</span>
                  </>
                ) : null}
                <span className="flex items-center gap-1.5" data-testid="assessment-duration">
                  <Clock className="w-3.5 h-3.5 text-neutral-400 shrink-0" aria-hidden="true" />
                  <span>{durationMinutes} Minutes Duration</span>
                </span>
                <span className="text-neutral-300 dark:text-neutral-700 select-none">&bull;</span>
                <span className="capitalize text-neutral-600 dark:text-neutral-400">
                  {workspaceMode} Workspace
                </span>
              </div>
            </div>

            {/* Action button aligned horizontally on the right */}
            <div className="shrink-0 self-start sm:self-auto">{renderActionButton()}</div>
          </div>

          {/* Conditional Middle Section: Live Window Countdown if window is not yet open */}
          {status === 'window_not_open' && windowStartUtc && (
            <div>
              <WindowCountdown
                targetDateUtc={windowStartUtc}
                onZero={() => onCountdownZero?.(data)}
              />
            </div>
          )}

          {/* Bottom Telemetry Strip: 3 clean columns */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/70 dark:border-neutral-800">
              <div className="flex items-center gap-2 text-neutral-400 dark:text-neutral-500 mb-0.5">
                <Terminal className="w-3.5 h-3.5" />
                <span className="font-medium text-[11px]">Environment</span>
              </div>
              <span className="text-neutral-800 dark:text-neutral-200 font-semibold text-xs block">
                {workspaceMode === 'cloud' ? 'Cloud VM (Browser IDE)' : 'Guided AI Chat'}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/70 dark:border-neutral-800">
              <div className="flex items-center gap-2 text-neutral-400 dark:text-neutral-500 mb-0.5">
                <Clock className="w-3.5 h-3.5" />
                <span className="font-medium text-[11px]">Time Allowance</span>
              </div>
              <span className="text-neutral-800 dark:text-neutral-200 font-semibold text-xs block">
                {durationMinutes} minutes once started
              </span>
            </div>

            <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/70 dark:border-neutral-800">
              <div className="flex items-center gap-2 text-neutral-400 dark:text-neutral-500 mb-0.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="font-medium text-[11px]">Integrity Policy</span>
              </div>
              <span className="text-neutral-800 dark:text-neutral-200 font-semibold text-xs block">
                Continuous Autosave (RPO ≤ 30s)
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Submission Receipt Dialog */}
      <Dialog open={showReceiptDialog} onClose={() => setShowReceiptDialog(false)}>
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle>Submission Receipt</DialogTitle>
              <DialogDescription>Official confirmation of submitted assessment</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogContent>
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/80 space-y-3">
              <div className="flex justify-between items-center text-xs pb-2 border-b border-neutral-200/60 dark:border-neutral-700/60">
                <span className="text-neutral-500 dark:text-neutral-400">Assessment</span>
                <span className="font-semibold text-neutral-900 dark:text-neutral-100">{title}</span>
              </div>
              <div className="flex justify-between items-center text-xs pb-2 border-b border-neutral-200/60 dark:border-neutral-700/60">
                <span className="text-neutral-500 dark:text-neutral-400">Hiring Organization</span>
                <span className="font-semibold text-neutral-900 dark:text-neutral-100">{companyName}</span>
              </div>
              <div className="flex justify-between items-center text-xs pb-2 border-b border-neutral-200/60 dark:border-neutral-700/60">
                <span className="text-neutral-500 dark:text-neutral-400">Status</span>
                <span className="font-semibold text-primary">Submitted</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-neutral-500 dark:text-neutral-400">Timestamp</span>
                <span className="font-mono text-neutral-900 dark:text-neutral-100">
                  {submittedAt ? formatSubmittedDate(submittedAt) : 'Recorded'}
                </span>
              </div>
            </div>

            <p className="text-xs text-neutral-500 leading-relaxed">
              Your work has been saved and handed over for evaluation. The hiring team will review your scored results.
            </p>
          </div>
        </DialogContent>

        <DialogFooter>
          <Button type="button" variant="primary" onClick={() => setShowReceiptDialog(false)}>
            Close
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
