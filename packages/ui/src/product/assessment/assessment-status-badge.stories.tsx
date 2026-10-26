import type { Meta, StoryObj } from '@storybook/react';
import { AssessmentStatusBadge, AssessmentStatus } from './assessment-status-badge';
import { AssignmentStatusBadge, AssignmentStatus } from './assignment-status';

const meta: Meta<typeof AssessmentStatusBadge> = {
  title: 'Domain/Assessment/StatusBadge',
  component: AssessmentStatusBadge,
  tags: ['autodocs'],
  args: {
    status: 'published',
  },
  argTypes: {
    status: {
      control: 'select',
      options: ['draft', 'dry_run_passed', 'published', 'closed', 'archived'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof AssessmentStatusBadge>;

export const Default: Story = {
  args: {
    status: 'published',
  },
};

export const AllAssessmentStatuses: Story = {
  render: () => {
    const statuses: AssessmentStatus[] = ['draft', 'dry_run_passed', 'published', 'closed', 'archived'];
    return (
      <div className="flex flex-wrap items-center gap-3 p-4">
        {statuses.map((s) => (
          <AssessmentStatusBadge key={s} status={s} />
        ))}
      </div>
    );
  },
};

export const AllAssignmentStatuses: Story = {
  render: () => {
    const statuses: AssignmentStatus[] = [
      'invited',
      'window_not_open',
      'ready',
      'in_progress',
      'disconnected',
      'submitted',
      'expired',
      'revoked',
    ];
    return (
      <div className="flex flex-wrap items-center gap-3 p-4">
        {statuses.map((s) => (
          <AssignmentStatusBadge key={s} status={s} />
        ))}
      </div>
    );
  },
};

