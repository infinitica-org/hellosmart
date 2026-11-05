import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import {
  Table,
  AssessmentTable,
  AssessmentRecord,
  SimpleTable,
} from './table';
import { Badge } from './badge';
import { Button } from './button';
import { Avatar } from './avatar';

const meta: Meta<typeof Table> = {
  title: 'Foundation/Table',
  component: Table,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Table>;

const sampleCandidates = [
  {
    id: '1',
    name: 'Sathesh Kumar',
    email: 'sathesh@hellosmart.ai',
    role: 'Full-Stack Lead',
    track: 'Cloud VM',
    status: 'Scored',
    score: 96,
    date: '2026-10-26',
    duration: '52m',
  },
  {
    id: '2',
    name: 'Jane Doe',
    email: 'jane.doe@acme.com',
    role: 'AI Researcher',
    track: 'Cloud VM',
    status: 'In Progress',
    score: 92,
    date: '2026-10-25',
    duration: '34m',
  },
  {
    id: '3',
    name: 'Alex Turner',
    email: 'alex@musiclab.io',
    role: 'Backend Engineer',
    track: 'Chat Workspace',
    status: 'Submitted',
    score: 88,
    date: '2026-10-24',
    duration: '45m',
  },
  {
    id: '4',
    name: 'David Miller',
    email: 'david@cloudcorp.com',
    role: 'DevOps Architect',
    track: 'Cloud VM',
    status: 'Review Needed',
    score: 74,
    date: '2026-10-23',
    duration: '60m',
  },
  {
    id: '5',
    name: 'Emma Watson',
    email: 'emma@talent.co',
    role: 'Frontend Engineer',
    track: 'Chat Workspace',
    status: 'Scored',
    score: 91,
    date: '2026-10-22',
    duration: '40m',
  },
  {
    id: '6',
    name: 'Sarah Connor',
    email: 'sarah@skynet.net',
    role: 'Security Engineer',
    track: 'Cloud VM',
    status: 'Scored',
    score: 98,
    date: '2026-10-21',
    duration: '48m',
  },
  {
    id: '7',
    name: 'John Wick',
    email: 'john@continental.org',
    role: 'Staff SRE',
    track: 'Cloud VM',
    status: 'Review Needed',
    score: 85,
    date: '2026-10-20',
    duration: '58m',
  },
  {
    id: '8',
    name: 'Bruce Wayne',
    email: 'bruce@wayne-enterprises.com',
    role: 'Systems Architect',
    track: 'Cloud VM',
    status: 'Scored',
    score: 99,
    date: '2026-10-19',
    duration: '38m',
  },
];

const mockAssessments: AssessmentRecord[] = [
  {
    id: 'asmt_01',
    candidateName: 'Sathesh Kumar',
    candidateEmail: 'sathesh@hellosmart.ai',
    assessmentName: 'Senior Backend Engineer (Go & PostgreSQL)',
    mode: 'cloud',
    aiPolicy: { enabled: true, spend: '$0.84 / $2.00' },
    status: 'scored',
    score: 96,
    duration: '52m / 60m',
    deadline: 'Oct 28',
    description: 'Build high-throughput idempotent ledger APIs with PostgreSQL advisory locks.',
  },
  {
    id: 'asmt_02',
    candidateName: 'Jane Doe',
    candidateEmail: 'jane.doe@acme.com',
    avatarSrc: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    assessmentName: 'Full-Stack React & AI Agents Developer',
    mode: 'cloud',
    aiPolicy: { enabled: true, spend: '$1.42 / $2.00' },
    status: 'in_progress',
    duration: '34m running',
    deadline: 'Today 6:00 PM',
    description: 'Implement multi-variant UI widgets and real-time streaming AI chat.',
  },
  {
    id: 'asmt_03',
    candidateName: 'Alex Turner',
    candidateEmail: 'alex.t@musiclab.io',
    avatarSrc: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    assessmentName: 'AI Prompt Engineering & Evaluation',
    mode: 'chat',
    aiPolicy: { enabled: true, spend: '$0.35 / $1.00' },
    status: 'submitted',
    score: 88,
    duration: '45m / 45m',
    deadline: 'Completed',
    description: 'Evaluate agent reasoning capabilities and benchmark edge case responses.',
  },
  {
    id: 'asmt_04',
    candidateName: 'David Miller',
    candidateEmail: 'david.m@cloudcorp.com',
    assessmentName: 'Site Reliability & Infrastructure Architect',
    mode: 'cloud',
    aiPolicy: { enabled: false },
    status: 'review_needed',
    score: 74,
    duration: '60m / 60m',
    deadline: 'Review pending',
    description: 'Design zero-downtime Kubernetes deployment pipelines with automated rollback.',
  },
];

const candidateColumns = [
  {
    key: 'name',
    header: 'Candidate',
    sortable: true,
    render: (row: typeof sampleCandidates[0]) => (
      <div className="flex items-center gap-2.5">
        <Avatar size="sm" name={row.name} variant="orange" />
        <div>
          <div className="font-semibold text-neutral-900">{row.name}</div>
          <div className="text-[11px] text-neutral-400 font-mono">{row.email}</div>
        </div>
      </div>
    ),
  },
  {
    key: 'role',
    header: 'Role',
    sortable: true,
  },
  {
    key: 'track',
    header: 'Workspace',
    sortable: true,
    render: (row: typeof sampleCandidates[0]) => (
      <Badge
        variant={row.track === 'Cloud VM' ? 'primary' : 'default'}
        size="sm"
        className="font-mono text-[10px]"
      >
        {row.track}
      </Badge>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    sortable: true,
    render: (row: typeof sampleCandidates[0]) => (
      <Badge
        variant={
          row.status === 'Scored'
            ? 'success'
            : row.status === 'In Progress'
            ? 'primary'
            : row.status === 'Review Needed'
            ? 'warning'
            : 'default'
        }
        dot
        size="sm"
      >
        {row.status}
      </Badge>
    ),
  },
  {
    key: 'score',
    header: 'Score',
    sortable: true,
    align: 'center' as const,
    render: (row: typeof sampleCandidates[0]) => (
      <span
        className={`inline-flex items-center justify-center font-mono font-bold text-xs px-2.5 py-0.5 rounded-full ${
 row.score >= 90
            ? 'bg-success-muted text-success-foreground border border-success-border'
            : row.score >= 80
            ? 'bg-warning-muted text-warning-foreground border border-warning-border'
            : 'bg-danger-muted text-danger-foreground border border-danger-border'
        }`}
      >
        {row.score}/100
      </span>
    ),
  },
  {
    key: 'date',
    header: 'Assessment Date',
    sortable: true,
    align: 'right' as const,
    render: (row: typeof sampleCandidates[0]) => (
      <span className="font-mono text-xs text-neutral-500">{row.date}</span>
    ),
  },
];

const candidateActions = (onAction: (msg: string) => void) => [
  {
    label: 'View Candidate Run',
    onClick: (row: typeof sampleCandidates[0]) => onAction(`Opened workspace run for ${row.name}`),
  },
  {
    label: 'Review Transcripts & Diffs',
    onClick: (row: typeof sampleCandidates[0]) => onAction(`Reviewing AI transcripts & git diffs for ${row.name}`),
  },
  {
    label: 'Override Agent Rubric (BR-20)',
    onClick: (row: typeof sampleCandidates[0]) => onAction(`Opening rubric override editor for ${row.name}`),
  },
  {
    label: 'Release Results to Candidate',
    onClick: (row: typeof sampleCandidates[0]) => onAction(`Released score (${row.score}/100) to ${row.name}`),
    divider: true,
  },
  {
    label: 'Destroy Workspace (BR-22)',
    variant: 'danger' as const,
    onClick: (row: typeof sampleCandidates[0]) => onAction(`Destroyed workspace container for ${row.name}`),
  },
];

// ============================================================================
// 1. Simple Clean Table (Clean Data & Pagination Only)
// ============================================================================
export const SimpleBasicTable: Story = {
  name: '1. Simple Table (Clean Basic UI)',
  render: function SimpleTableBasicDemo() {
    return (
      <div className="space-y-3">
        <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/80 text-xs text-neutral-600">
          <strong className="text-neutral-900 font-semibold">1. Simple Clean Table:</strong> Minimal read-only table with clean borders, avatar badges, status indicators, and pagination navbar. No search, no checkboxes, and no actions.
        </div>

        <SimpleTable
          title="Candidate Roster"
          subtitle="Clean and minimal read-only table view with structured candidate details and page navbar."
          badge="8 Candidates"
          data={sampleCandidates}
          searchable={false}
          selectable={false}
          showSortControl={false}
          pageSize={4}
          pageSizeOptions={[4, 8]}
          columns={candidateColumns.map((col) => ({ ...col, sortable: false }))}
        />
      </div>
    );
  },
};

// ============================================================================
// 2. Table with Actions (Row Menu & Operations)
// ============================================================================
export const TableWithActions: Story = {
  name: '2. Table with Actions (Row Actions Menu)',
  render: function TableWithActionsDemo() {
    const [actionMsg, setActionMsg] = useState('Click any row action menu (...) on the right to test');

    return (
      <div className="space-y-3">
        <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 text-xs text-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span>Last Action Triggered: <strong className="text-primary font-mono">{actionMsg}</strong></span>
          </div>
          <button
            type="button"
            onClick={() => setActionMsg('Cleared')}
            className="text-[11px] text-neutral-500 hover:text-neutral-900 underline cursor-pointer"
          >
            Clear
          </button>
        </div>

        <SimpleTable
          title="Candidate Evaluations"
          subtitle="Row-level action dropdowns enabled for viewing workspaces, reviewing transcripts, and releasing scores."
          badge="Actions Enabled"
          data={sampleCandidates}
          searchable={false}
          selectable={false}
          showSortControl={false}
          pageSize={4}
          pageSizeOptions={[4, 8]}
          columns={candidateColumns.map((col) => ({ ...col, sortable: false }))}
          actions={candidateActions(setActionMsg)}
        />
      </div>
    );
  },
};

// ============================================================================
// 3. Table with Selection & Actions (Checkboxes & Bulk Banner)
// ============================================================================
export const TableWithSelectionAndActions: Story = {
  name: '3. Table with Selection & Actions (Checkboxes & Bulk Bar)',
  render: function TableWithSelectionAndActionsDemo() {
    const [actionMsg, setActionMsg] = useState('None');

    return (
      <div className="space-y-3">
        {actionMsg !== 'None' && (
          <div className="p-3 rounded-xl bg-neutral-100 text-xs font-mono text-neutral-800 flex items-center justify-between border border-neutral-200">
            <span>Action Notice: <strong className="text-primary">{actionMsg}</strong></span>
            <button
              type="button"
              onClick={() => setActionMsg('None')}
              className="text-neutral-500 hover:text-neutral-900 cursor-pointer text-xs"
            >
              Dismiss
            </button>
          </div>
        )}

        <SimpleTable
          title="Candidate Batch Management"
          subtitle="Select candidates with row checkboxes or header checkbox to trigger bulk operations or row-level actions."
          badge="Selectable"
          data={sampleCandidates}
          searchable={false}
          selectable={true}
          showSortControl={false}
          pageSize={4}
          pageSizeOptions={[4, 8]}
          columns={candidateColumns.map((col) => ({ ...col, sortable: false }))}
          actions={candidateActions(setActionMsg)}
          bulkActions={(selectedIds, clear) => (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="orange"
                onClick={() => {
                  setActionMsg(`Exported report for ${selectedIds.length} candidate(s)`);
                  clear();
                }}
              >
                Export Selected ({selectedIds.length})
              </Button>
              <Button
                size="sm"
                variant="outline"
                color="black"
                onClick={() => {
                  setActionMsg(`Bulk notified ${selectedIds.length} candidate(s)`);
                  clear();
                }}
              >
                Bulk Notify
              </Button>
              <Button size="sm" variant="ghost" onClick={clear}>
                Clear Selection
              </Button>
            </div>
          )}
        />
      </div>
    );
  },
};

// ============================================================================
// 4. Table with Sorting (No Selection - Multi & Single Sort)
// ============================================================================
export const TableWithSorting: Story = {
  name: '4. Table with Sorting (No Selection - Multi & Single Sort)',
  render: function TableWithSortingDemo() {
    const [sortMode, setSortMode] = useState<'single' | 'multi'>('multi');

    return (
      <div className="space-y-3">
        <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/80 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-700">
          <div>
            <span className="font-semibold text-neutral-900">💡 Sorting Method Guide:</span>{' '}
            Click any column header to cycle <span className="font-mono text-primary font-bold">Asc (▲) → Desc (▼) → Reset</span>.
            {sortMode === 'multi'
              ? ' Multi-Sort is Active: click multiple columns to stack sort keys (#1, #2).'
              : ' Single-Sort is Active: sorting a new column resets previous columns.'}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-neutral-500 font-medium">Mode:</span>
            <button
              type="button"
              onClick={() => setSortMode((m) => (m === 'single' ? 'multi' : 'single'))}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer border transition-colors ${
 sortMode === 'multi'
                  ? 'bg-primary text-white border-primary shadow-2xs'
                  : 'bg-white text-neutral-800 border-neutral-300 hover:bg-neutral-50'
              }`}
            >
              {sortMode === 'multi' ? 'Multi-Column Sort ON' : 'Single Column Sort'}
            </button>
          </div>
        </div>

        <SimpleTable
          title="Assessment Leaderboard"
          subtitle="Pure sorting method showcase without selection checkboxes. Supports single and multi-column sort with priority indicators."
          badge="Sort Enabled"
          data={sampleCandidates}
          searchable={false}
          selectable={false}
          sortMode={sortMode}
          defaultSort={{ key: 'score', direction: 'desc' }}
          showSortControl={true}
          pageSize={4}
          pageSizeOptions={[4, 8]}
          columns={candidateColumns}
        />
      </div>
    );
  },
};

// ============================================================================
// 5. All Combined Table (Search, Sort, Select, Actions & Pagination)
// ============================================================================
export const AllCombinedTable: Story = {
  name: '5. All Combined Table (Search, Sort, Select, Actions & Navbar)',
  render: function AllCombinedTableDemo() {
    const [actionMsg, setActionMsg] = useState('None');

    return (
      <div className="space-y-3">
        {actionMsg !== 'None' && (
          <div className="p-3 rounded-xl bg-neutral-100 text-xs font-mono text-neutral-800 flex items-center justify-between border border-neutral-200">
            <span>Action Notice: <strong className="text-primary">{actionMsg}</strong></span>
            <button
              type="button"
              onClick={() => setActionMsg('None')}
              className="text-neutral-500 hover:text-neutral-900 cursor-pointer text-xs"
            >
              Dismiss
            </button>
          </div>
        )}

        <SimpleTable
          title="HelloSmart All-in-One Candidate Directory"
          subtitle="Complete powerhouse table with live search filtering, multi-column sorting, row selection with bulk actions, row action menu, and pagination navbar."
          badge="8 Candidates"
          data={sampleCandidates}
          searchable={true}
          searchPlaceholder="Search candidates by name, role, workspace track, status..."
          selectable={true}
          sortMode="multi"
          defaultSort={{ key: 'score', direction: 'desc' }}
          showSortControl={true}
          pageSize={4}
          pageSizeOptions={[4, 8, 12]}
          columns={candidateColumns}
          actions={candidateActions(setActionMsg)}
          bulkActions={(selectedIds, clear) => (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="orange"
                onClick={() => {
                  setActionMsg(`Exported ${selectedIds.length} candidate dossier(s)`);
                  clear();
                }}
              >
                Export Selected ({selectedIds.length})
              </Button>
              <Button
                size="sm"
                variant="outline"
                color="black"
                onClick={() => {
                  setActionMsg(`Invited ${selectedIds.length} candidate(s) to next round`);
                  clear();
                }}
              >
                Invite Next Round
              </Button>
              <Button size="sm" variant="ghost" onClick={clear}>
                Clear
              </Button>
            </div>
          )}
        />
      </div>
    );
  },
};

// ============================================================================
// Optional Bonus: Bento Grid & Candidate Assessment Specialized Views
// ============================================================================
export const BentoGridTable: Story = {
  name: 'Bonus: Bento Grid Floating Tile Table',
  render: () => (
    <AssessmentTable
      variant="bento"
      assessments={mockAssessments}
      title="Candidate Workspaces (Bento Grid)"
      subtitle="Modern tile card layout with floating pill rows and quick KPI stat chips."
      badge="Bento Mode"
    />
  ),
};

export const CandidatePortalTable: Story = {
  name: 'Bonus: Candidate Portal Workspace Table',
  render: () => (
    <AssessmentTable
      variant="candidate"
      assessments={mockAssessments}
      title="My Assigned Assessments"
      subtitle="Candidate assessment portal with direct workspace connect buttons and timer status."
      badge="4 Assigned"
    />
  ),
};
