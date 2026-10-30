'use client';

import React, { useState } from 'react';
import {
  PageHeader,
  Card,
  Badge,
  Button,
  Input,
  StatCard,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
} from '@hs/ui';

export interface ReviewerAgent {
  id: string;
  name: string;
  version: string;
  mode: 'post_session';
  status: 'active' | 'maintenance' | 'beta';
  goal: string;
  weight: number;
  signals: string[];
  latency: string;
  evidenceAnchor: string;
  levelAnchors: {
    exemplary: string;
    proficient: string;
    developing: string;
    unsatisfactory: string;
  };
}

export const STANDARD_REVIEWER_AGENTS: ReviewerAgent[] = [
  {
    id: 'agent_code_correctness',
    name: 'Code Correctness & Test Suite Agent',
    version: 'v1.2.0',
    mode: 'post_session',
    status: 'active',
    goal: 'Verifies candidate solution correctness by executing automated test suites, verifying edge cases, and checking compiler outputs.',
    weight: 30,
    signals: ['Unit Test Pass Rate', 'Edge Case Coverage', 'Compilation Warnings', 'Regression Suite'],
    latency: '1.2s',
    evidenceAnchor: 'Git diff, test runners output, assertion exit codes',
    levelAnchors: {
      exemplary: 'All tests pass with 100% assertion coverage including boundary conditions.',
      proficient: 'All core functional tests pass; minor edge cases missing.',
      developing: 'Partial test failures or skipped regression scenarios.',
      unsatisfactory: 'Code fails to compile or majority of test suite fails.',
    },
  },
  {
    id: 'agent_tool_governance',
    name: 'AI Tool Governance & Autonomy Agent',
    version: 'v1.1.4',
    mode: 'post_session',
    status: 'active',
    goal: 'Inspects AI proxy assistant interactions, prompt engineering strategy, token efficiency, and autonomous reasoning.',
    weight: 25,
    signals: ['Prompt Specificity', 'Token Consumption', 'Iteration Cadence', 'Context Adaptability'],
    latency: '1.4s',
    evidenceAnchor: 'AI Proxy prompt transcripts (BR-13), response latency, token caps',
    levelAnchors: {
      exemplary: 'Precision prompts, iterative refinement, treats AI as a force multiplier without passive reliance.',
      proficient: 'Effective AI utilization with minor redundant prompt iterations.',
      developing: 'Over-relies on raw LLM copy-paste without critical code verification.',
      unsatisfactory: 'Exceeded model token caps or failed to leverage provided tools.',
    },
  },
  {
    id: 'agent_code_quality',
    name: 'Architecture & Clean Code Agent',
    version: 'v2.0.1',
    mode: 'post_session',
    status: 'active',
    goal: 'Evaluates architectural patterns, cyclomatic complexity, separation of concerns, and clean abstraction boundaries.',
    weight: 20,
    signals: ['Cyclomatic Complexity', 'Naming Semantics', 'Modular Boundaries', 'Dead Code Elimination'],
    latency: '0.9s',
    evidenceAnchor: 'AST parse tree, file organization, linter diagnostics',
    levelAnchors: {
      exemplary: 'Elegant modular design, clean separation of concerns, zero dead code.',
      proficient: 'Sensible project organization, readable naming, standard idioms.',
      developing: 'Monolithic functions with high complexity or inconsistent style.',
      unsatisfactory: 'Spaghetti architecture with deeply nested conditionals and poor readability.',
    },
  },
  {
    id: 'agent_security_audit',
    name: 'Security & Vulnerability Audit Agent',
    version: 'v1.0.3',
    mode: 'post_session',
    status: 'active',
    goal: 'Scans code and terminal invocations for OWASP Top 10 risks, hardcoded credentials, and injection vectors.',
    weight: 15,
    signals: ['Credential Leakage', 'SQL/Command Injection', 'Sanitization Verification', 'Vulnerable Dependencies'],
    latency: '1.1s',
    evidenceAnchor: 'Static analysis patterns, env secret exposure, diff scanner',
    levelAnchors: {
      exemplary: 'Zero security flaws; inputs validated with strict schemas; secrets properly abstracted.',
      proficient: 'Standard input handling without critical vulnerabilities.',
      developing: 'Minor sanitization gaps or unvalidated user inputs.',
      unsatisfactory: 'Hardcoded secrets, plaintext credentials, or direct injection vectors.',
    },
  },
  {
    id: 'agent_session_integrity',
    name: 'Workspace Integrity & Focus Agent',
    version: 'v1.3.2',
    mode: 'post_session',
    status: 'active',
    goal: 'Correlates fullscreen exit events, clipboard paste anomalies, and idle intervals as objective human review evidence (BR-10, BR-20).',
    weight: 10,
    signals: ['Fullscreen Drops (BR-10)', 'Idle Spike Intervals', 'Large Paste Events', 'Focus Lost Triggers'],
    latency: '0.8s',
    evidenceAnchor: 'ActivityEvent stream, fullscreen timestamps, disconnect intervals',
    levelAnchors: {
      exemplary: 'Continuous full-screen focus throughout assessment; steady commit rhythm.',
      proficient: 'Minor momentary focus loss with immediate resume.',
      developing: 'Multiple fullscreen drops or large external paste blocks.',
      unsatisfactory: 'Frequent fullscreen exits and persistent idle intervals flagged for reviewer.',
    },
  },
];

export function AdminAgentsView({
  agents = STANDARD_REVIEWER_AGENTS,
}: {
  agents?: ReviewerAgent[];
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<ReviewerAgent | null>(null);

  const filtered = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.goal.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.signals.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  return (
    <div className="space-y-6" data-testid="admin-agents-page">
      <PageHeader
        title="Reviewer Agent Library"
        description="Inspect and configure independent evaluation agents, rubric anchor dimensions, and aggregator thresholds."
        badge={{ text: 'Agent Service (BR-18)', variant: 'info' }}
        data-testid="admin-agents-header"
      />

      {/* Telemetry Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          label="Active Agents"
          value={String(agents.length)}
          description="Independent evaluation agents"
          data-testid="stat-active-agents"
        />
        <StatCard
          label="Avg Evaluation Latency"
          value="1.1s"
          description="Fast post-session scoring"
          data-testid="stat-avg-latency"
        />
        <StatCard
          label="Evidence Citation Rate"
          value="100%"
          description="Mandatory evidence anchor (BR-18)"
          data-testid="stat-citation-rate"
        />
        <StatCard
          label="Human Agreement"
          value="94.2%"
          description="Correlation with human score"
          data-testid="stat-agreement-rate"
        />
      </div>

      {/* Search Bar */}
      <Card className="p-4">
        <Input
          placeholder="Filter agents by name, signals, or rubric goal..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="text-xs"
          data-testid="agents-search-input"
        />
      </Card>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5" data-testid="agents-grid">
        {filtered.map((agent) => (
          <Card
            key={agent.id}
            className="p-6 flex flex-col justify-between space-y-4 hover:border-neutral-300 transition-colors"
            data-testid={`agent-card-${agent.id}`}
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-neutral-900">{agent.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="primary" size="sm">
                      {agent.version}
                    </Badge>
                    <Badge variant="success" size="sm">
                      {agent.status}
                    </Badge>
                    <span className="text-[11px] text-neutral-500 font-mono">Weight: {agent.weight}%</span>
                  </div>
                </div>
                <div className="text-xs font-mono text-neutral-400 bg-neutral-50 px-2 py-1 rounded">
                  {agent.latency}
                </div>
              </div>

              <p className="text-xs text-neutral-600 leading-relaxed">{agent.goal}</p>

              <div>
                <span className="text-[11px] uppercase tracking-wider font-semibold text-neutral-400 block mb-1.5">
                  Signals Monitored
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {agent.signals.map((sig) => (
                    <span
                      key={sig}
                      className="px-2 py-0.5 rounded text-[11px] bg-neutral-100 text-neutral-700 font-medium"
                    >
                      {sig}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
              <span className="text-[11px] text-neutral-400">Mode: {agent.mode}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedAgent(agent)}
                data-testid={`inspect-agent-${agent.id}`}
              >
                Inspect Agent Details →
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Agent Detail Modal */}
      {selectedAgent && (
        <Dialog open={Boolean(selectedAgent)} onClose={() => setSelectedAgent(null)}>
          <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <DialogTitle>{selectedAgent.name}</DialogTitle>
                <Badge variant="primary" size="sm">
                  {selectedAgent.version}
                </Badge>
              </div>
              <DialogDescription>{selectedAgent.goal}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3 text-xs">
              <div className="p-3 bg-neutral-50 rounded-lg space-y-1">
                <span className="font-semibold text-neutral-800 block">Evidence Anchor (BR-18):</span>
                <span className="text-neutral-600 block">{selectedAgent.evidenceAnchor}</span>
              </div>

              <div className="space-y-2">
                <span className="font-semibold text-neutral-800 block">Rubric Level Anchors (0–100 Scale):</span>
                <div className="space-y-2">
                  <div className="p-2.5 rounded border border-emerald-200 bg-emerald-50/50">
                    <span className="font-semibold text-emerald-800 block">Exemplary (90–100):</span>
                    <span className="text-emerald-950 mt-0.5 block">{selectedAgent.levelAnchors.exemplary}</span>
                  </div>
                  <div className="p-2.5 rounded border border-blue-200 bg-blue-50/50">
                    <span className="font-semibold text-blue-800 block">Proficient (70–89):</span>
                    <span className="text-blue-950 mt-0.5 block">{selectedAgent.levelAnchors.proficient}</span>
                  </div>
                  <div className="p-2.5 rounded border border-amber-200 bg-amber-50/50">
                    <span className="font-semibold text-amber-800 block">Developing (50–69):</span>
                    <span className="text-amber-950 mt-0.5 block">{selectedAgent.levelAnchors.developing}</span>
                  </div>
                  <div className="p-2.5 rounded border border-rose-200 bg-rose-50/50">
                    <span className="font-semibold text-rose-800 block">Unsatisfactory (0–49):</span>
                    <span className="text-rose-950 mt-0.5 block">{selectedAgent.levelAnchors.unsatisfactory}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-600">
                <span className="font-semibold text-neutral-800 block mb-0.5">Human Decision Invariant (BR-20):</span>
                Agent scores and evidence are advisory recommendations for the hiring team. Candidates are never auto-rejected by automated agents.
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setSelectedAgent(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default function AdminAgentsPage() {
  return <AdminAgentsView />;
}
