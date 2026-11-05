'use client';

import React, { useState } from 'react';
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

interface SubmissionDetail {
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

export default function CandidateSubmissionReviewPage() {
  const params = useParams();
  const submissionId = String(params?.id || 'sub-001');

  const [submission, setSubmission] = useState<SubmissionDetail>({
    id: submissionId,
    candidateName: 'Priya Sharma',
    candidateEmail: 'priya.sharma@example.com',
    assessmentName: 'Full-Stack Distributed Systems Engineer',
    workspaceMode: 'cloud',
    durationMinutes: 82,
    submittedAt: 'Today at 2:15 PM UTC',
    autoSubmitted: false,
    isFinalized: false,
    currentVersion: 1,
    overallScore: 82,
    humanScore: 85,
    notes: 'Candidate showed strong modular architectural patterns and clean domain isolation. Overriding score to 85 reflecting exceptional edge case handling in checkout transaction rollback.',
    releaseResults: false,
    rubricScores: [
      {
        name: 'Code Quality & Clean Architecture',
        weight: 30,
        score: 86,
        confidence: 94,
        rationale:
          'Extracted modular domain services cleanly. Strong TypeScript type definitions, consistent error boundaries, and zero any type escapes.',
        evidence: [
          'src/modules/orders/orders.service.ts#L42-L89',
          'src/modules/orders/dto/order.dto.ts#L10-L35',
        ],
      },
      {
        name: 'System Design & Scalability',
        weight: 25,
        score: 82,
        confidence: 90,
        rationale:
          'Applied an asynchronous event-driven worker model for order processing. Handled transaction rollbacks gracefully on simulate failures.',
        evidence: [
          'src/workers/order-processor.ts#L15-L68',
          'src/database/transactions.ts#L22-L50',
        ],
      },
      {
        name: 'AI Tooling & Prompt Strategy',
        weight: 25,
        score: 80,
        confidence: 92,
        rationale:
          'Effective conversational prompt refinement. Rejected hallucinated packages and instructed AI assistant to follow project strict typing guidelines.',
        evidence: [
          'workspace/transcripts/ai-chat.jsonl#L45-L68',
        ],
      },
      {
        name: 'Production Readiness & Edge Cases',
        weight: 20,
        score: 75,
        confidence: 86,
        rationale:
          'Implemented graceful shutdown handlers and rate limiting middleware. Missing automated unit test for out-of-stock boundary condition.',
        evidence: [
          'src/main.ts#L30-L55',
          'tests/orders.spec.ts#L12-L40',
        ],
        flags: ['Missing boundary condition test for zero inventory checkout'],
      },
    ],
  });

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
              Results Private (BR-20)
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
            Untrusted Candidate Artifacts Notice (BR-18)
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
          {submission.rubricScores.map((item, idx) => (
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
          ))}
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
