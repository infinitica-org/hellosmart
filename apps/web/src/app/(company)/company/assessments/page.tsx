'use client';

import React, { useState } from 'react';
import Link from 'next/link';
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
  EmptyState,
} from '@hs/ui';

export interface CompanyAssessment {
  id: string;
  name: string;
  templateVersion: string;
  workspaceMode: 'cloud' | 'chat';
  durationMinutes: number;
  aiPolicy: {
    enabled: boolean;
    allowedModels: string[];
    tokenCap: number;
  };
  status: 'published' | 'draft' | 'closed';
  assignedCandidatesCount: number;
  submissionsCount: number;
  tags: string[];
}

export const INITIAL_ASSESSMENTS: CompanyAssessment[] = [
  {
    id: 'asmt_fullstack_01',
    name: 'Full-Stack Feature: Collaborative Kanban Board',
    templateVersion: 'v1.4.0',
    workspaceMode: 'cloud',
    durationMinutes: 60,
    aiPolicy: {
      enabled: true,
      allowedModels: ['Claude 3.5 Sonnet', 'GPT-4o'],
      tokenCap: 100000,
    },
    status: 'published',
    assignedCandidatesCount: 8,
    submissionsCount: 5,
    tags: ['Next.js', 'PostgreSQL', 'TypeScript', 'TailwindCSS'],
  },
  {
    id: 'asmt_backend_02',
    name: 'Backend Microservice: Event Ingestion Pipeline',
    templateVersion: 'v1.1.2',
    workspaceMode: 'cloud',
    durationMinutes: 90,
    aiPolicy: {
      enabled: true,
      allowedModels: ['Claude 3.5 Sonnet'],
      tokenCap: 150000,
    },
    status: 'draft',
    assignedCandidatesCount: 0,
    submissionsCount: 0,
    tags: ['Go', 'Docker', 'Redis', 'High-Throughput'],
  },
  {
    id: 'asmt_api_03',
    name: 'API Security & Rate-Limiting Implementation',
    templateVersion: 'v2.0.0',
    workspaceMode: 'cloud',
    durationMinutes: 45,
    aiPolicy: {
      enabled: false,
      allowedModels: [],
      tokenCap: 0,
    },
    status: 'published',
    assignedCandidatesCount: 4,
    submissionsCount: 4,
    tags: ['Node.js', 'Express', 'Security', 'OWASP'],
  },
];

export function CompanyAssessmentsView({
  assessments = INITIAL_ASSESSMENTS,
}: {
  assessments?: CompanyAssessment[];
}) {
  const [list, setList] = useState<CompanyAssessment[]>(assessments);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft' | 'closed'>('all');
  const [selectedAssessment, setSelectedAssessment] = useState<CompanyAssessment | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // New assessment form state
  const [newName, setNewName] = useState('');
  const [newDuration, setNewDuration] = useState('60');
  const [newAiEnabled, setNewAiEnabled] = useState(true);

  const filtered = list.filter((a) => {
    const matchesSearch =
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPublished = list.filter((a) => a.status === 'published').length;
  const totalAssigned = list.reduce((sum, a) => sum + a.assignedCandidatesCount, 0);
  const totalSubmissions = list.reduce((sum, a) => sum + a.submissionsCount, 0);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const created: CompanyAssessment = {
      id: `asmt_${Date.now()}`,
      name: newName.trim(),
      templateVersion: 'v1.0.0',
      workspaceMode: 'cloud',
      durationMinutes: parseInt(newDuration, 10) || 60,
      aiPolicy: {
        enabled: newAiEnabled,
        allowedModels: newAiEnabled ? ['Claude 3.5 Sonnet', 'GPT-4o'] : [],
        tokenCap: newAiEnabled ? 100000 : 0,
      },
      status: 'draft',
      assignedCandidatesCount: 0,
      submissionsCount: 0,
      tags: ['Custom Assessment', 'Cloud VM'],
    };

    setList([created, ...list]);
    setIsCreateOpen(false);
    setNewName('');
    setNewDuration('60');
  };

  return (
    <div className="space-y-6" data-testid="company-assessments-page">
      <PageHeader
        title="Assessments"
        description="Version-pinned blueprints, rubrics, timing windows, and AI policies for candidate evaluations."
        badge={{ text: 'Private Templates (BR-02)', variant: 'info' }}
        data-testid="company-assessments-header"
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            data-testid="create-assessment-btn"
          >
            + Create Assessment
          </Button>
        }
      />

      {/* Assessment Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          label="Total Blueprints"
          value={String(list.length)}
          description="Configured assessment tasks"
          data-testid="stat-total-assessments"
        />
        <StatCard
          label="Published Live"
          value={String(totalPublished)}
          description="Ready for candidate invites"
          data-testid="stat-published-assessments"
        />
        <StatCard
          label="Assigned Candidates"
          value={String(totalAssigned)}
          description="Active invitations issued"
          data-testid="stat-assigned-candidates"
        />
        <StatCard
          label="Submissions Recorded"
          value={String(totalSubmissions)}
          description="Ready for rubric review"
          data-testid="stat-submissions"
        />
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
          <div className="w-full sm:w-72">
            <Input
              placeholder="Search assessments by name or tech stack..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs"
              data-testid="assessments-search-input"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {(['all', 'published', 'draft', 'closed'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                  statusFilter === filter
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
                data-testid={`filter-${filter}`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Assessments Grid */}
      {filtered.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            title="No assessments found"
            description={
              searchQuery
                ? `No assessments match "${searchQuery}".`
                : 'No assessments available in this category.'
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5" data-testid="assessments-grid">
          {filtered.map((asmt) => (
            <Card
              key={asmt.id}
              className="p-6 flex flex-col justify-between space-y-4 hover:border-neutral-300 transition-colors"
              data-testid={`assessment-card-${asmt.id}`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-neutral-900">{asmt.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant={
                          asmt.status === 'published'
                            ? 'success'
                            : asmt.status === 'draft'
                              ? 'warning'
                              : 'default'
                        }
                        size="sm"
                      >
                        {asmt.status}
                      </Badge>
                      <span className="text-xs font-mono text-neutral-500">{asmt.templateVersion}</span>
                      <span className="text-xs text-neutral-400">&bull;</span>
                      <span className="text-xs text-neutral-500 font-medium">
                        ⏱ {asmt.durationMinutes} mins
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {asmt.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded text-[11px] bg-neutral-100 text-neutral-700 font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="p-3 bg-neutral-50 rounded-lg text-xs space-y-1">
                  <div className="flex justify-between items-center text-neutral-600">
                    <span>AI Assistant Policy:</span>
                    <span className="font-semibold text-neutral-900">
                      {asmt.aiPolicy.enabled ? 'Enabled (Governed Proxy)' : 'Disabled (AI OFF, BR-14)'}
                    </span>
                  </div>
                  {asmt.aiPolicy.enabled && (
                    <div className="flex justify-between items-center text-neutral-500 text-[11px]">
                      <span>Candidate Token Cap:</span>
                      <span className="font-mono">{asmt.aiPolicy.tokenCap.toLocaleString()} tokens</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-neutral-600 pt-1 border-t border-neutral-200/60">
                    <span>Active Candidates:</span>
                    <span className="font-medium text-neutral-900">{asmt.assignedCandidatesCount}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
                <Link href="/company/candidates">
                  <Button variant="ghost" size="sm">
                    Invite Candidates &rarr;
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedAssessment(asmt)}
                  data-testid={`inspect-asmt-${asmt.id}`}
                >
                  Inspect Blueprint &rarr;
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Blueprint Inspection Dialog */}
      {selectedAssessment && (
        <Dialog open={Boolean(selectedAssessment)} onClose={() => setSelectedAssessment(null)}>
          <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <DialogTitle>{selectedAssessment.name}</DialogTitle>
                <Badge variant="primary" size="sm">
                  {selectedAssessment.templateVersion}
                </Badge>
              </div>
              <DialogDescription>
                Blueprint ID: <span className="font-mono">{selectedAssessment.id}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-neutral-50 rounded-lg">
                <div>
                  <span className="text-neutral-500 block">Workspace Runtime:</span>
                  <span className="font-semibold text-neutral-900">Cloud VM (Ubuntu, Docker)</span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Timer Window:</span>
                  <span className="font-semibold text-neutral-900">{selectedAssessment.durationMinutes} Minutes (Server-enforced, BR-08)</span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Full-Screen Invariant:</span>
                  <span className="font-semibold text-neutral-900">Required (BR-10)</span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Autosave Recovery:</span>
                  <span className="font-semibold text-neutral-900">RPO &le; 30s (BR-11)</span>
                </div>
              </div>

              <div className="space-y-1 p-3 bg-neutral-50 rounded-lg">
                <span className="font-semibold text-neutral-900 block">AI Governance Proxy (BR-13, BR-15):</span>
                <p className="text-neutral-600">
                  {selectedAssessment.aiPolicy.enabled
                    ? `Candidates may invoke allowed models (${selectedAssessment.aiPolicy.allowedModels.join(', ')}) up to a strict cap of ${selectedAssessment.aiPolicy.tokenCap.toLocaleString()} tokens. Proxy intercepts and logs all prompts and responses.`
                    : 'AI assistant is completely disabled for this task. Workspace egress to known AI domains is blocked.'}
                </p>
              </div>

              <div className="space-y-1 p-3 bg-neutral-50 rounded-lg">
                <span className="font-semibold text-neutral-900 block">Private Blueprint Isolation (BR-02):</span>
                <p className="text-neutral-600">
                  This blueprint is private to your company organization. It is pinned to an immutable commit hash and never shares artifacts across tenants.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setSelectedAssessment(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Create Assessment Dialog */}
      {isCreateOpen && (
        <Dialog open={isCreateOpen} onClose={() => setIsCreateOpen(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Assessment Blueprint</DialogTitle>
              <DialogDescription>
                Configure a new work simulation task from your assigned template blueprints.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreate} className="space-y-4 py-2 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-neutral-700 block">Task Name</label>
                <Input
                  required
                  placeholder="e.g. Distributed Cache Implementation"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="text-xs"
                  data-testid="new-assessment-name-input"
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-neutral-700 block">Duration (Minutes, BR-08)</label>
                <Input
                  type="number"
                  min="15"
                  max="240"
                  value={newDuration}
                  onChange={(e) => setNewDuration(e.target.value)}
                  className="text-xs"
                  data-testid="new-assessment-duration-input"
                />
              </div>

              <div className="p-3 bg-neutral-50 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-neutral-800">Enable AI Proxy Assistant</span>
                  <input
                    type="checkbox"
                    checked={newAiEnabled}
                    onChange={(e) => setNewAiEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
                    data-testid="new-assessment-ai-toggle"
                  />
                </div>
                <p className="text-[11px] text-neutral-500">
                  When enabled, candidates can query the governed AI proxy within configured budget caps (BR-13, BR-15).
                </p>
              </div>

              <DialogFooter className="pt-2">
                <Button variant="ghost" size="sm" type="button" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" data-testid="submit-create-assessment-btn">
                  Create Blueprint
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default function CompanyAssessmentsPage() {
  return <CompanyAssessmentsView />;
}
