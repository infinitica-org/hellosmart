'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@hs/ui';
import { SafeMarkdown } from '@hs/ui';
import {
  Building2,
  Clock,
  GitBranch,
  FileText,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Save,
  Send,
  Loader2,
  Lock,
  ArrowRight,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { ActiveTimerBar } from '@/components/candidate/active-timer-bar';
import { DeliverablesUploader } from '@/components/candidate/deliverables-uploader';
import { SubmissionConfirmationDialog } from '@/components/candidate/submission-confirmation-dialog';
import { useAssessmentTiming } from '@/hooks/candidate/use-assessment-timing';
import { useAssessmentDraft } from '@/hooks/candidate/use-assessment-draft';
import { useCandidateAssessments } from '@/hooks/candidate/use-candidate-assessments';
import { useWorkspaceFullscreen } from '@/hooks/candidate/use-workspace-fullscreen';
import { ROUTES } from '@/constants/routes';
import type { SubmitAssessmentResponse } from '@hs/contracts';

const DEFAULT_INSTRUCTIONS = `# Senior Full Stack Engineer Assessment

## Scenario & Goal
You are building an AI-orchestrated analytics pipeline with automated evaluation agents. The core application requires a high-throughput backend service, strict multi-tenant data isolation, and resilient background job execution.

## Technical Requirements
- **RESTful API**: Build and expose secure REST endpoints with validated payloads.
- **Data Isolation**: Scope all database queries, cache entries, and stored files by \`org_id\`.
- **Error Handling**: Follow RFC 9457 Problem Details for all error payloads.
- **Autosave & Reliability**: Handle transient network disconnection without data corruption.

## Expected Deliverables
1. Complete source code hosted in a GitHub repository on the specified branch.
2. Optional packaged solution archive (\`.zip\` or \`.tar.gz\`).
3. Comprehensive architecture notes explaining your design decisions, security model, and trade-offs.`;

export default function CandidateWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const assessmentId = (params?.id as string) || 'asm-ready-001';

  // Candidate Assessment Data
  const { data: assessments } = useCandidateAssessments();
  const assessment = assessments?.find((a) => a.id === assessmentId) ?? {
    id: assessmentId,
    title: 'Senior Full Stack Engineer Assessment',
    companyName: 'Aster Ridge Technologies',
    durationMinutes: 90,
    status: 'in_progress' as const,
  };

  // Authoritative Timing Engine (Stream 3 integration)
  const timing = useAssessmentTiming(assessmentId);

  // 30-Second Draft Autosave Engine (Stream 0 & BR-11 integration)
  const draftEngine = useAssessmentDraft(assessmentId);

  // Full-Screen Focus Mode & Integrity Management
  const fullscreen = useWorkspaceFullscreen();

  // Submission State
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [notesTab, setNotesTab] = useState<'edit' | 'preview'>('edit');
  const [submissionReceipt, setSubmissionReceipt] = useState<SubmitAssessmentResponse | null>(null);

  const hasRepo = Boolean(draftEngine.draft.repositoryUrl && draftEngine.draft.repositoryUrl.trim().length > 0);
  const hasBranch = Boolean(draftEngine.draft.branchName && draftEngine.draft.branchName.trim().length > 0);
  const hasNotes = Boolean(draftEngine.draft.architectureNotes && draftEngine.draft.architectureNotes.trim().length >= 10);
  const completedCount = [hasRepo, hasBranch, hasNotes].filter(Boolean).length;

  // Auto-submit or lock when timer expires
  useEffect(() => {
    if (timing.isExpired && !submissionReceipt && !isSubmitting) {
      // Autosave current work when timer runs out
      void draftEngine.flushDraft();
    }
  }, [timing.isExpired, submissionReceipt, isSubmitting, draftEngine]);

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    try {
      // 1. Flush any pending draft edits first (BR-11 requirement)
      await draftEngine.flushDraft();

      // 2. Submit assessment
      const res = await fetch('/api/candidate/assessment/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          assessmentId,
          repositoryUrl: draftEngine.draft.repositoryUrl || '',
          branchName: draftEngine.draft.branchName || 'main',
          uploadedArtifactId: draftEngine.draft.uploadedArtifact?.id || null,
          architectureNotes: draftEngine.draft.architectureNotes || '',
          confirmChecklist: true,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.message || `Submission failed (${res.status})`);
      }

      const receipt: SubmitAssessmentResponse = await res.json();
      setSubmissionReceipt(receipt);
      setShowConfirmDialog(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Submission failed';
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // If already successfully submitted, render locked submission receipt
  if (submissionReceipt) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-8 shadow-xs text-center space-y-6">
          <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              Assessment Successfully Submitted
            </h1>
            <p className="text-xs text-neutral-500 max-w-md mx-auto">
              Your deliverables have been recorded and handed over for automated agent review and hiring team evaluation.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/80 text-left text-xs space-y-3 max-w-md mx-auto">
            <div className="flex justify-between pb-2 border-b border-neutral-200 dark:border-neutral-700">
              <span className="text-neutral-500">Receipt ID</span>
              <span className="font-mono font-semibold text-neutral-900 dark:text-neutral-100">
                {submissionReceipt.receiptId}
              </span>
            </div>
            <div className="flex justify-between pb-2 border-b border-neutral-200 dark:border-neutral-700">
              <span className="text-neutral-500">Submission ID</span>
              <span className="font-mono text-neutral-700 dark:text-neutral-300">
                {submissionReceipt.submissionId}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Recorded At</span>
              <span className="font-mono text-neutral-700 dark:text-neutral-300">
                {new Date(submissionReceipt.submittedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="button"
              variant="primary"
              size="md"
              className="!rounded-lg px-6 py-2.5"
              onClick={() => router.push(ROUTES.CANDIDATE.DASHBOARD)}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Return to Candidate Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col gap-3 overflow-hidden">
      {/* Top Workspace Control Bar */}
      <header className="shrink-0 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-5 py-3 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
              {assessment.title}
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-50 dark:bg-orange-950/40 text-primary border border-orange-200/80 dark:border-orange-800/80">
              Take-Home Workspace
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-neutral-500 flex-wrap">
            <span className="flex items-center gap-1.5 font-medium text-neutral-700 dark:text-neutral-300">
              <Building2 className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              {assessment.companyName}
            </span>
            <span className="text-neutral-300 select-none">&bull;</span>
            <span className="flex items-center gap-1.5 font-medium text-neutral-600 dark:text-neutral-400">
              <Clock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              {assessment.durationMinutes} Minutes Allowance
            </span>
            <span className="text-neutral-300 select-none hidden sm:inline">&bull;</span>
            {/* Live Autosave Indicator */}
            <div className="flex items-center gap-1.5" data-testid="autosave-indicator">
              {draftEngine.status === 'saving' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-orange-50 dark:bg-orange-950/40 text-primary border border-orange-200/80">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Saving draft...
                </span>
              ) : draftEngine.status === 'saved' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  All changes saved to cloud
                </span>
              ) : draftEngine.status === 'dirty' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Unsaved changes
                </span>
              ) : draftEngine.status === 'error' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-50 text-red-600 border border-red-200">
                  <AlertCircle className="w-3 h-3" />
                  Save failed (retrying)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-neutral-100 text-neutral-600 border border-neutral-200">
                  <Save className="w-3 h-3" />
                  Continuous autosave active
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls, Fullscreen Toggle & Countdown */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
          <ActiveTimerBar
            formattedTime={timing.formattedTime}
            isWarning={timing.isWarning}
            isExpired={timing.isExpired}
            remainingMs={timing.remainingMs}
          />

          {fullscreen.isSupported && !fullscreen.isFullscreen && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="!rounded-xl px-3.5 py-1.5 text-xs font-semibold border-orange-300 dark:border-orange-800 bg-orange-50/70 dark:bg-orange-950/40 text-primary hover:bg-orange-100 whitespace-nowrap cursor-pointer shadow-2xs animate-pulse"
              onClick={fullscreen.enterFullscreen}
              data-testid="toggle-fullscreen-button"
              leftIcon={<Maximize2 className="w-3.5 h-3.5 text-primary" />}
            >
              Enter Full Screen
            </Button>
          )}
        </div>
      </header>

      {/* Full-Screen Exit Warning & Re-entry Advisory */}
      {fullscreen.hasExitedFullscreen && (
        <div
          data-testid="fullscreen-exit-warning"
          className="shrink-0 p-3 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
        >
          

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="!rounded-lg px-2.5 py-1 text-xs border-amber-300 dark:border-amber-700 bg-white dark:bg-neutral-900 text-amber-900 dark:text-amber-100 hover:bg-amber-100/50"
              onClick={fullscreen.dismissExitWarning}
            >
              Dismiss
            </Button>

            <Button
              type="button"
              variant="primary"
              size="sm"
              className="!rounded-lg px-3 py-1 text-xs font-semibold"
              onClick={fullscreen.enterFullscreen}
              leftIcon={<Maximize2 className="w-3.5 h-3.5" />}
            >
              Re-enter Full Screen
            </Button>
          </div>
        </div>
      )}

      {/* Main Split-Panel Workspace: Two Unified, Cohesive Panes (No Empty Gaps) */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3.5 lg:gap-4 overflow-hidden">
        {/* Left Panel: Task Instructions & Checklist Pane (5 Cols) */}
        <div className="lg:col-span-5 h-full min-h-0 rounded-2xl border border-neutral-200/90 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs flex flex-col overflow-hidden">
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/20">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Task Instructions &amp; Brief
            </h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
              Markdown v1.0
            </span>
          </div>

          {/* Scrollable Brief Content */}
          <div className="flex-1 min-h-0 overflow-y-auto p-5 text-xs space-y-4">
            <SafeMarkdown content={DEFAULT_INSTRUCTIONS} />
          </div>

          {/* Integrated Deliverables Checklist docked at bottom of left pane */}
          <div className="shrink-0 p-4 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-800/20 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                  Deliverables Checklist
                </h3>
                <p className="text-[11px] text-neutral-400">
                  Track completion before final submission
                </p>
              </div>
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                  completedCount === 3
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                    : 'bg-neutral-200/70 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
                }`}
              >
                {completedCount} of 3 Ready
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-1.5 bg-neutral-200/70 dark:bg-neutral-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                style={{ width: `${(completedCount / 3) * 100}%` }}
              />
            </div>

            <ul className="text-xs space-y-2 pt-0.5">
              <li className="flex items-center gap-2">
                {hasRepo ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <span className="w-4 h-4 rounded-full border border-neutral-300 dark:border-neutral-600 shrink-0" />
                )}
                <span className={hasRepo ? 'text-neutral-800 dark:text-neutral-200 font-medium' : 'text-neutral-500'}>
                  GitHub repository URL configured
                </span>
              </li>
              <li className="flex items-center gap-2">
                {hasBranch ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <span className="w-4 h-4 rounded-full border border-neutral-300 dark:border-neutral-600 shrink-0" />
                )}
                <span className={hasBranch ? 'text-neutral-800 dark:text-neutral-200 font-medium' : 'text-neutral-500'}>
                  Active solution branch selected
                </span>
              </li>
              <li className="flex items-center gap-2">
                {hasNotes ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <span className="w-4 h-4 rounded-full border border-neutral-300 dark:border-neutral-600 shrink-0" />
                )}
                <span className={hasNotes ? 'text-neutral-800 dark:text-neutral-200 font-medium' : 'text-neutral-500'}>
                  Architecture &amp; design notes ({draftEngine.draft.architectureNotes.trim().length}/10 chars)
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Right Panel: Solution Submission Workspace (7 Cols) */}
        <div className="lg:col-span-7 h-full min-h-0 rounded-2xl border border-neutral-200/90 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs flex flex-col overflow-hidden">
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/20">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-primary" />
              Candidate Solution Workspace
            </h2>
            <span className="text-[11px] text-neutral-400 font-mono">Stream 4 Storage</span>
          </div>

          {/* Scrollable Form Body */}
          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
            {/* Section 1: GitHub Repository & Branch */}
            <div className="space-y-3 pb-5 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                    GitHub Repository &amp; Branch
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Repository containing your solution implementation and commit history
                  </p>
                </div>
                <span className="text-[10px] uppercase font-semibold text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded">
                  Required
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-0.5">
                <div className="sm:col-span-2 space-y-1">
                  <label
                    htmlFor="repo-url-input"
                    className="block text-xs font-medium text-neutral-700 dark:text-neutral-300"
                  >
                    Repository URL <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="repo-url-input"
                      type="url"
                      placeholder="https://github.com/organization/project"
                      value={draftEngine.draft.repositoryUrl || ''}
                      onChange={(e) => draftEngine.updateDraft({ repositoryUrl: e.target.value })}
                      className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/80 text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono"
                      data-testid="repo-url-input"
                    />
                    <GitBranch className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="branch-input"
                    className="block text-xs font-medium text-neutral-700 dark:text-neutral-300"
                  >
                    Branch <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="branch-input"
                      type="text"
                      placeholder="main"
                      value={draftEngine.draft.branchName || ''}
                      onChange={(e) => draftEngine.updateDraft({ branchName: e.target.value })}
                      className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/80 text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono"
                      data-testid="branch-input"
                    />
                    <GitBranch className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Solution Archive (ZIP / TAR) */}
            <div className="space-y-3 pb-5 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                    Solution Archive (ZIP / TAR)
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Optional packaged codebase archive up to 50 MB
                  </p>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono text-neutral-400 bg-neutral-100 dark:bg-neutral-800">
                  Stream 4 Storage
                </span>
              </div>

              <DeliverablesUploader
                artifact={draftEngine.draft.uploadedArtifact || null}
                onArtifactChange={draftEngine.setUploadedArtifact}
                onUploadStateChange={setIsUploading}
              />
            </div>

            {/* Section 3: Architecture & Design Notes */}
            <div className="space-y-3 flex-1 flex flex-col">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                    Architecture &amp; Design Notes <span className="text-red-500">*</span>
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Explain your design choices, trade-offs, and security considerations
                  </p>
                </div>

                {/* Edit / Preview Tabs */}
                <div className="inline-flex p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-xs shrink-0">
                  <button
                    type="button"
                    onClick={() => setNotesTab('edit')}
                    className={`px-3 py-1 rounded-md font-medium transition-all cursor-pointer ${
                      notesTab === 'edit'
                        ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-xs'
                        : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
                    }`}
                  >
                    Write Markdown
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotesTab('preview')}
                    className={`px-3 py-1 rounded-md font-medium transition-all cursor-pointer ${
                      notesTab === 'preview'
                        ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-xs'
                        : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
                    }`}
                  >
                    Preview
                  </button>
                </div>
              </div>

              {notesTab === 'edit' ? (
                <div className="space-y-1.5 flex-1 flex flex-col">
                  <textarea
                    rows={8}
                    placeholder="Describe your design choices, architecture decisions, trade-offs, and how to execute the solution..."
                    value={draftEngine.draft.architectureNotes}
                    onChange={(e) => draftEngine.updateDraft({ architectureNotes: e.target.value })}
                    className="w-full p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/80 text-xs font-mono text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-y leading-relaxed flex-1 min-h-[180px]"
                    data-testid="architecture-notes-textarea"
                  />
                  <div className="flex justify-between items-center text-[11px] text-neutral-400 px-1">
                    <span>Markdown supported: headings, lists, code, bold</span>
                    <span className={hasNotes ? 'text-emerald-600 font-medium' : 'text-neutral-400'}>
                      {draftEngine.draft.architectureNotes.trim().length} chars (min 10)
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/40 min-h-[180px] text-xs">
                  {draftEngine.draft.architectureNotes?.trim() ? (
                    <SafeMarkdown content={draftEngine.draft.architectureNotes} />
                  ) : (
                    <p className="text-neutral-400 italic">No notes provided yet. Switch to Write Markdown mode to begin.</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Integrated Footer Action Bar docked at bottom of right pane */}
          <div className="shrink-0 px-5 py-3 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/20 flex items-center justify-between">
            <span className="text-xs text-neutral-500">
              {draftEngine.lastSavedAt
                ? `Last saved at ${new Date(draftEngine.lastSavedAt).toLocaleTimeString()}`
                : '30-second continuous autosave active (BR-11)'}
            </span>

            <Button
              type="button"
              variant="primary"
              size="md"
              className="!rounded-xl px-5 py-2 font-semibold shadow-xs"
              onClick={() => setShowConfirmDialog(true)}
              disabled={timing.isExpired || isUploading}
              data-testid="submit-assessment-bottom-btn"
              rightIcon={<Send className="w-3.5 h-3.5" />}
            >
              Submit Assessment
            </Button>
          </div>
        </div>
      </div>

      {/* Submission Confirmation Modal */}
      <SubmissionConfirmationDialog
        open={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        draft={draftEngine.draft}
        onConfirm={handleFinalSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
