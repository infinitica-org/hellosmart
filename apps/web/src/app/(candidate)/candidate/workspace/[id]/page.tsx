'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button, Card, CountdownTimer, BrandMark } from '@hs/ui';
import { SafeMarkdown } from '@hs/ui';
import {
  Building2,
  Clock,
  GitBranch,
  FileText,
  CheckCircle2,
  AlertCircle,
  Save,
  Send,
  Loader2,
  ArrowRight,
  Maximize2,
  FolderTree,
  Terminal as TerminalIcon,
  Bot,
  Sparkles,
  Moon,
  Sun,
} from 'lucide-react';
import { DeliverablesUploader } from '@/components/candidate/deliverables-uploader';
import { SubmissionConfirmationDialog } from '@/components/candidate/submission-confirmation-dialog';
import { useAssessmentTiming } from '@/hooks/candidate/use-assessment-timing';
import { useAssessmentDraft } from '@/hooks/candidate/use-assessment-draft';
import { useWorkspaceFullscreen } from '@/hooks/candidate/use-workspace-fullscreen';
import { useWorkspaceFiles, type WorkspaceFile } from '@/hooks/workspace/use-workspace-files';
import { useActivityHeartbeat } from '@/hooks/workspace/use-activity-heartbeat';
import { FileTree } from '@/components/workspace/editor/file-tree';
import { EditorTabs } from '@/components/workspace/editor/editor-tabs';
import { MonacoCodeEditor, type WorkspaceTheme } from '@/components/workspace/editor/monaco-code-editor';
import { XtermTerminal } from '@/components/workspace/terminal/xterm-terminal';
import { AiCopilotDrawer } from '@/components/workspace/copilot/ai-copilot-drawer';
import { ROUTES } from '@/constants/routes';
import type { SubmitAssessmentResponse } from '@hs/contracts';
import {
  fetchCandidateAssessmentDetails,
  fetchCandidateAssignments,
  submitCandidateDeliverables,
} from '@/lib/candidate-api';

export interface CandidateAssessmentDetail {
  id: string;
  title: string;
  companyName?: string;
  durationMinutes: number;
  status?: string;
  instructions?: string | null;
  brief?: string | null;
  description?: string | null;
  checklist?: string[];
  deliverables?: string[];
  workspaceMode?: 'cloud' | 'chat';
  workspaceId?: string | null;
  aiPolicy?: {
    enabled?: boolean | undefined;
    allowedModels?: string[] | undefined;
    capPerCandidate?: { unit: string; value: number } | undefined;
    rpm?: number | undefined;
  } | null | undefined;
}

export default function CandidateWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const assessmentId = (params?.id as string) || '';

  // Dynamic Assessment Data Calling
  const [assessment, setAssessment] = useState<CandidateAssessmentDetail | null>(null);
  const [isLoadingAssessment, setIsLoadingAssessment] = useState<boolean>(true);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);

  // Workspace Theme Support (Dark, Light - Clean White & Orange)
  const [theme, setTheme] = useState<WorkspaceTheme>('dark');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hs_workspace_theme') as WorkspaceTheme;
      if (saved && (saved === 'dark' || saved === 'light')) {
        setTheme(saved);
        document.documentElement.classList.toggle('dark', saved === 'dark');
      } else {
        document.documentElement.classList.toggle('dark', true);
      }
    }
  }, []);

  const handleThemeChange = (nextTheme: WorkspaceTheme) => {
    setTheme(nextTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('hs_workspace_theme', nextTheme);
      document.documentElement.classList.toggle('dark', nextTheme === 'dark');
    }
  };

  useEffect(() => {
    if (!assessmentId) {
      setIsLoadingAssessment(false);
      setAssessmentError('No assessment ID provided.');
      return;
    }

    let isCancelled = false;

    async function fetchAssessmentDetails() {
      setIsLoadingAssessment(true);
      setAssessmentError(null);

      try {
        try {
          const data = await fetchCandidateAssessmentDetails(assessmentId);
          if (!isCancelled && data && data.id) {
            setAssessment(data as unknown as CandidateAssessmentDetail);
            return;
          }
        } catch {
          // Fallback to assignments list
        }

        const items = await fetchCandidateAssignments();
        const found = items.find(
          (item) => item.id === assessmentId || item.workspaceId === assessmentId
        );
        if (!isCancelled && found) {
          setAssessment(found as unknown as CandidateAssessmentDetail);
          return;
        }

        if (!isCancelled) {
          setAssessmentError('Assessment not found or you do not have permission to view this workspace.');
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          const message = err instanceof Error ? err.message : 'Unable to connect to assessment service';
          setAssessmentError(message);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingAssessment(false);
        }
      }
    }

    void fetchAssessmentDetails();
    return () => {
      isCancelled = true;
    };
  }, [assessmentId]);

  // Authoritative Timing Engine (Stream 3 integration)
  const timing = useAssessmentTiming(assessmentId);

  // 30-Second Draft Autosave Engine (Stream 0 & BR-11 integration)
  const draftEngine = useAssessmentDraft(assessmentId);

  // Full-Screen Focus Mode & Integrity Management
  const fullscreen = useWorkspaceFullscreen();

  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Multi-File Virtual Workspace Hook (Stream 7.1)
  const wsFiles = useWorkspaceFiles({
    assessmentId,
    onDirtyChange: () => {
      // Mark assessment draft as dirty so continuous autosave persists state
      draftEngine.updateDraft({
        branchName: draftEngine.draft.branchName || 'main',
      });
    },
    onContentSync: (files: WorkspaceFile[]) => {
      // Sync file contents with assessment draft engine
      draftEngine.updateDraft({
        branchName: draftEngine.draft.branchName || 'main',
        architectureNotes: JSON.stringify(files),
      });

      // Automatically flush draft save after 1.5 seconds of no edits
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
      }
      flushTimeoutRef.current = setTimeout(() => {
        void draftEngine.flushDraft();
      }, 1500);
    },
  });

  const { markAllClean } = wsFiles;

  const handleSaveActiveFile = useCallback(() => {
    markAllClean();
    void draftEngine.flushDraft();
  }, [markAllClean, draftEngine]);

  // Global Ctrl+S (Save) & Ctrl+` (Terminal toggle) handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveActiveFile();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === '`' || e.key === '~')) {
        e.preventDefault();
        setIsTerminalOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
      }
    };
  }, [handleSaveActiveFile]);

  // When draftEngine completes saving, clear individual file dirty indicators
  useEffect(() => {
    if (draftEngine.status === 'saved') {
      markAllClean();
    }
  }, [draftEngine.status, markAllClean]);

  // UI State: Sidebar Navigation ('explorer' | 'brief' | 'submission')
  const [activeSideTab, setActiveSideTab] = useState<'explorer' | 'brief' | 'submission' | null>('explorer');

  // Resizable Explorer Sidebar State
  const DEFAULT_SIDEBAR_WIDTH = 270;
  const MIN_SIDEBAR_WIDTH = 180;
  const MAX_SIDEBAR_WIDTH = 550;

  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('hs_workspace_sidebar_width');
        if (saved) {
          const parsed = parseInt(saved, 10);
          if (parsed >= MIN_SIDEBAR_WIDTH && parsed <= MAX_SIDEBAR_WIDTH) {
            return parsed;
          }
        }
      } catch {}
    }
    return DEFAULT_SIDEBAR_WIDTH;
  });

  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(DEFAULT_SIDEBAR_WIDTH);
  const sidebarWidthRef = useRef(sidebarWidth);
  sidebarWidthRef.current = sidebarWidth;

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSidebar(true);
    resizeStartXRef.current = e.clientX;
    resizeStartWidthRef.current = sidebarWidth;
  };

  useEffect(() => {
    if (!isResizingSidebar) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStartXRef.current;
      const newWidth = Math.min(
        MAX_SIDEBAR_WIDTH,
        Math.max(MIN_SIDEBAR_WIDTH, resizeStartWidthRef.current + deltaX)
      );
      sidebarWidthRef.current = newWidth;
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      try {
        localStorage.setItem('hs_workspace_sidebar_width', sidebarWidthRef.current.toString());
      } catch {}
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingSidebar]);

  // Integrated Terminal Panel State
  const DEFAULT_TERMINAL_HEIGHT = 220;
  const MIN_TERMINAL_HEIGHT = 100;
  const MAX_TERMINAL_HEIGHT = 500;

  const [isTerminalOpen, setIsTerminalOpen] = useState(true);
  const [isTerminalMaximized, setIsTerminalMaximized] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(DEFAULT_TERMINAL_HEIGHT);
  const [isResizingTerminal, setIsResizingTerminal] = useState(false);
  const resizeStartYRef = useRef(0);
  const resizeStartHeightRef = useRef(DEFAULT_TERMINAL_HEIGHT);

  const handleTerminalResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingTerminal(true);
    resizeStartYRef.current = e.clientY;
    resizeStartHeightRef.current = terminalHeight;
  };

  useEffect(() => {
    if (!isResizingTerminal) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = resizeStartYRef.current - e.clientY;
      const newHeight = Math.min(
        MAX_TERMINAL_HEIGHT,
        Math.max(MIN_TERMINAL_HEIGHT, resizeStartHeightRef.current + deltaY)
      );
      setTerminalHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizingTerminal(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingTerminal]);

  // AI Copilot Section State (BR-13, BR-15) - Docked Section (Not a floating popup)
  const DEFAULT_COPILOT_WIDTH = 380;
  const MIN_COPILOT_WIDTH = 280;
  const MAX_COPILOT_WIDTH = 650;

  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [copilotWidth, setCopilotWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('hs_workspace_copilot_width');
        if (saved) {
          const parsed = parseInt(saved, 10);
          if (parsed >= MIN_COPILOT_WIDTH && parsed <= MAX_COPILOT_WIDTH) {
            return parsed;
          }
        }
      } catch {}
    }
    return DEFAULT_COPILOT_WIDTH;
  });

  const [isResizingCopilot, setIsResizingCopilot] = useState(false);
  const copilotStartXRef = useRef(0);
  const copilotStartWidthRef = useRef(DEFAULT_COPILOT_WIDTH);
  const copilotWidthRef = useRef(copilotWidth);
  copilotWidthRef.current = copilotWidth;

  const handleCopilotResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingCopilot(true);
    copilotStartXRef.current = e.clientX;
    copilotStartWidthRef.current = copilotWidth;
  };

  useEffect(() => {
    if (!isResizingCopilot) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Dragging divider left increases copilot width, dragging right decreases copilot width
      const deltaX = copilotStartXRef.current - e.clientX;
      const newWidth = Math.min(
        MAX_COPILOT_WIDTH,
        Math.max(MIN_COPILOT_WIDTH, copilotStartWidthRef.current + deltaX)
      );
      copilotWidthRef.current = newWidth;
      setCopilotWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingCopilot(false);
      try {
        localStorage.setItem('hs_workspace_copilot_width', copilotWidthRef.current.toString());
      } catch {}
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingCopilot]);

  const handleInsertCodeIntoEditor = useCallback(
    (codeSnippet: string) => {
      if (wsFiles.activeFile) {
        const currentContent = wsFiles.activeFile.content;
        const updatedContent = currentContent ? `${currentContent}\n\n${codeSnippet}` : codeSnippet;
        wsFiles.updateFileContent(wsFiles.activeFile.id, updatedContent);
      }
    },
    [wsFiles]
  );

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
      void draftEngine.flushDraft();
    }
  }, [timing.isExpired, submissionReceipt, isSubmitting, draftEngine]);

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    try {
      await draftEngine.flushDraft();

      const receipt = await submitCandidateDeliverables(assessmentId, {
        assessmentId,
        repositoryUrl: draftEngine.draft.repositoryUrl || '',
        branchName: draftEngine.draft.branchName || 'main',
        uploadedArtifactId: draftEngine.draft.uploadedArtifact?.id || null,
        architectureNotes: draftEngine.draft.architectureNotes || '',
        confirmChecklist: true,
      });

      setSubmissionReceipt(receipt);
      setShowConfirmDialog(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Submission failed';
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Workspace Activity Heartbeat (I174, BR-08, BR-11)
  useActivityHeartbeat({
    workspaceId: assessmentId,
    enabled: Boolean(
      assessmentId &&
      !isLoadingAssessment &&
      !assessmentError &&
      !submissionReceipt &&
      !isSubmitting &&
      !timing.isExpired &&
      assessment?.status !== 'submitted' &&
      assessment?.status !== 'expired' &&
      assessment?.status !== 'revoked'
    ),
    onSessionEnded: (status) => {
      if (status === 'expired' || status === 'SESSION_EXPIRED') {
        void handleFinalSubmit();
      }
    },
  });

  // If already successfully submitted, render locked submission receipt
  if (submissionReceipt) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <Card className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-8 shadow-xs text-center space-y-6">
          <div className="w-14 h-14 rounded-full bg-success-muted border border-success-border text-success flex items-center justify-center mx-auto">
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
        </Card>
      </div>
    );
  }

  // Loading State
  if (isLoadingAssessment) {
    return (
      <div className="h-full min-h-[400px] flex flex-col items-center justify-center p-8 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
          Loading workspace and task instructions...
        </p>
      </div>
    );
  }

  // Error State
  if (assessmentError || !assessment) {
    return (
      <div className="h-full min-h-[400px] flex flex-col items-center justify-center p-8">
        <Card className="max-w-md w-full p-6 sm:p-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-danger-muted border border-danger-border text-danger flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              Assessment Not Found
            </h2>
            <p className="text-xs text-neutral-500">
              {assessmentError || 'The requested assessment could not be loaded.'}
            </p>
          </div>
          <Button
            type="button"
            variant="primary"
            onClick={() => router.push(ROUTES.CANDIDATE.DASHBOARD)}
            className="w-full"
          >
            Return to Candidate Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  const instructionsContent =
    assessment.instructions ||
    assessment.brief ||
    assessment.description ||
    `# ${assessment.title || 'Assessment Instructions'}

## Overview
Please complete the requirements for this assessment and submit your solution deliverables using the panel on the right.

## Technical Guidelines
- Ensure all business logic, data models, and API endpoints meet the specified evaluation criteria.
- Scope all database queries, cache entries, and stored artifacts by tenant \`org_id\` where applicable.
- Handle edge cases, unexpected input, and error conditions gracefully with appropriate status codes.

## Expected Deliverables
1. Complete source code implementation in the workspace files.
2. Optional packaged solution archive (\`.zip\` or \`.tar.gz\`) up to 50 MB.
3. Architecture notes describing your approach, design decisions, and trade-offs.`;

  const isLight = theme === 'light';

  const titlebarBg = isLight
    ? 'bg-white border-b border-neutral-200 text-neutral-900 shadow-2xs'
    : 'bg-neutral-950 border-b border-neutral-800 text-neutral-200';

  const activityBarBg = isLight
    ? 'bg-white border-r border-neutral-200 text-neutral-600'
    : 'bg-neutral-950 border-r border-neutral-800 text-neutral-400';

  const sidebarBg = isLight
    ? 'border-r border-neutral-200 bg-white'
    : 'border-r border-neutral-800 bg-neutral-900';

  const editorAreaBg = isLight
    ? 'bg-white'
    : 'bg-neutral-900';

  const statusBarBg = isLight
    ? 'bg-white border-t border-neutral-200 text-neutral-600 font-mono'
    : 'bg-neutral-950 border-t border-neutral-800 text-neutral-400 font-mono';

  return (
    <div className={`h-full w-full min-h-0 flex flex-col overflow-hidden ${isLight ? 'bg-white' : 'bg-neutral-950'}`}>
      {/* Top Workspace Control Bar (VS Code Titlebar Style) */}
      <header className={`h-12 shrink-0 px-3 flex items-center justify-between select-none z-20 gap-3 transition-colors ${titlebarBg}`}>
        {/* Left Section: Branding + Title + Autosave */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center shrink-0">
            <BrandMark
              size="sm"
              logoSize="xs"
              showSubtitle={false}
              variant={isLight ? 'mixed' : 'white'}
            />
          </div>

          <span className={`${isLight ? 'text-neutral-300' : 'text-neutral-700'} select-none hidden sm:inline`}>|</span>

          {/* Assessment Title & Company Badge */}
          {(assessment.title || assessment.companyName) && (
            <div className="flex items-center gap-2 min-w-0">
              {assessment.title && (
                <h1 className={`text-xs font-semibold truncate max-w-[160px] sm:max-w-[220px] md:max-w-[300px] ${
                  isLight ? 'text-neutral-900' : 'text-neutral-200'
                }`}>
                  {assessment.title}
                </h1>
              )}
              {assessment.companyName && (
                <span className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full font-medium shrink-0 shadow-2xs transition-colors ${
                  isLight
                    ? 'bg-neutral-100 text-neutral-700 border border-neutral-200/90'
                    : 'bg-neutral-800 text-neutral-300 border border-neutral-700/80'
                }`}>
                  <Building2 className={`w-3 h-3 shrink-0 ${isLight ? 'text-neutral-500' : 'text-primary'}`} />
                  <span className="truncate max-w-[180px]">{assessment.companyName}</span>
                </span>
              )}
            </div>
          )}

          <span className={`${isLight ? 'text-neutral-300' : 'text-neutral-700'} select-none hidden md:inline`}>|</span>

          {/* Autosave Indicator (Green for Saved) */}
          <div className="flex items-center gap-1.5 shrink-0" data-testid="autosave-indicator">
            {draftEngine.status === 'saving' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary border border-primary/20">
                <Loader2 className="w-3 h-3 animate-spin" />
                Saving...
              </span>
            ) : draftEngine.status === 'saved' ? (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium shadow-2xs ${
                isLight
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/60'
              }`}>
                <CheckCircle2 className={`w-3 h-3 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
                Saved
              </span>
            ) : draftEngine.status === 'dirty' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Unsaved
              </span>
            ) : draftEngine.status === 'error' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                <AlertCircle className="w-3 h-3 text-rose-600" />
                Save failed
              </span>
            ) : (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium shadow-2xs ${
                isLight
                  ? 'bg-emerald-50/70 text-emerald-700 border border-emerald-200/70'
                  : 'bg-emerald-950/30 text-emerald-400/90 border border-emerald-800/40'
              }`}>
                <CheckCircle2 className={`w-3 h-3 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
                Saved
              </span>
            )}
          </div>
        </div>

        {/* Center Section: Prominent Authoritative Countdown Timer */}
        <div className="flex items-center justify-center shrink-0">
          <CountdownTimer
            formattedTime={timing.formattedTime}
            isWarning={timing.isWarning}
            isExpired={timing.isExpired}
            remainingMs={timing.remainingMs}
            theme={theme}
            label="Timer:"
            className="!h-7 shadow-2xs"
          />
        </div>

        {/* Right Section: Theme Selector + Fullscreen + Review & Submit + Exit */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Theme Selector (Dark / Light White & Orange) */}
          <div className={`flex items-center rounded-lg p-0.5 border ${
            isLight
              ? 'bg-neutral-100 border-neutral-200'
              : 'bg-neutral-900 border-neutral-700/80'
          }`}>
            <button
              type="button"
              title="Dark Theme"
              onClick={() => handleThemeChange('dark')}
              className={`p-1 rounded-md transition-colors cursor-pointer ${
                theme === 'dark'
                  ? 'bg-neutral-700 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              title="Light Theme (White & Orange)"
              onClick={() => handleThemeChange('light')}
              className={`p-1 rounded-md transition-colors cursor-pointer ${
                theme === 'light'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-neutral-500 hover:text-primary'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* AI Copilot Slide-Over Drawer Toggle (BR-13, BR-15) */}
          <button
            type="button"
            onClick={() => setIsCopilotOpen(!isCopilotOpen)}
            className={`!h-7 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer border shadow-2xs whitespace-nowrap ${
              isCopilotOpen
                ? 'bg-primary text-white border-primary shadow-xs'
                : isLight
                  ? 'bg-orange-50/80 hover:bg-orange-100/90 text-primary border-orange-200'
                  : 'bg-neutral-800/80 hover:bg-neutral-700 text-orange-400 border-neutral-700'
            }`}
            title="Toggle AI Copilot Assistant"
            data-testid="workspace-copilot-header-btn"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Copilot</span>
          </button>

          {fullscreen.isSupported && !fullscreen.isFullscreen && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={`!h-7 !rounded-lg px-2.5 text-xs font-medium whitespace-nowrap cursor-pointer ${
                isLight
                  ? 'border-neutral-200 bg-white text-neutral-800 hover:bg-orange-50 hover:text-primary hover:border-primary/40'
                  : 'border-neutral-700 bg-neutral-800/80 text-neutral-300 hover:text-white hover:bg-neutral-700'
              }`}
              onClick={fullscreen.enterFullscreen}
              data-testid="toggle-fullscreen-button"
              leftIcon={<Maximize2 className="w-3 h-3 text-neutral-400" />}
            >
              Full Screen
            </Button>
          )}

          <Button
            type="button"
            variant="primary"
            size="sm"
            className="!h-7 !rounded-lg px-3 font-semibold text-xs whitespace-nowrap shadow-xs"
            onClick={() => setActiveSideTab('submission')}
            data-testid="submit-assessment-bottom-btn"
            rightIcon={<Send className="w-3.5 h-3.5" />}
          >
            Review &amp; Submit
          </Button>

          <button
            type="button"
            onClick={() => {
              if (confirm('Exit assessment workspace? Your work is continuously autosaved to the cloud.')) {
                router.push(ROUTES.CANDIDATE.DASHBOARD);
              }
            }}
            className={`text-xs px-2 py-1 rounded transition-colors whitespace-nowrap cursor-pointer ${
              isLight ? 'text-neutral-500 hover:text-neutral-900' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Exit
          </button>
        </div>
      </header>

      {/* Full-Screen Exit Warning */}
      {fullscreen.hasExitedFullscreen && (
        <div
          data-testid="fullscreen-exit-warning"
          className="shrink-0 p-2.5 bg-warning/20 border-b border-warning/40 text-warning-foreground text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 z-10"
        >
          <span>Fullscreen exited. Please re-enter full screen mode to maintain assessment integrity.</span>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="!h-6 !rounded px-2 text-xs border-warning/50 bg-transparent text-warning-foreground hover:bg-warning/20"
              onClick={fullscreen.dismissExitWarning}
            >
              Dismiss
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="!h-6 !rounded px-2.5 text-xs font-semibold"
              onClick={fullscreen.enterFullscreen}
              leftIcon={<Maximize2 className="w-3 h-3" />}
            >
              Re-enter Full Screen
            </Button>
          </div>
        </div>
      )}

      {/* Main Developer IDE Workspace (Full Screen, Edge-to-Edge) */}
      <div className="flex-1 min-h-0 w-full flex overflow-hidden">
        {/* 1. Activity Bar (Narrow left rail, 48px) */}
        <div className={`w-12 shrink-0 ${activityBarBg} flex flex-col items-center py-2.5 gap-2 select-none z-10 transition-colors`}>
          <button
            type="button"
            title="Project File Explorer"
            onClick={() => setActiveSideTab(activeSideTab === 'explorer' ? null : 'explorer')}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              activeSideTab === 'explorer'
                ? isLight
                  ? 'bg-orange-100/70 text-primary border border-orange-200/80 shadow-2xs font-semibold'
                  : 'bg-neutral-800 text-primary border border-neutral-700 shadow-xs'
                : isLight
                  ? 'text-neutral-500 hover:text-primary hover:bg-orange-50/60'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
            }`}
          >
            <FolderTree className="w-4 h-4" />
          </button>

          <button
            type="button"
            title="Task Instructions & Brief"
            onClick={() => setActiveSideTab(activeSideTab === 'brief' ? null : 'brief')}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              activeSideTab === 'brief'
                ? isLight
                  ? 'bg-orange-100/70 text-primary border border-orange-200/80 shadow-2xs font-semibold'
                  : 'bg-neutral-800 text-primary border border-neutral-700 shadow-xs'
                : isLight
                  ? 'text-neutral-500 hover:text-primary hover:bg-orange-50/60'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
            }`}
          >
            <FileText className="w-4 h-4" />
          </button>

          <button
            type="button"
            title="Solution Submission & Deliverables"
            onClick={() => setActiveSideTab(activeSideTab === 'submission' ? null : 'submission')}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              activeSideTab === 'submission'
                ? isLight
                  ? 'bg-orange-100/70 text-primary border border-orange-200/80 shadow-2xs font-semibold'
                  : 'bg-neutral-800 text-primary border border-neutral-700 shadow-xs'
                : isLight
                  ? 'text-neutral-500 hover:text-primary hover:bg-orange-50/60'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
            }`}
          >
            <GitBranch className="w-4 h-4" />
          </button>

          <button
            type="button"
            title="Toggle Integrated Terminal (Ctrl+`)"
            onClick={() => setIsTerminalOpen(!isTerminalOpen)}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              isTerminalOpen
                ? isLight
                  ? 'bg-orange-100/70 text-primary border border-orange-200/80 shadow-2xs font-semibold'
                  : 'bg-neutral-800 text-primary border border-neutral-700 shadow-xs'
                : isLight
                  ? 'text-neutral-500 hover:text-primary hover:bg-orange-50/60'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
            }`}
            data-testid="activity-bar-terminal-btn"
          >
            <TerminalIcon className="w-4 h-4" />
          </button>

          <button
            type="button"
            title="Toggle AI Copilot Assistant"
            onClick={() => setIsCopilotOpen(!isCopilotOpen)}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              isCopilotOpen
                ? isLight
                  ? 'bg-orange-100/70 text-primary border border-orange-200/80 shadow-2xs font-semibold'
                  : 'bg-neutral-800 text-primary border border-neutral-700 shadow-xs'
                : isLight
                  ? 'text-neutral-500 hover:text-primary hover:bg-orange-50/60'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
            }`}
            data-testid="activity-bar-copilot-btn"
          >
            <Bot className="w-4 h-4" />
          </button>
        </div>

        {/* 2. Collapsible Primary Sidebar */}
        {activeSideTab && (
          <div
            style={{ width: `${sidebarWidth}px` }}
            className={`shrink-0 h-full ${sidebarBg} flex flex-col overflow-hidden transition-colors relative`}
          >
            {activeSideTab === 'explorer' && (
              <FileTree
                files={wsFiles.files}
                activeFileId={wsFiles.activeFileId}
                onSelectFile={wsFiles.openFile}
                onCreateFile={(name, parentPath) => wsFiles.createFile(name, parentPath)}
                onCreateFolder={(name, parentPath) => wsFiles.createFolder(name, parentPath)}
                onDeleteFile={wsFiles.deleteFile}
                onDeleteFolder={wsFiles.deleteFolder}
                onRefresh={wsFiles.refreshFiles}
                customFolders={wsFiles.customFolders}
                theme={theme}
              />
            )}

            {activeSideTab === 'brief' && (
              <div className="h-full flex flex-col overflow-hidden bg-white dark:bg-neutral-900 text-xs">
                <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40">
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-primary" /> Task Brief
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-200/60 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300">
                    Markdown
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <SafeMarkdown content={instructionsContent} />
                </div>

                <div className="shrink-0 p-3.5 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-800/30 space-y-2">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <span>Checklist</span>
                    <span className="text-primary">{completedCount}/3 Ready</span>
                  </div>
                  <ul className="text-xs space-y-1.5">
                    <li className="flex items-center gap-2">
                      {hasRepo ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-neutral-300 dark:border-neutral-600 shrink-0" />
                      )}
                      <span className={hasRepo ? 'text-neutral-800 dark:text-neutral-200 font-medium' : 'text-neutral-500'}>
                        Repository configured
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      {hasBranch ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-neutral-300 dark:border-neutral-600 shrink-0" />
                      )}
                      <span className={hasBranch ? 'text-neutral-800 dark:text-neutral-200 font-medium' : 'text-neutral-500'}>
                        Branch specified
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      {hasNotes ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-neutral-300 dark:border-neutral-600 shrink-0" />
                      )}
                      <span className={hasNotes ? 'text-neutral-800 dark:text-neutral-200 font-medium' : 'text-neutral-500'}>
                        Architecture notes provided
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {activeSideTab === 'submission' && (
              <div className="h-full flex flex-col overflow-hidden bg-white dark:bg-neutral-900 text-xs">
                <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40">
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5 text-primary" /> Deliverables
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-200/60 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300">
                    Stream 4 Storage
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="repo-url-input" className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      Repository URL <span className="text-danger">*</span>
                    </label>
                    <input
                      id="repo-url-input"
                      type="url"
                      placeholder="https://github.com/org/repo"
                      value={draftEngine.draft.repositoryUrl || ''}
                      onChange={(e) => draftEngine.updateDraft({ repositoryUrl: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-mono"
                      data-testid="repo-url-input"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="branch-input" className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      Branch <span className="text-danger">*</span>
                    </label>
                    <input
                      id="branch-input"
                      type="text"
                      placeholder="main"
                      value={draftEngine.draft.branchName || ''}
                      onChange={(e) => draftEngine.updateDraft({ branchName: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-mono"
                      data-testid="branch-input"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      Solution Archive (.zip / .tar.gz)
                    </label>
                    <DeliverablesUploader
                      artifact={draftEngine.draft.uploadedArtifact || null}
                      onArtifactChange={draftEngine.setUploadedArtifact}
                      onUploadStateChange={setIsUploading}
                      assignmentId={assessment.id}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                        Architecture Notes <span className="text-danger">*</span>
                      </label>
                      <div className="inline-flex p-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-[10px]">
                        <button
                          type="button"
                          onClick={() => setNotesTab('edit')}
                          className={`px-2 py-0.5 rounded ${notesTab === 'edit' ? 'bg-white dark:bg-neutral-700 font-semibold' : ''}`}
                        >
                          Write
                        </button>
                        <button
                          type="button"
                          onClick={() => setNotesTab('preview')}
                          className={`px-2 py-0.5 rounded ${notesTab === 'preview' ? 'bg-white dark:bg-neutral-700 font-semibold' : ''}`}
                        >
                          Preview
                        </button>
                      </div>
                    </div>

                    {notesTab === 'edit' ? (
                      <textarea
                        rows={5}
                        placeholder="Explain your approach, design decisions, and trade-offs..."
                        value={draftEngine.draft.architectureNotes}
                        onChange={(e) => draftEngine.updateDraft({ architectureNotes: e.target.value })}
                        className="w-full p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-mono"
                        data-testid="architecture-notes-textarea"
                      />
                    ) : (
                      <div className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-xs min-h-[100px]">
                        {draftEngine.draft.architectureNotes ? (
                          <SafeMarkdown content={draftEngine.draft.architectureNotes} />
                        ) : (
                          <span className="text-neutral-400 italic">No notes provided yet.</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="shrink-0 p-3.5 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-800/30">
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    className="w-full font-semibold !rounded-xl"
                    onClick={() => setShowConfirmDialog(true)}
                    disabled={timing.isExpired || isUploading}
                    rightIcon={<Send className="w-3.5 h-3.5" />}
                  >
                    Submit Final Assessment
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Vertical Resize Handle with Pill Thumb & Grip */}
        {activeSideTab && (
          <div
            onMouseDown={handleResizeMouseDown}
            onDoubleClick={() => {
              setSidebarWidth(DEFAULT_SIDEBAR_WIDTH);
              try {
                localStorage.setItem('hs_workspace_sidebar_width', DEFAULT_SIDEBAR_WIDTH.toString());
              } catch {}
            }}
            role="separator"
            aria-orientation="vertical"
            title="Drag to resize sidebar, double-click to reset"
            className="w-3 -mx-1.5 h-full cursor-col-resize select-none shrink-0 relative z-30 group flex items-center justify-center"
          >
            {/* Center Divider Hairline */}
            <div
              className={`w-[1px] h-full transition-colors ${
                isResizingSidebar
                  ? 'bg-primary'
                  : isLight
                    ? 'bg-neutral-200/90 group-hover:bg-primary/70'
                    : 'bg-neutral-800 group-hover:bg-primary/70'
              }`}
            />

            {/* Modern IDE Thumb Handle (Pill with Grip Dots) */}
            <div
              className={`absolute w-1.5 h-12 rounded-full transition-all flex items-center justify-center ${
                isResizingSidebar
                  ? 'bg-primary h-16 w-2 shadow-sm'
                  : isLight
                    ? 'bg-neutral-300 group-hover:bg-primary group-hover:h-16 group-hover:w-2'
                    : 'bg-neutral-600/90 group-hover:bg-primary group-hover:h-16 group-hover:w-2'
              }`}
            >
              <div className="flex flex-col gap-0.5 items-center">
                <span className={`w-0.5 h-0.5 rounded-full ${isLight ? 'bg-neutral-500 group-hover:bg-white' : 'bg-neutral-400 group-hover:bg-white'}`} />
                <span className={`w-0.5 h-0.5 rounded-full ${isLight ? 'bg-neutral-500 group-hover:bg-white' : 'bg-neutral-400 group-hover:bg-white'}`} />
                <span className={`w-0.5 h-0.5 rounded-full ${isLight ? 'bg-neutral-500 group-hover:bg-white' : 'bg-neutral-400 group-hover:bg-white'}`} />
              </div>
            </div>
          </div>
        )}

        {/* 3. Center Monaco Editor Area */}
        <div className={`flex-1 min-w-0 flex flex-col h-full overflow-hidden ${editorAreaBg}`}>
          <EditorTabs
            files={wsFiles.files}
            openFileIds={wsFiles.openFileIds}
            activeFileId={wsFiles.activeFileId}
            onSelectTab={wsFiles.setActiveFileId}
            onCloseTab={wsFiles.closeFile}
            theme={theme}
          />

          <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
            <MonacoCodeEditor
              file={wsFiles.activeFile}
              theme={theme}
              onSave={handleSaveActiveFile}
              onChange={(content) => {
                if (wsFiles.activeFileId) {
                  wsFiles.updateFileContent(wsFiles.activeFileId, content);
                }
              }}
            />
          </div>

          {/* Integrated Interactive Terminal */}
          {isTerminalOpen && (
            <div
              style={{ height: isTerminalMaximized ? '75%' : `${terminalHeight}px` }}
              className="shrink-0 flex flex-col relative z-20 overflow-hidden select-none"
            >
              {/* Horizontal Resize Bar with Modern Pill Thumb */}
              {!isTerminalMaximized && (
                <div
                  onMouseDown={handleTerminalResizeMouseDown}
                  onDoubleClick={() => setTerminalHeight(DEFAULT_TERMINAL_HEIGHT)}
                  role="separator"
                  aria-orientation="horizontal"
                  title="Drag to resize terminal, double-click to reset"
                  className="h-3 -my-1.5 w-full cursor-row-resize select-none shrink-0 relative z-20 group flex items-center justify-center"
                >
                  {/* Center Divider Hairline */}
                  <div
                    className={`h-[1px] w-full transition-colors ${
                      isResizingTerminal
                        ? 'bg-primary'
                        : isLight
                          ? 'bg-neutral-200/90 group-hover:bg-primary/70'
                          : 'bg-neutral-800 group-hover:bg-primary/70'
                    }`}
                  />

                  {/* Horizontal Thumb Handle (Pill with Grip Dots) */}
                  <div
                    className={`absolute h-1.5 w-12 rounded-full transition-all flex items-center justify-center ${
                      isResizingTerminal
                        ? 'bg-primary w-16 h-2 shadow-sm'
                        : isLight
                          ? 'bg-neutral-300 group-hover:bg-primary group-hover:w-16 group-hover:h-2'
                          : 'bg-neutral-600/90 group-hover:bg-primary group-hover:w-16 group-hover:h-2'
                    }`}
                  >
                    <div className="flex flex-row gap-0.5 items-center">
                      <span className={`w-0.5 h-0.5 rounded-full ${isLight ? 'bg-neutral-500 group-hover:bg-white' : 'bg-neutral-400 group-hover:bg-white'}`} />
                      <span className={`w-0.5 h-0.5 rounded-full ${isLight ? 'bg-neutral-500 group-hover:bg-white' : 'bg-neutral-400 group-hover:bg-white'}`} />
                      <span className={`w-0.5 h-0.5 rounded-full ${isLight ? 'bg-neutral-500 group-hover:bg-white' : 'bg-neutral-400 group-hover:bg-white'}`} />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex-1 min-h-0 overflow-hidden">
                <XtermTerminal
                  workspaceId={assessment.workspaceId || assessmentId}
                  sessionToken="cloud-workspace-session-token"
                  theme={theme}
                  files={wsFiles.files}
                  onClose={() => setIsTerminalOpen(false)}
                  isMaximized={isTerminalMaximized}
                  onToggleMaximize={() => setIsTerminalMaximized(!isTerminalMaximized)}
                />
              </div>
            </div>
          )}

          {/* Bottom Status Bar */}
          <footer className={`h-6 shrink-0 ${statusBarBg} px-3 flex items-center justify-between text-[11px] select-none transition-colors`}>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full inline-block ${isLight ? 'bg-primary' : 'bg-success'}`} />
                Workspace Connected
              </span>
              <button
                type="button"
                onClick={() => setIsTerminalOpen(!isTerminalOpen)}
                className="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer"
                title="Toggle Terminal (Ctrl+`)"
              >
                <TerminalIcon className="w-3 h-3 text-primary" />
                <span>Terminal</span>
              </button>
              <span>UTF-8</span>
              <span className="capitalize">{wsFiles.activeFile?.language || 'Plaintext'}</span>
            </div>

            <div className="flex items-center gap-3">
              <span>RPO &le; 30s</span>
              <span>HelloSmart Cloud</span>
            </div>
          </footer>
        </div>

        {/* 4. Docked AI Copilot Right Section (Side-by-side, NOT a popup overlay) */}
        {isCopilotOpen && (
          <>
            {/* Vertical Resize Handle with Modern Pill Thumb & Grip */}
            <div
              onMouseDown={handleCopilotResizeMouseDown}
              onDoubleClick={() => setCopilotWidth(DEFAULT_COPILOT_WIDTH)}
              role="separator"
              aria-orientation="vertical"
              title="Drag to resize Copilot, double-click to reset"
              className="w-3 -mx-1.5 h-full cursor-col-resize select-none shrink-0 relative z-30 group flex items-center justify-center"
            >
              {/* Center Divider Hairline */}
              <div
                className={`w-[1px] h-full transition-colors ${
                  isResizingCopilot
                    ? 'bg-primary'
                    : isLight
                      ? 'bg-neutral-200/90 group-hover:bg-primary/70'
                      : 'bg-neutral-800 group-hover:bg-primary/70'
                }`}
              />

              {/* Modern IDE Thumb Handle (Pill with Grip Dots) */}
              <div
                className={`absolute w-1.5 h-12 rounded-full transition-all flex items-center justify-center ${
                  isResizingCopilot
                    ? 'bg-primary h-16 w-2 shadow-sm'
                    : isLight
                      ? 'bg-neutral-300 group-hover:bg-primary group-hover:h-16 group-hover:w-2'
                      : 'bg-neutral-600/90 group-hover:bg-primary group-hover:h-16 group-hover:w-2'
                }`}
              >
                <div className="flex flex-col gap-0.5 items-center">
                  <span className={`w-0.5 h-0.5 rounded-full ${isLight ? 'bg-neutral-500 group-hover:bg-white' : 'bg-neutral-400 group-hover:bg-white'}`} />
                  <span className={`w-0.5 h-0.5 rounded-full ${isLight ? 'bg-neutral-500 group-hover:bg-white' : 'bg-neutral-400 group-hover:bg-white'}`} />
                  <span className={`w-0.5 h-0.5 rounded-full ${isLight ? 'bg-neutral-500 group-hover:bg-white' : 'bg-neutral-400 group-hover:bg-white'}`} />
                </div>
              </div>
            </div>

            <AiCopilotDrawer
              isOpen={isCopilotOpen}
              onClose={() => setIsCopilotOpen(false)}
              workspaceId={assessment.workspaceId || assessmentId}
              aiPolicy={assessment.aiPolicy}
              onInsertCode={handleInsertCodeIntoEditor}
              theme={theme}
              width={copilotWidth}
            />
          </>
        )}
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
