'use client';

import React, { useState } from 'react';
import { Card, Button, Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from '@hs/ui';
import { Building2, Clock, CheckCircle2, AlertCircle, Calendar, ArrowRight, Play, RotateCcw, FileText, Lock } from 'lucide-react';
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
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-cyan-50 text-cyan-800 border border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800/80"
          >
            <Clock className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" aria-hidden="true" />
            Window Not Open
          </span>
        );
      case 'ready':
        return (
          <span
            data-testid="status-badge-ready"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/80"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
            Ready to Start
          </span>
        );
      case 'in_progress':
        return (
          <span
            data-testid="status-badge-in_progress"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/80"
          >
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" aria-hidden="true" />
            In Progress
          </span>
        );
      case 'submitted':
        return (
          <span
            data-testid="status-badge-submitted"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-800 border border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800/80"
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
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600 border border-neutral-300 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700"
          >
            <AlertCircle className="w-3.5 h-3.5 text-neutral-500" aria-hidden="true" />
            Window Closed
          </span>
        );
    }
  };

  // Render Action Button
  const renderActionButton = () => {
    switch (status) {
      case 'window_not_open':
        return (
          <Button
            type="button"
            variant="secondary"
            disabled={true}
            aria-disabled="true"
            title="Start will become available when the opening window begins"
            data-testid="btn-start-disabled"
            className="w-full sm:w-auto opacity-50 cursor-not-allowed font-medium"
          >
            <Lock className="w-4 h-4 mr-1.5 text-neutral-400" aria-hidden="true" />
            Start Assessment
          </Button>
        );

      case 'ready':
        return (
          <Button
            type="button"
            variant="primary"
            onClick={() => onStartAssessment?.(assessment)}
            data-testid="btn-start-assessment"
            className="w-full sm:w-auto bg-primary hover:bg-primary-hover text-white font-medium shadow-xs"
          >
            <Play className="w-4 h-4 mr-1.5" aria-hidden="true" />
            Start Assessment
            <ArrowRight className="w-4 h-4 ml-1.5" aria-hidden="true" />
          </Button>
        );

      case 'in_progress':
        return (
          <Button
            type="button"
            variant="primary"
            onClick={() => onResumeAssessment?.(assessment)}
            data-testid="btn-resume-assessment"
            className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-xs"
          >
            <RotateCcw className="w-4 h-4 mr-1.5" aria-hidden="true" />
            Resume Assessment
            <ArrowRight className="w-4 h-4 ml-1.5" aria-hidden="true" />
          </Button>
        );

      case 'submitted':
        return (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowReceiptDialog(true)}
            data-testid="btn-view-receipt"
            className="w-full sm:w-auto font-medium"
          >
            <FileText className="w-4 h-4 mr-1.5 text-purple-600 dark:text-purple-400" aria-hidden="true" />
            View Receipt
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
        className={`p-6 sm:p-7 border border-neutral-200/90 dark:border-neutral-800 shadow-xs hover:border-neutral-300 dark:hover:border-neutral-700 transition-all ${className}`}
        data-testid={`assessment-card-${id}`}
      >
        <div className="flex flex-col gap-5">
          {/* Top Section: Title, Company, Status, and Action Button */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-neutral-100 dark:border-neutral-800/80">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 truncate" data-testid="assessment-title">
                  {title}
                </h2>
                {renderStatusBadge()}
              </div>

              {/* Company Name & Metadata */}
              <div className="flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400 flex-wrap">
                <span className="flex items-center gap-1.5" data-testid="company-name">
                  <Building2 className="w-3.5 h-3.5 text-neutral-400" aria-hidden="true" />
                  <span className="font-medium text-neutral-700 dark:text-neutral-300">{companyName}</span>
                </span>
                <span>&bull;</span>
                <span className="flex items-center gap-1.5" data-testid="assessment-duration">
                  <Clock className="w-3.5 h-3.5 text-neutral-400" aria-hidden="true" />
                  <span>{durationMinutes} Minutes Duration</span>
                </span>
                <span>&bull;</span>
                <span className="capitalize text-neutral-600 dark:text-neutral-400">
                  {workspaceMode} Workspace
                </span>
              </div>
            </div>

            {/* Action button aligned top right */}
            <div className="shrink-0">{renderActionButton()}</div>
          </div>

          {/* Conditional Middle Section: Live Window Countdown if window is not yet open */}
          {status === 'window_not_open' && windowStartUtc && (
            <div className="pt-1">
              <WindowCountdown
                targetDateUtc={windowStartUtc}
                onZero={() => onCountdownZero?.(assessment)}
              />
            </div>
          )}

          {/* Bottom Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
            <div className="p-3.5 rounded-lg bg-neutral-50/80 dark:bg-neutral-800/40 border border-neutral-200/70 dark:border-neutral-800">
              <span className="text-neutral-500 dark:text-neutral-400 block mb-0.5 font-normal">Environment</span>
              <span className="text-neutral-800 dark:text-neutral-200 font-semibold uppercase tracking-wider text-[11px]">
                {workspaceMode === 'cloud' ? 'Cloud VM (Browser IDE)' : 'Guided AI Chat'}
              </span>
            </div>

            <div className="p-3.5 rounded-lg bg-neutral-50/80 dark:bg-neutral-800/40 border border-neutral-200/70 dark:border-neutral-800">
              <span className="text-neutral-500 dark:text-neutral-400 block mb-0.5 font-normal">Time Allowance</span>
              <span className="text-neutral-800 dark:text-neutral-200 font-semibold text-[11px]">
                {durationMinutes} minutes once started
              </span>
            </div>

            <div className="p-3.5 rounded-lg bg-neutral-50/80 dark:bg-neutral-800/40 border border-neutral-200/70 dark:border-neutral-800">
              <span className="text-neutral-500 dark:text-neutral-400 block mb-0.5 font-normal">Integrity Policy</span>
              <span className="text-neutral-800 dark:text-neutral-200 font-semibold text-[11px]">
                Continuous Autosave (RPO ≤ 30s)
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Submission Receipt Dialog (Requirement #5: No invented verification codes, show real submission metadata) */}
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

