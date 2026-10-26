import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { StatCard, Timeline, TimelineItem, FilterBar, BulkActionBar } from './stat-card';
import { Button } from './button';

const meta: Meta<typeof StatCard> = {
  title: 'Foundation/StatCard',
  component: StatCard,
  tags: ['autodocs'],
  args: {
    label: 'Total Candidates',
    value: '142',
    description: 'Active pipeline across 3 assessments',
  },
};

export default meta;
type Story = StoryObj<typeof StatCard>;

export const Default: Story = {
  args: {
    label: 'Configured Assessments',
    value: '12',
    description: '4 published, 8 drafts',
  },
};

export const WithPositiveTrend: Story = {
  args: {
    label: 'Submissions Scored',
    value: '89',
    trend: { value: '+24% this week', direction: 'up' },
    description: 'Zero reviewer agent disagreements',
  },
};

export const WithNegativeTrend: Story = {
  args: {
    label: 'Average Completion Time',
    value: '42m',
    trend: { value: '-8m vs benchmark', direction: 'down' },
    description: 'Calculated over last 30 sessions',
  },
};

export const MetricGrid: Story = {
  render: () => (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl">
      <StatCard
        label="Invited Candidates"
        value="120"
        trend={{ value: '+14% vs last batch', direction: 'up' }}
        description="Cap: 150 candidates (BR-06)"
      />
      <StatCard
        label="Agent Review Disagreements"
        value="0"
        trend={{ value: '100% agreement', direction: 'neutral' }}
        description="Independent agent consensus"
      />
      <StatCard
        label="Remaining AI Tokens"
        value="2.4M"
        trend={{ value: '82% of quota left', direction: 'up' }}
        description="Governed provider proxy"
      />
    </div>
  ),
};

export const TimelineExample: Story = {
  render: () => (
    <div className="max-w-md bg-white p-6 rounded-2xl border border-neutral-200">
      <Timeline>
        <TimelineItem title="Candidate Invited" time="10:00 AM">
          Email invite sent with expiring link (BR-24)
        </TimelineItem>
        <TimelineItem title="Workspace Connected" time="10:05 AM">
          Requested full screen & verified consent (BR-10, BR-12)
        </TimelineItem>
        <TimelineItem title="Task Auto-Submitted" time="11:05 AM">
          60 minute duration expired, saved final git snapshot
        </TimelineItem>
      </Timeline>
    </div>
  ),
};

export const ToolbarsAndActionBar: Story = {
  render: () => (
    <div className="space-y-4 max-w-2xl">
      <FilterBar>
        <span className="text-xs text-neutral-500 font-medium mr-2">Filter by:</span>
        <Button size="sm" variant="outline">All Roles</Button>
        <Button size="sm" variant="secondary">Engineers</Button>
        <Button size="sm" variant="ghost">Designers</Button>
      </FilterBar>

      <BulkActionBar selectedCount={3} onClear={() => {}}>
        <Button size="sm" variant="primary">Send Assessment Reminders</Button>
        <Button size="sm" variant="danger">Revoke Invites</Button>
      </BulkActionBar>
    </div>
  ),
};

