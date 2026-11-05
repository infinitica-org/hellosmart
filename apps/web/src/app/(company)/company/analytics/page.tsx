'use client';

import React, { useState } from 'react';
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
import { useGetCompanyMetricsQuery } from '@/store/company/companyApi';

interface ScoredSubmissionRow {
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

export default function CompanyAnalyticsPage() {
  const { data: metrics } = useGetCompanyMetricsQuery();
  const [period, setPeriod] = useState<'30d' | '90d' | 'all'>('all');

  const submissions: ScoredSubmissionRow[] = [
    {
      id: 'sub-001',
      candidateName: 'Priya Sharma',
      candidateEmail: 'priya.sharma@example.com',
      assessmentName: 'Full-Stack Distributed Systems Engineer',
      workspaceMode: 'cloud',
      durationMinutes: 82,
      agentScore: 88,
      humanScore: 90,
      status: 'finalized',
      submittedAt: 'Today, 2:15 PM',
    },
    {
      id: 'sub-002',
      candidateName: 'Alex Mercer',
      candidateEmail: 'alex.mercer@example.com',
      assessmentName: 'Senior Backend Python Architect',
      workspaceMode: 'cloud',
      durationMinutes: 89,
      agentScore: 76,
      humanScore: 78,
      status: 'finalized',
      submittedAt: 'Yesterday, 6:40 PM',
    },
    {
      id: 'sub-003',
      candidateName: 'Elena Rostova',
      candidateEmail: 'elena.rostova@example.com',
      assessmentName: 'AI Integration Specialist (Chat & Agent)',
      workspaceMode: 'chat',
      durationMinutes: 44,
      agentScore: 84,
      status: 'under_review',
      submittedAt: 'Nov 3, 11:20 AM',
    },
    {
      id: 'sub-004',
      candidateName: 'Marcus Vance',
      candidateEmail: 'marcus.vance@example.com',
      assessmentName: 'Full-Stack Distributed Systems Engineer',
      workspaceMode: 'cloud',
      durationMinutes: 90,
      agentScore: 62,
      humanScore: 65,
      status: 'finalized',
      submittedAt: 'Nov 2, 4:10 PM',
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
          value={String(metrics?.invitedCandidates ?? 12)}
          description="Candidates invited to active assessments"
          trend={{ value: '+18% vs last cycle', direction: 'up' }}
        />
        <StatCard
          label="Submission Rate"
          value="83.3%"
          description="10 of 12 candidate sessions submitted"
          trend={{ value: '+5.2% completion', direction: 'up' }}
        />
        <StatCard
          label="Average Score"
          value="77.5 / 100"
          description="Human finalized & agent weighted score"
          trend={{ value: 'Competent band', direction: 'neutral' }}
        />
        <StatCard
          label="Avg Session Duration"
          value="76 mins"
          description="Average time across 90-min tasks"
          trend={{ value: '-4 mins efficiency', direction: 'down' }}
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
            {[
              { label: 'Invited Candidates', count: 12, pct: '100%', color: 'bg-primary' },
              { label: 'Connected & Started Work', count: 11, pct: '91.6%', color: 'bg-sky-500' },
              { label: 'Submitted Workspaces', count: 10, pct: '83.3%', color: 'bg-indigo-500' },
              { label: 'AI Review Complete', count: 10, pct: '83.3%', color: 'bg-purple-500' },
              { label: 'Finalized by Human Reviewer', count: 7, pct: '58.3%', color: 'bg-emerald-500' },
            ].map((step, idx) => (
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
                        ? 'bg-emerald-500'
                        : dim.score >= 70
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
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
                {submissions.map((row) => (
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
                        <span className="text-emerald-700 font-semibold">{row.humanScore} / 100</span>
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
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
