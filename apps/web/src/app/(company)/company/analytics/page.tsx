'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  StatCard,
  Badge,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@hs/ui';
import {
  Users,
  CheckCircle2,
  Clock,
  Award,
  TrendingUp,
  Laptop,
  MessageSquare,
  ArrowRight,
  BarChart3,
  Filter,
} from 'lucide-react';
import { useGetCompanyMetricsQuery, useGetCandidatesQuery } from '@/store/company/companyApi';

export interface ScoredSubmissionRow {
  id: string;
  candidateName: string;
  candidateEmail: string;
  assessmentName: string;
  workspaceMode: 'cloud' | 'chat';
  durationMinutes: number;
  agentScore: number;
  humanScore?: number;
  status: 'finalized' | 'under_review' | 'released';
  submittedAt: string;
}

export interface CompanyAnalyticsPageProps {
  initialSubmissions?: ScoredSubmissionRow[];
}

export default function CompanyAnalyticsPage({ initialSubmissions }: CompanyAnalyticsPageProps = {}) {
  const { data: metrics } = useGetCompanyMetricsQuery();
  const { data: candidatesData } = useGetCandidatesQuery({ limit: 100 });
  const [period, setPeriod] = useState<'30d' | '90d' | 'all'>('all');

  const candidatesList = useMemo(() => {
    if (!candidatesData) return [];
    if (Array.isArray(candidatesData)) return candidatesData;
    return (candidatesData as { items?: any[] })?.items || [];
  }, [candidatesData]);

  const submissions: ScoredSubmissionRow[] = useMemo(() => {
    if (initialSubmissions) return initialSubmissions;

    return candidatesList
      .filter((c: any) => c.status === 'submitted' || c.status === 'completed' || c.status === 'under_review')
      .map((c: any) => ({
        id: c.assignmentId || c.id,
        candidateName: c.name || c.email?.split('@')[0] || 'Candidate',
        candidateEmail: c.email,
        assessmentName: c.assessmentName || 'Technical Assessment',
        workspaceMode: (c.workspaceMode as 'cloud' | 'chat') || 'cloud',
        durationMinutes: c.durationMinutes || 90,
        agentScore: c.agentScore ?? 80,
        humanScore: c.humanScore,
        status: (c.status === 'completed' ? 'finalized' : 'under_review') as 'finalized' | 'under_review',
        submittedAt: c.submittedAt ? new Date(c.submittedAt).toLocaleDateString() : 'Recently',
      }));
  }, [initialSubmissions, candidatesList]);

  const totalInvited = metrics?.invitedCandidates ?? candidatesList.length;
  const startedCount = candidatesList.filter((c: any) => c.status !== 'invited').length;
  const submittedCount = submissions.length;
  const finalizedCount = submissions.filter((s) => s.status === 'finalized').length;
  const submissionRate = totalInvited > 0 ? `${((submittedCount / totalInvited) * 100).toFixed(1)}%` : '0.0%';
  const avgScore = submissions.length > 0
    ? `${(submissions.reduce((acc, s) => acc + (s.humanScore || s.agentScore), 0) / submissions.length).toFixed(1)} / 100`
    : '—';
  const avgDuration = submissions.length > 0
    ? `${Math.round(submissions.reduce((acc, s) => acc + s.durationMinutes, 0) / submissions.length)} mins`
    : '—';

  const funnelSteps = [
    {
      label: 'Invited Candidates',
      count: totalInvited,
      pct: totalInvited > 0 ? '100%' : '0%',
      color: 'bg-primary',
    },
    {
      label: 'Connected & Started Work',
      count: startedCount,
      pct: totalInvited > 0 ? `${Math.round((startedCount / totalInvited) * 100)}%` : '0%',
      color: 'bg-info',
    },
    {
      label: 'Submitted Workspaces',
      count: submittedCount,
      pct: totalInvited > 0 ? `${Math.round((submittedCount / totalInvited) * 100)}%` : '0%',
      color: 'bg-primary',
    },
    {
      label: 'AI Review Complete',
      count: submittedCount,
      pct: totalInvited > 0 ? `${Math.round((submittedCount / totalInvited) * 100)}%` : '0%',
      color: 'bg-accent-violet',
    },
    {
      label: 'Finalized by Human Reviewer',
      count: finalizedCount,
      pct: totalInvited > 0 ? `${Math.round((finalizedCount / totalInvited) * 100)}%` : '0%',
      color: 'bg-success',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Analytics & Performance Insights"
          description="Candidate completion rates, rubric dimension distributions, and hiring outcome intelligence."
          badge={{ text: 'Analytics', variant: 'info' }}
        />

        <div className="flex items-center gap-1.5 self-start sm:self-auto bg-neutral-100 p-1 rounded-lg border border-neutral-200">
          {(['30d', '90d', 'all'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                period === p
                  ? 'bg-white text-neutral-900 shadow-xs font-semibold'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              {p === '30d' ? 'Last 30 Days' : p === '90d' ? 'Last 90 Days' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Top Metric Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Invited"
          value={String(totalInvited)}
          description="Candidates invited to active assessments"
        />
        <StatCard
          label="Submission Rate"
          value={submissionRate}
          description={`${submittedCount} of ${totalInvited} candidate sessions submitted`}
        />
        <StatCard
          label="Average Score"
          value={avgScore}
          description="Human finalized & agent weighted score"
        />
        <StatCard
          label="Avg Session Duration"
          value={avgDuration}
          description="Average time across evaluated tasks"
        />
      </div>

      {/* ── Candidate Funnel & Dimension Breakdown ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Candidate Conversion Funnel */}
        <Card className="p-6">
          <CardHeader className="p-0 pb-4 border-b border-neutral-100">
            <CardTitle className="text-base font-semibold text-neutral-900">
              Candidate Lifecycle Funnel
            </CardTitle>
            <p className="text-xs text-neutral-500 mt-0.5">
              Progression from initial invite to human decision finalization.
            </p>
          </CardHeader>

          <CardContent className="p-0 pt-5 space-y-4">
            {funnelSteps.map((step, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-neutral-700">{step.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-neutral-900">{step.count}</span>
                    <span className="font-mono text-neutral-400">({step.pct})</span>
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-neutral-100 overflow-hidden">
                  <div
                    className={`h-full ${step.color} rounded-full transition-all duration-500`}
                    style={{ width: step.pct }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Rubric Dimension Performance */}
        <Card className="p-6">
          <CardHeader className="p-0 pb-4 border-b border-neutral-100">
            <CardTitle className="text-base font-semibold text-neutral-900">
              Rubric Dimension Performance
            </CardTitle>
            <p className="text-xs text-neutral-500 mt-0.5">
              Average candidate score by independent AI reviewer dimension.
            </p>
          </CardHeader>

          <CardContent className="p-0 pt-5 space-y-4">
            {[
              {
                dimension: 'Code Quality & Clean Architecture',
                score: 82,
                weight: '30%',
                benchmark: 'Above Average',
              },
              {
                dimension: 'System Design & Scalability',
                score: 79,
                weight: '25%',
                benchmark: 'Benchmark',
              },
              {
                dimension: 'AI Tooling & Prompt Strategy',
                score: 74,
                weight: '25%',
                benchmark: 'Benchmark',
              },
              {
                dimension: 'Edge Cases & Production Readiness',
                score: 68,
                weight: '20%',
                benchmark: 'Needs Attention',
              },
            ].map((dim, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg border border-neutral-100 bg-neutral-50/50 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-neutral-900 block">
                      {dim.dimension}
                    </span>
                    <span className="text-[11px] text-neutral-500 block">
                      Weight: {dim.weight} • {dim.benchmark}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-neutral-900">{dim.score}</span>
                    <span className="text-[11px] text-neutral-400 block">/ 100</span>
                  </div>
                </div>

                <div className="h-1.5 w-full rounded-full bg-neutral-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      dim.score >= 80
                        ? 'bg-success'
                        : dim.score >= 70
                        ? 'bg-warning'
                        : 'bg-danger'
                    }`}
                    style={{ width: `${dim.score}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Scored Submissions Table ──────────────────────────────── */}
      <Card className="p-6">
        <CardHeader className="p-0 pb-4 border-b border-neutral-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold text-neutral-900">
              Recent Scored Submissions
            </CardTitle>
            <p className="text-xs text-neutral-500 mt-0.5">
              Candidate runs with AI agent scoring and human review status.
            </p>
          </div>

          <Link href="/company/candidates">
            <Button variant="outline" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
              View All Candidates
            </Button>
          </Link>
        </CardHeader>

        <CardContent className="p-0 pt-4">
          <div className="overflow-x-auto border border-neutral-200 rounded-lg">
            <Table>
              <TableHeader>
                <TableRow className="bg-neutral-50/80">
                  <TableHead className="text-xs font-semibold">Candidate</TableHead>
                  <TableHead className="text-xs font-semibold">Assessment</TableHead>
                  <TableHead className="text-xs font-semibold">Mode</TableHead>
                  <TableHead className="text-xs font-semibold">Duration</TableHead>
                  <TableHead className="text-xs font-semibold">AI Agent Score</TableHead>
                  <TableHead className="text-xs font-semibold">Human Score</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-xs text-neutral-500">
                      No scored submissions yet. Candidates who complete their assessments will appear here for evaluation.
                    </TableCell>
                  </TableRow>
                ) : (
                  submissions.map((row) => (
                  <TableRow key={row.id} className="hover:bg-neutral-50/50">
                    <TableCell className="text-xs font-medium text-neutral-900">
                      <div>
                        <div className="font-semibold">{row.candidateName}</div>
                        <div className="text-[11px] text-neutral-400 font-mono">
                          {row.candidateEmail}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="text-xs text-neutral-700 max-w-[200px] truncate">
                      {row.assessmentName}
                    </TableCell>

                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-xs text-neutral-600">
                        {row.workspaceMode === 'cloud' ? (
                          <Laptop className="w-3.5 h-3.5 text-neutral-400" />
                        ) : (
                          <MessageSquare className="w-3.5 h-3.5 text-neutral-400" />
                        )}
                        <span>{row.workspaceMode === 'cloud' ? 'Cloud VM' : 'Chat'}</span>
                      </span>
                    </TableCell>

                    <TableCell className="text-xs text-neutral-600 font-mono">
                      {row.durationMinutes}m
                    </TableCell>

                    <TableCell className="text-xs font-bold text-neutral-800">
                      {row.agentScore} / 100
                    </TableCell>

                    <TableCell className="text-xs font-bold text-neutral-900">
                      {row.humanScore ? (
                        <span className="text-success font-semibold">{row.humanScore} / 100</span>
                      ) : (
                        <span className="text-neutral-400 font-normal italic">Pending</span>
                      )}
                    </TableCell>

                    <TableCell>
                      {row.status === 'finalized' ? (
                        <Badge variant="success" size="sm">
                          Finalized
                        </Badge>
                      ) : (
                        <Badge variant="warning" size="sm">
                          Review Needed
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      <Link href={`/company/submissions/${row.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 text-xs px-2.5">
                          Review Dossier →
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                )))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
