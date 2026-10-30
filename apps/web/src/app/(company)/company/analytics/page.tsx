'use client';

import React, { useState } from 'react';
import {
  PageHeader,
  Card,
  Badge,
  Button,
  StatCard,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  ProgressBar,
} from '@hs/ui';

export interface CandidateEvaluationSummary {
  id: string;
  name: string;
  email: string;
  assessmentName: string;
  score: number;
  grade: 'Exemplary' | 'Proficient' | 'Developing' | 'Needs Review';
  tokensUsed: number;
  timeSpentMinutes: number;
  status: 'finalized' | 'agent_ready' | 'pending';
  completedAt: string;
}

export const EVALUATION_SUMMARIES: CandidateEvaluationSummary[] = [
  {
    id: 'sub_001',
    name: 'Elena Rostova',
    email: 'elena@example.com',
    assessmentName: 'Full-Stack Feature: Collaborative Kanban Board',
    score: 94,
    grade: 'Exemplary',
    tokensUsed: 42100,
    timeSpentMinutes: 52,
    status: 'finalized',
    completedAt: '2026-10-29T14:30:00Z',
  },
  {
    id: 'sub_002',
    name: 'Marcus Vance',
    email: 'marcus@example.com',
    assessmentName: 'Full-Stack Feature: Collaborative Kanban Board',
    score: 86,
    grade: 'Proficient',
    tokensUsed: 31500,
    timeSpentMinutes: 48,
    status: 'finalized',
    completedAt: '2026-10-29T17:15:00Z',
  },
  {
    id: 'sub_003',
    name: 'Priya Sharma',
    email: 'priya@example.com',
    assessmentName: 'API Security & Rate-Limiting Implementation',
    score: 91,
    grade: 'Exemplary',
    tokensUsed: 0,
    timeSpentMinutes: 39,
    status: 'finalized',
    completedAt: '2026-10-30T09:45:00Z',
  },
  {
    id: 'sub_004',
    name: 'David Kim',
    email: 'david.k@example.com',
    assessmentName: 'Full-Stack Feature: Collaborative Kanban Board',
    score: 74,
    grade: 'Proficient',
    tokensUsed: 58900,
    timeSpentMinutes: 59,
    status: 'agent_ready',
    completedAt: '2026-10-30T11:20:00Z',
  },
  {
    id: 'sub_005',
    name: 'Chloe Bennett',
    email: 'chloe@example.com',
    assessmentName: 'Full-Stack Feature: Collaborative Kanban Board',
    score: 68,
    grade: 'Developing',
    tokensUsed: 62400,
    timeSpentMinutes: 60,
    status: 'agent_ready',
    completedAt: '2026-10-30T13:05:00Z',
  },
];

export function CompanyAnalyticsView({
  evaluations = EVALUATION_SUMMARIES,
}: {
  evaluations?: CandidateEvaluationSummary[];
}) {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('30d');

  const avgScore = Math.round(
    evaluations.reduce((sum, e) => sum + e.score, 0) / (evaluations.length || 1),
  );
  const avgDuration = Math.round(
    evaluations.reduce((sum, e) => sum + e.timeSpentMinutes, 0) / (evaluations.length || 1),
  );
  const avgTokens = Math.round(
    evaluations.reduce((sum, e) => sum + e.tokensUsed, 0) / (evaluations.length || 1),
  );

  const handleExportCsv = () => {
    const headers = 'Candidate,Email,Assessment,Score,Grade,Tokens,Time (min),Status,Completed\n';
    const rows = evaluations
      .map(
        (e) =>
          `"${e.name}","${e.email}","${e.assessmentName}",${e.score},"${e.grade}",${e.tokensUsed},${e.timeSpentMinutes},"${e.status}","${e.completedAt}"`,
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hellosmart-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6" data-testid="company-analytics-page">
      <PageHeader
        title="Analytics & Hiring Telemetry"
        description="Candidate performance trends, rubric item distributions, and hiring completion metrics."
        badge={{ text: 'Multi-Dimensional Rubric (BR-18)', variant: 'info' }}
        data-testid="company-analytics-header"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-neutral-200 p-0.5 bg-neutral-50 text-xs">
              {(['7d', '30d', 'all'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setTimeRange(r)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    timeRange === r
                      ? 'bg-white shadow-xs text-neutral-900'
                      : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                  data-testid={`time-range-${r}`}
                >
                  {r === 'all' ? 'All Time' : r.toUpperCase()}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              data-testid="export-analytics-btn"
            >
              Export CSV
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          label="Avg Evaluation Score"
          value={`${avgScore} / 100`}
          description="Consensus across rubric agents"
          data-testid="stat-avg-score"
        />
        <StatCard
          label="Completion Rate"
          value="87.5%"
          description="Submitted vs started assignments"
          data-testid="stat-completion-rate"
        />
        <StatCard
          label="Avg Session Duration"
          value={`${avgDuration} mins`}
          description="vs 60 min average timebox"
          data-testid="stat-avg-duration"
        />
        <StatCard
          label="Avg AI Token Usage"
          value={`${Math.round(avgTokens / 1000)}k tokens`}
          description="Per governed session (BR-13)"
          data-testid="stat-avg-tokens"
        />
      </div>

      {/* Rubric Dimension Distribution & Pipeline Funnel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Rubric Dimensions */}
        <Card className="p-6 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">Score by Rubric Dimension</h3>
              <p className="text-xs text-neutral-500 font-normal">
                Multi-agent rubric evaluations with direct evidence citations (BR-18).
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="space-y-1">
              <div className="flex justify-between font-medium">
                <span>Code Correctness & Test Verification</span>
                <span className="font-mono">88%</span>
              </div>
              <ProgressBar value={88} variant="primary" />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between font-medium">
                <span>AI Tool Governance & Autonomy</span>
                <span className="font-mono">79%</span>
              </div>
              <ProgressBar value={79} variant="primary" />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between font-medium">
                <span>Architecture & Modularity</span>
                <span className="font-mono">82%</span>
              </div>
              <ProgressBar value={82} variant="primary" />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between font-medium">
                <span>Security & Sanitization</span>
                <span className="font-mono">91%</span>
              </div>
              <ProgressBar value={91} variant="primary" />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between font-medium">
                <span>Workspace Focus & Session Integrity</span>
                <span className="font-mono">98%</span>
              </div>
              <ProgressBar value={98} variant="primary" />
            </div>
          </div>
        </Card>

        {/* Hiring Funnel Progression */}
        <Card className="p-6 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">Simulation Hiring Funnel</h3>
              <p className="text-xs text-neutral-500 font-normal">
                Real-time candidate progression through the evaluation stages.
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs pt-1">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-50 border border-neutral-200/80">
              <span className="font-medium text-neutral-700">1. Candidates Invited (BR-24)</span>
              <span className="font-semibold text-neutral-900 font-mono">8 Candidates (100%)</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-50 border border-neutral-200/80">
              <span className="font-medium text-neutral-700">2. Workspace Launched (BR-10, BR-12)</span>
              <span className="font-semibold text-neutral-900 font-mono">7 Candidates (87.5%)</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-50 border border-neutral-200/80">
              <span className="font-medium text-neutral-700">3. Work Submitted for Review</span>
              <span className="font-semibold text-neutral-900 font-mono">5 Submissions (71.4%)</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-50 border border-neutral-200/80">
              <span className="font-medium text-neutral-700">4. AI Agent Reports Ready (BR-18)</span>
              <span className="font-semibold text-neutral-900 font-mono">5 Evaluated (100%)</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-primary/5 border border-primary/20">
              <span className="font-semibold text-primary">5. Human Final Decision (BR-20)</span>
              <span className="font-semibold text-primary font-mono">3 Finalized (60%)</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Evaluated Candidates Performance Table */}
      <Card className="overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-neutral-100 flex justify-between items-center">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Recent Evaluated Submissions</h3>
            <p className="text-xs text-neutral-500 font-normal mt-0.5">
              Reviewer agent scores, AI token utilization, and review statuses.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table data-testid="analytics-evaluations-table">
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Assessment Task</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Tokens Used</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Review Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {evaluations.map((ev) => (
                <TableRow key={ev.id} data-testid={`eval-row-${ev.id}`}>
                  <TableCell>
                    <span className="font-semibold text-neutral-900 block text-xs">{ev.name}</span>
                    <span className="text-[11px] text-neutral-400 block">{ev.email}</span>
                  </TableCell>
                  <TableCell className="text-xs text-neutral-700 max-w-xs truncate">
                    {ev.assessmentName}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-semibold text-neutral-900">
                    {ev.score} / 100
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        ev.grade === 'Exemplary'
                          ? 'success'
                          : ev.grade === 'Proficient'
                            ? 'info'
                            : 'warning'
                      }
                      size="sm"
                    >
                      {ev.grade}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-neutral-500">
                    {ev.tokensUsed > 0 ? `${(ev.tokensUsed / 1000).toFixed(1)}k` : 'AI OFF'}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-neutral-500">
                    {ev.timeSpentMinutes} mins
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={ev.status === 'finalized' ? 'success' : 'default'}
                      size="sm"
                    >
                      {ev.status === 'finalized' ? 'Finalized' : 'Agent Ready'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

export default function CompanyAnalyticsPage() {
  return <CompanyAnalyticsView />;
}
