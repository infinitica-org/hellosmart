'use client';

import React, { useState } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter, Button } from '@hs/ui';
import { Building2, Clock, CheckCircle2, AlertCircle, Play, RotateCcw, FileText, Lock, Terminal, ShieldCheck } from 'lucide-react';
import { WindowCountdown } from './window-countdown';

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
}

export interface AssessmentCardProps {
  assessment: CandidateAssessment;
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
  assessment,
  onStartAssessment,
  onResumeAssessment,
  onCountdownZero,
  className = '',
}: AssessmentCardProps): React.JSX.Element {
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);

  const {
    id,
    title,
    companyName,
    durationMinutes,
    status,
    windowStartUtc,
    submittedAt,
    workspaceMode = 'cloud',
  } = assessment;

  // Render Status Badge
  const renderStatusBadge = () => {
    switch (status) {
      case 'window_not_open':
        return (
          <span
            data-testid="status-badge-window_not_open"
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200/80 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800/80"
          >
            <Clock className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
            Window Not Open
          </span>
        );
      case 'ready':
        return (
          <span
            data-testid="status-badge-ready"
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/80"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
            Ready to Start
          </span>
        );
      case 'in_progress':
        return (
          <span
            data-testid="status-badge-in_progress"
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/80"
          >
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" aria-hidden="true" />
            In Progress
          </span>
        );
      case 'submitted':
        return (
          <span
            data-testid="status-badge-submitted"
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200/80 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800/80"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" aria-hidden="true" />
            Submitted {submittedAt ? `• ${formatSubmittedDate(submittedAt)}` : ''}
          </span>
        );
      case 'expired':
      default:
        return (
          <span
            data-testid="status-badge-expired"
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600 border border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700"
          >
            <AlertCircle className="w-3.5 h-3.5 text-neutral-500" aria-hidden="true" />
            Window Closed
          </span>
        );
    }
  };

  // Render Action Button: clean horizontal row with exactly one icon
  const renderActionButton = () => {
    switch (status) {
      case 'window_not_open':
        return (
          <button
            type="button"
            disabled={true}
            aria-disabled="true"
            title="Start will become available when the opening window begins"
            data-testid="btn-start-disabled"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 border border-neutral-200 dark:border-neutral-700 cursor-not-allowed whitespace-nowrap select-none"
          >
            <Lock className="w-4 h-4 text-neutral-400 shrink-0" aria-hidden="true" />
            <span>Start Assessment</span>
          </button>
        );

      case 'ready':
        return (
          <button
            type="button"
            onClick={() => onStartAssessment?.(assessment)}
            data-testid="btn-start-assessment"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white bg-primary hover:bg-primary-hover shadow-xs hover:shadow active:scale-[0.99] transition-all whitespace-nowrap cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true" />
            <span>Start Assessment</span>
          </button>
        );

      case 'in_progress':
        return (
          <button
            type="button"
            onClick={() => onResumeAssessment?.(assessment)}
            data-testid="btn-resume-assessment"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 shadow-xs hover:shadow active:scale-[0.99] transition-all whitespace-nowrap cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Resume Assessment</span>
          </button>
        );

      case 'submitted':
        return (
          <button
            type="button"
            onClick={() => setShowReceiptDialog(true)}
            data-testid="btn-view-receipt"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/40 border border-purple-200 dark:border-purple-800 transition-colors whitespace-nowrap cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" aria-hidden="true" />
            <span>View Submission </span>
          </button>
        );

      case 'expired':
      default:
        return null;
    }
  };

  return (
    <>
      <div
        className={`rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs hover:border-neutral-300 dark:hover:border-neutral-700 transition-all p-5 sm:p-6 ${className}`}
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
                <span className="flex items-center gap-1.5" data-testid="company-name">
                  <Building2 className="w-3.5 h-3.5 text-neutral-400 shrink-0" aria-hidden="true" />
                  <span className="font-medium text-neutral-700 dark:text-neutral-300">{companyName}</span>
                </span>
                <span className="text-neutral-300 dark:text-neutral-700 select-none">&bull;</span>
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
                onZero={() => onCountdownZero?.(assessment)}
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
      </div>

      {/* Submission Receipt Dialog */}
      <Dialog open={showReceiptDialog} onClose={() => setShowReceiptDialog(false)}>
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-950 flex items-center justify-center text-purple-700 dark:text-purple-300">
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
                <span className="font-semibold text-purple-700 dark:text-purple-400">Submitted</span>
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
