'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Alert,
  EmptyState,
  HumanReviewPanel,
  RubricScoreCard,
  ReviewDisagreementAlert,
} from '@hs/ui';
import {
  ArrowLeft,
  User,
  Clock,
  Laptop,
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
  FileCode,
  Terminal,
  Bot,
  AlertTriangle,
} from 'lucide-react';
import { useGetCandidatesQuery } from '@/store/company/companyApi';

export interface SubmissionDetail {
  id: string;
  candidateName: string;
  candidateEmail: string;
  assessmentName: string;
  workspaceMode: 'cloud' | 'chat';
  durationMinutes: number;
  submittedAt: string;
  autoSubmitted: boolean;
  isFinalized: boolean;
  currentVersion: number;
  overallScore: number;
  humanScore?: number;
  notes: string;
  releaseResults: boolean;
  rubricScores: Array<{
    name: string;
    weight: number;
    score: number;
    confidence: number;
    rationale: string;
    evidence: string[];
    flags?: string[];
  }>;
}

export interface CandidateSubmissionReviewPageProps {
  initialSubmission?: SubmissionDetail;
}

export default function CandidateSubmissionReviewPage({
  initialSubmission,
}: CandidateSubmissionReviewPageProps = {}) {
  const params = useParams();
  const submissionId = String(params?.id || 'sub-001');
  const { data: candidatesData } = useGetCandidatesQuery({ limit: 100 });

  const matchedCandidate = useMemo(() => {
    if (!candidatesData) return null;
    const items = Array.isArray(candidatesData)
      ? candidatesData
      : (candidatesData as { items?: any[] })?.items || [];
    return items.find(
      (c: any) =>
        c.id === submissionId ||
        c.assignmentId === submissionId ||
        c.email === submissionId,
    );
  }, [candidatesData, submissionId]);

  const [submission, setSubmission] = useState<SubmissionDetail>(() => {
    if (initialSubmission) return initialSubmission;
    return {
      id: submissionId,
      candidateName: matchedCandidate?.name || 'Candidate',
      candidateEmail: matchedCandidate?.email || 'candidate@company.com',
      assessmentName: (matchedCandidate as any)?.assessmentName || 'Technical Assessment',
      workspaceMode: ((matchedCandidate as any)?.workspaceMode as 'cloud' | 'chat') || 'cloud',
      durationMinutes: (matchedCandidate as any)?.durationMinutes || 90,
      submittedAt: (matchedCandidate as any)?.submittedAt
        ? new Date((matchedCandidate as any).submittedAt).toLocaleString()
        : 'Recently',
      autoSubmitted: false,
      isFinalized: matchedCandidate?.status === 'completed',
      currentVersion: 1,
      overallScore: (matchedCandidate as any)?.score ?? 80,
      humanScore: (matchedCandidate as any)?.humanScore,
      notes: '',
      releaseResults: false,
      rubricScores: [],
    };
  });

  useEffect(() => {
    if (initialSubmission) {
      setSubmission(initialSubmission);
    } else if (matchedCandidate) {
      setSubmission((prev) => ({
        ...prev,
        id: matchedCandidate.id || submissionId,
        candidateName: matchedCandidate.name || matchedCandidate.email.split('@')[0],
        candidateEmail: matchedCandidate.email,
        assessmentName: (matchedCandidate as any)?.assessmentName || prev.assessmentName,
        isFinalized: matchedCandidate.status === 'completed',
      }));
    }
  }, [initialSubmission, matchedCandidate, submissionId]);

  const [notification, setNotification] = useState<string | null>(null);

  const handleFinalize = (data: { score: number; notes: string; release: boolean }) => {
    setSubmission((prev) => ({
      ...prev,
      isFinalized: true,
      humanScore: data.score,
      notes: data.notes,
      releaseResults: data.release,
      currentVersion: prev.isFinalized ? prev.currentVersion + 1 : 1,
    }));

    setNotification(
      data.release
        ? `Review finalized (v${submission.currentVersion + 1}) and candidate results released.`
        : `Review finalized (v${submission.currentVersion + 1}) internally. Candidate results held private.`
    );

    setTimeout(() => setNotification(null), 5000);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* ── Navigation Breadcrumbs ───────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <Link
          href="/company/analytics"
          className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Analytics</span>
        </Link>

        <div className="flex items-center gap-2">
          {submission.isFinalized ? (
            <Badge variant="success" size="sm" className="gap-1 font-mono">
              <CheckCircle2 className="w-3 h-3" />
              Finalized (v{submission.currentVersion})
            </Badge>
          ) : (
            <Badge variant="warning" size="sm">
              Pending Human Review
            </Badge>
          )}

          {submission.releaseResults ? (
            <Badge variant="success" size="sm" className="font-medium">
              Results Released to Candidate
            </Badge>
          ) : (
            <Badge variant="default" size="sm" className="text-neutral-600">
              Results Private
            </Badge>
          )}
        </div>
      </div>

      {notification && (
        <Alert variant="success" className="animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 mr-2 shrink-0" />
          <span>{notification}</span>
        </Alert>
      )}

      {/* ── Candidate & Assessment Dossier Header ────────────────────────── */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-neutral-900">{submission.candidateName}</h1>
              <Badge variant="default" className="font-mono text-xs">
                {submission.id}
              </Badge>
            </div>
            <p className="text-xs text-neutral-500 font-mono">{submission.candidateEmail}</p>
          </div>

          <div className="flex items-center gap-4 text-xs text-neutral-600">
            <span className="flex items-center gap-1">
              {submission.workspaceMode === 'cloud' ? (
                <Laptop className="w-4 h-4 text-neutral-400" />
              ) : (
                <MessageSquare className="w-4 h-4 text-neutral-400" />
              )}
              <span>{submission.workspaceMode === 'cloud' ? 'Cloud VM' : 'Chat'}</span>
            </span>

            <span>•</span>

            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4 text-neutral-400" />
              <span>{submission.durationMinutes}m time used</span>
            </span>

            <span>•</span>

            <span className="text-neutral-500">Submitted {submission.submittedAt}</span>
          </div>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <span className="font-medium text-neutral-500">Assigned Assessment: </span>
            <span className="font-semibold text-neutral-900">{submission.assessmentName}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-neutral-500">Composite AI Score:</span>
            <span className="font-bold text-neutral-900 font-mono text-sm">
              {submission.overallScore} / 100
            </span>
          </div>
        </div>
      </Card>

      {/* ── Untrusted Data Security Notice (BR-18) ───────────────────────── */}
      <Alert variant="warning" className="flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="text-xs space-y-1">
          <p className="font-semibold text-amber-950">
            Untrusted Candidate Artifacts Notice
          </p>
          <p className="text-amber-800 leading-relaxed">
            All code snippets, git commits, and candidate chat messages below are untrusted candidate inputs and have been sanitized to mitigate prompt-injection attempts. AI reviewer scores are advisory; human review overrides take precedence.
          </p>
        </div>
      </Alert>

      {/* ── AI Reviewer Agent Rubric Breakdown ──────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-neutral-900">
              Independent AI Reviewer Agent Evaluations
            </h2>
            <p className="text-xs text-neutral-500">
              Each rubric item is scored independently with evidence citations from the candidate session.
            </p>
          </div>
          <Badge variant="default" size="sm" className="font-mono text-xs">
            Sum of Weights: 100%
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {submission.rubricScores.length > 0 ? (
            submission.rubricScores.map((item, idx) => (
              <RubricScoreCard
                key={idx}
                name={item.name}
                weight={item.weight}
                score={item.score}
                confidence={item.confidence}
                rationale={item.rationale}
                evidence={item.evidence}
                flags={item.flags}
              />
            ))
          ) : (
            <Card className="p-8 text-center text-xs text-neutral-500">
              No independent AI reviewer evaluations recorded for this submission yet. Agent reports will appear here once scoring runs complete.
            </Card>
          )}
        </div>
      </div>

      {/* ── Human Review & Final Decision Panel (BR-20) ──────────────────── */}
      <div className="space-y-4 pt-2">
        <HumanReviewPanel
          currentScore={submission.humanScore ?? submission.overallScore}
          initialNotes={submission.notes}
          isFinalized={submission.isFinalized}
          currentVersion={submission.currentVersion}
          releaseResults={submission.releaseResults}
          onFinalize={handleFinalize}
        />
      </div>
    </div>
  );
}
