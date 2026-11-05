'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  PageHeader,
  Card,
  Badge,
  Button,
  EmptyState,
  Alert,
  Textarea,
  ConsentPanel,
  CountdownTimer,
  WorkspaceConnectionStatus,
  WorkspaceRecoveryPanel,
  RubricScoreCard,
  type WorkspaceConnectionState,
} from '@hs/ui';
import {
  useGetAssessmentByIdQuery,
  useAcceptConsentMutation,
  useSaveDraftMutation,
  useSubmitAssessmentMutation,
} from '@/store/candidate/candidateApi';
import {
  Laptop,
  MessageSquare,
  ShieldCheck,
  Send,
  Save,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowLeft,
  Maximize2,
  FileCode,
  Lock,
} from 'lucide-react';

interface PageProps {
  params?: Promise<{ id: string }> | { id: string };
}

export default function CandidateAssessmentTakePage(props?: PageProps) {
  const routeParams = useParams();

  // Handle assignmentId whether passed via route params or page props
  const [resolvedId, setResolvedId] = useState<string>(() => {
    if (routeParams?.id) return String(routeParams.id);
    if (props?.params && !(props.params instanceof Promise) && 'id' in props.params) {
      return String(props.params.id);
    }
    return '';
  });

  useEffect(() => {
    if (props?.params instanceof Promise) {
      props.params.then((p) => {
        if (p?.id) setResolvedId(p.id);
      });
    } else if (routeParams?.id) {
      setResolvedId(String(routeParams.id));
    }
  }, [props?.params, routeParams?.id]);

  const assignmentId = resolvedId;

  const {
    data: assessment,
    isLoading,
    error,
    refetch,
  } = useGetAssessmentByIdQuery(assignmentId, {
    skip: !assignmentId,
  });

  const [acceptConsentMutation, { isLoading: isAcceptingConsent }] = useAcceptConsentMutation();
  const [saveDraftMutation, { isLoading: isSavingDraft }] = useSaveDraftMutation();
  const [submitAssessmentMutation, { isLoading: isSubmitting }] = useSubmitAssessmentMutation();

  // Internal workspace session states
  const [hasConsented, setHasConsented] = useState<boolean>(false);
  const [connectionState, setConnectionState] = useState<WorkspaceConnectionState>('not_connected');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [draftCode, setDraftCode] = useState<string>(
    '// Solution Implementation\n// All changes are continuously autosaved (RPO <= 30s, BR-11)\n',
  );
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);

  // Derive effective consented and connection states (SSR and re-render safe)
  const isConsented = Boolean(
    hasConsented ||
      assessment?.status === 'submitted' ||
      assessment?.status === 'in_progress' ||
      assessment?.firstConnectAt,
  );

  const effectiveConnectionState: WorkspaceConnectionState = useMemo(() => {
    if (connectionState !== 'not_connected') return connectionState;
    if (assessment?.status === 'submitted') return 'ended';
    if (assessment?.status === 'in_progress' || assessment?.firstConnectAt) return 'connected';
    return 'not_connected';
  }, [connectionState, assessment?.status, assessment?.firstConnectAt]);

  // Sync initial consented / connection state from assessment data
  useEffect(() => {
    if (!assessment) return;
    if (assessment.status === 'submitted') {
      setHasConsented(true);
      setConnectionState('ended');
    } else if (assessment.firstConnectAt || assessment.status === 'in_progress') {
      setHasConsented(true);
      setConnectionState('connected');
    }
  }, [assessment]);

  // Fullscreen exit detection for Cloud workspaces (BR-10)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleFullscreenChange = () => {
      if (
        assessment?.workspaceMode === 'cloud' &&
        isConsented &&
        effectiveConnectionState === 'connected' &&
        !document.fullscreenElement
      ) {
        setConnectionState('fullscreen_exit');
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [assessment?.workspaceMode, isConsented, effectiveConnectionState]);

  // Re-enter fullscreen handler
  const handleResumeFullscreen = useCallback(async () => {
    try {
      if (typeof document !== 'undefined' && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Browser permissions fallback
    }
    setConnectionState('connected');
  }, []);

  // Continuous Autosave (BR-11, RPO <= 30s)
  useEffect(() => {
    if (!isConsented || effectiveConnectionState === 'ended' || assessment?.status === 'submitted') {
      return;
    }

    const interval = setInterval(async () => {
      if (!assignmentId) return;
      try {
        await saveDraftMutation({
          workspaceId: assignmentId,
          files: { 'solution.ts': draftCode },
          notes: 'Continuous autosave snapshot (BR-11)',
          updatedAt: new Date().toISOString(),
        }).unwrap();
        setLastSavedAt(new Date());
      } catch (err) {
        console.warn('Draft autosave warning:', err);
      }
    }, 25000); // 25s autosave loop (RPO <= 30s)

    return () => clearInterval(interval);
  }, [
    isConsented,
    effectiveConnectionState,
    assessment?.status,
    assignmentId,
    draftCode,
    saveDraftMutation,
  ]);

  // Manual save handler
  const handleManualSave = async () => {
    if (!assignmentId) return;
    try {
      await saveDraftMutation({
        workspaceId: assignmentId,
        files: { 'solution.ts': draftCode },
        notes: 'Manual candidate save snapshot',
        updatedAt: new Date().toISOString(),
      }).unwrap();
      setLastSavedAt(new Date());
    } catch (err) {
      console.error('Manual save failed:', err);
    }
  };

  // Submit assessment handler (BR-08, BR-20)
  const handleSubmitAssessment = async (autoSubmitted = false) => {
    if (!assignmentId || isSubmitting) return;
    try {
      await submitAssessmentMutation({
        workspaceId: assignmentId,
        autoSubmitted,
        submissionNotes: 'candidate-final-artifacts',
      }).unwrap();
      setShowSubmitModal(false);
      setConnectionState('ended');
      refetch();
    } catch (err) {
      console.error('Submission failed:', err);
    }
  };

  // Pre-connect consent acceptance (BR-12)
  const handleConsentAccept = async ({ textVersion }: { textVersion: string }) => {
    if (!assignmentId) return;
    try {
      await acceptConsentMutation({ assignmentId, textVersion }).unwrap();
      setHasConsented(true);
      setConnectionState('connected');

      // Request fullscreen for Cloud VM (BR-10)
      if (assessment?.workspaceMode === 'cloud') {
        try {
          if (typeof document !== 'undefined' && document.documentElement.requestFullscreen) {
            await document.documentElement.requestFullscreen();
          }
        } catch {
          // Fallback if browser requires immediate gesture
        }
      }
      refetch();
    } catch (err) {
      console.error('Failed to record consent:', err);
    }
  };

  // Calculated deadline for CountdownTimer
  const computedDeadline = useMemo(() => {
    if (assessment?.deadline) return assessment.deadline;
    const baseTime = assessment?.firstConnectAt
      ? new Date(assessment.firstConnectAt).getTime()
      : Date.now();
    const durationMs = (assessment?.durationMinutes || 60) * 60 * 1000;
    return new Date(baseTime + durationMs).toISOString();
  }, [assessment]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Loading Workspace..."
          description="Setting up secure evaluation sandbox."
          badge={{ text: 'Candidate Portal', variant: 'info' }}
        />
        <Card className="p-8">
          <div className="flex items-center justify-center p-12 text-sm text-neutral-500">
            Initializing candidate assessment session...
          </div>
        </Card>
      </div>
    );
  }

  if (error || !assessment) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Assessment Not Found"
          description="The requested assessment could not be retrieved."
          badge={{ text: 'Candidate Portal', variant: 'info' }}
        />
        <Card className="p-8">
          <EmptyState
            title="Assessment not found"
            description="We could not locate this assignment. It may have expired or been revoked."
            action={{
              label: 'Return to My Assessments',
              href: '/candidate/assessments',
            }}
          />
        </Card>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STATE 1: Already Submitted View (BR-20 Candidate Results Release Invariant)
  // ───────────────────────────────────────────────────────────────────────────
  if (assessment.status === 'submitted') {
    return (
      <div className="space-y-6" data-testid="assessment-submitted-view">
        <PageHeader
          title={assessment.title}
          description={`Work simulation by ${assessment.companyName || 'Hiring Company'}`}
          badge={{ text: 'Submitted', variant: 'default' }}
          actions={
            <Link href="/candidate/assessments">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ArrowLeft className="w-4 h-4" /> Return to Assessments
              </Button>
            </Link>
          }
        />

        {assessment.releaseResults ? (
          <div className="space-y-6" data-testid="results-released-section">
            <Alert variant="success" title="Evaluation Results Released">
              Your evaluation results have been reviewed and released by{' '}
              {assessment.companyName || 'the hiring team'}.
            </Alert>

            {assessment.rubricScores && assessment.rubricScores.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {assessment.rubricScores.map((scoreItem, idx) => (
                  <RubricScoreCard
                    key={scoreItem.name || idx}
                    name={scoreItem.name}
                    weight={scoreItem.weight ?? 0}
                    score={scoreItem.score}
                    rationale={scoreItem.rationale ?? ''}
                    evidence={scoreItem.evidence ?? []}
                    confidence={scoreItem.confidence}
                  />
                ))}
              </div>
            ) : (
              <Card className="p-6 text-center text-sm text-neutral-500" data-testid="no-rubric-scores-empty">
                Evaluation results have been released. Rubric dimension scorecards will appear once published by the evaluation team.
              </Card>
            )}
          </div>
        ) : (
          <Card className="p-6 sm:p-8 space-y-6" data-testid="results-under-review-section">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-600 shrink-0">
                <Lock className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-medium text-neutral-900">
                  Assessment Submitted &bull; Evaluation Under Review
                </h3>
                <p className="text-sm text-neutral-600 leading-relaxed font-normal">
                  Your work simulation has been safely captured and queued for evaluation. In
                  accordance with platform privacy rules (BR-20), candidate results, reviewer agent
                  scores, and evaluation notes remain private until released by the hiring team.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-4 border-t border-neutral-100">
              <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/80">
                <span className="text-neutral-500 block mb-0.5 font-light">Status</span>
                <span className="text-neutral-800 font-medium">Under Review</span>
              </div>
              <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/80">
                <span className="text-neutral-500 block mb-0.5 font-light">Submitted At</span>
                <span className="text-neutral-800 font-medium">
                  {assessment.submittedAt
                    ? new Date(assessment.submittedAt).toLocaleString()
                    : 'Recently'}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/80">
                <span className="text-neutral-500 block mb-0.5 font-light">Environment</span>
                <span className="text-neutral-800 font-medium">
                  {assessment.workspaceMode === 'cloud' ? 'Cloud VM' : 'Chat Workspace'}
                </span>
              </div>
            </div>
          </Card>
        )}
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STATE 2: Pre-connect Consent Screen (BR-12 Mandatory Consent Policy)
  // ───────────────────────────────────────────────────────────────────────────
  if (!isConsented) {
    return (
      <div className="space-y-6" data-testid="consent-gate-view">
        <PageHeader
          title={assessment.title}
          description={`Work simulation by ${assessment.companyName || 'Hiring Company'}`}
          badge={{ text: 'Consent Required', variant: 'warning' }}
          actions={
            <Link href="/candidate/assessments">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ArrowLeft className="w-4 h-4" /> Cancel
              </Button>
            </Link>
          }
        />

        <ConsentPanel
          workspaceMode={assessment.workspaceMode}
          aiEnabled={assessment.aiPolicy?.enabled ?? true}
          pauseTimerOnDisconnect={assessment.timing?.pauseTimerOnDisconnect ?? false}
          isLoading={isAcceptingConsent}
          onAccept={handleConsentAccept}
          className="shadow-sm"
        />
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STATE 3: Governed Workspace Taking Experience (BR-08, BR-10, BR-11)
  // ───────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6" data-testid="workspace-active-view">
      {/* Workspace Header Bar: Connection Status, Live Countdown Timer & Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 rounded-xl bg-white border border-neutral-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-medium text-neutral-900">{assessment.title}</h1>
            <Badge variant="default" className="text-xs">
              {assessment.companyName || 'Hiring Company'}
            </Badge>
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Mode: {assessment.workspaceMode === 'cloud' ? 'Cloud VM' : 'Chat Workspace'} &bull;
            Duration: {assessment.durationMinutes} Minutes
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Connection Status indicator */}
          <WorkspaceConnectionStatus
            state={effectiveConnectionState}
            onReconnect={
              assessment.workspaceMode === 'cloud' ? handleResumeFullscreen : () => setConnectionState('connected')
            }
          />

          {/* Server-enforced Countdown Timer (BR-08) */}
          <CountdownTimer
            deadlineUtc={computedDeadline}
            pauseTimerOnDisconnect={assessment.timing?.pauseTimerOnDisconnect ?? false}
            onExpire={() => handleSubmitAssessment(true)}
          />

          <Button
            type="button"
            variant="primary"
            onClick={() => setShowSubmitModal(true)}
            data-testid="submit-assessment-button"
            className="gap-1.5"
          >
            <Send className="w-4 h-4" /> Submit Assessment
          </Button>
        </div>
      </div>

      {/* Disconnect / Fullscreen Exit Recovery Overlay (BR-10, BR-11) */}
      {effectiveConnectionState === 'fullscreen_exit' && (
        <div
          className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-3"
          data-testid="fullscreen-exit-recovery"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-800 text-sm font-medium">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <span>Full Screen Exited — Session Disconnected (BR-10)</span>
            </div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleResumeFullscreen}
              className="gap-1.5"
            >
              <Maximize2 className="w-4 h-4" /> Resume Full Screen
            </Button>
          </div>
          <p className="text-xs text-amber-700 leading-relaxed font-normal">
            Exiting full screen pauses active evaluation interactions. Continuous autosave has
            secured all your edits (RPO &le; 30s). Re-enter full screen to resume.
          </p>
        </div>
      )}

      {/* Continuous Autosave Notice Bar (BR-11) */}
      <WorkspaceRecoveryPanel
        lastSavedAt={lastSavedAt || undefined}
        onRestore={handleManualSave}
        isRestoring={isSavingDraft}
      />

      {/* Main Workspace Layout: Task Brief on Left, Editor Workspace on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Brief, Scenario, Deliverables */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-medium text-neutral-900 border-b border-neutral-100 pb-2">
              Task Brief & Scenario
            </h3>
            <div className="text-xs text-neutral-700 space-y-3 leading-relaxed">
              <p>
                {assessment.briefOverrides?.scenario ||
                  'You are tasked with implementing and validating a critical module according to product requirements.'}
              </p>
              {assessment.briefOverrides?.instructions && (
                <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200/80 font-mono text-[11px]">
                  {assessment.briefOverrides.instructions}
                </div>
              )}
            </div>

            {assessment.briefOverrides?.deliverables &&
              assessment.briefOverrides.deliverables.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-neutral-100">
                  <span className="text-xs font-medium text-neutral-900">Required Deliverables:</span>
                  <ul className="text-xs text-neutral-600 space-y-1 list-disc list-inside">
                    {assessment.briefOverrides.deliverables.map((item: any, idx: number) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
          </Card>

          <Card className="p-5 space-y-3">
            <h3 className="text-sm font-medium text-neutral-900 border-b border-neutral-100 pb-2">
              AI Assistance Policy (BR-14)
            </h3>
            <p className="text-xs text-neutral-600 leading-relaxed">
              {assessment.aiPolicy?.enabled
                ? 'Governed AI assistance is enabled. All interactions are policy-checked, capped, and recorded as evaluation evidence.'
                : 'AI assistant is disabled for this assessment. Network egress to external AI services is blocked.'}
            </p>
          </Card>
        </div>

        {/* Right Column: Interactive Editor / Work Area */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-neutral-500" />
                <span className="text-xs font-medium text-neutral-900 font-mono">solution.ts</span>
                <Badge variant="default" className="text-[10px] font-mono">
                  TypeScript
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleManualSave}
                  disabled={isSavingDraft}
                  className="gap-1.5 text-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isSavingDraft ? 'Saving...' : 'Save Draft'}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Textarea
                value={draftCode}
                onChange={(e) => setDraftCode(e.target.value)}
                rows={16}
                className="font-mono text-xs leading-relaxed bg-neutral-950 text-neutral-100 border-neutral-800 focus:border-primary p-4 rounded-lg"
                placeholder="// Enter your solution code here..."
                data-testid="workspace-editor"
              />
              <div className="flex items-center justify-between text-[11px] text-neutral-500 px-1">
                <span>Auto-saved continuously to secure cloud storage (BR-11)</span>
                <span>
                  {lastSavedAt ? `Saved at ${lastSavedAt.toLocaleTimeString()}` : 'Unsaved changes'}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Submit Confirmation Dialog */}
      {showSubmitModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          data-testid="submit-confirm-modal"
        >
          <Card className="max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-semibold text-neutral-900">
              Submit Assessment for Evaluation?
            </h3>
            <p className="text-xs text-neutral-600 leading-relaxed font-normal">
              Once submitted, your workspace session will end and your solution will be submitted
              for AI reviewer agent evaluation. You will no longer be able to edit your solution.
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowSubmitModal(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => handleSubmitAssessment(false)}
                disabled={isSubmitting}
                data-testid="confirm-submit-button"
              >
                {isSubmitting ? 'Submitting...' : 'Confirm Submission'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
