import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { AssignmentStatusBadge, type AssignmentStatus } from './assignment-status';

const ALL_STATUSES: AssignmentStatus[] = [
  'invited',
  'window_not_open',
  'ready',
  'in_progress',
  'disconnected',
  'submitted',
  'expired',
  'revoked',
];

const meta: Meta<typeof AssignmentStatusBadge> = {
  title: 'Product/Assessment/AssignmentStatus',
  component: AssignmentStatusBadge,
  tags: ['autodocs'],
  args: {
    status: 'in_progress',
  },
  argTypes: {
    status: {
      control: 'select',
      options: ALL_STATUSES,
      description: 'Candidate assessment assignment lifecycle status per Section 7.1',
    },
  },
};

export default meta;
type Story = StoryObj<typeof AssignmentStatusBadge>;

export const Default: Story = {
  render: (args) => (
    <div className="p-8 bg-white rounded-2xl border border-neutral-200 shadow-xs flex items-center justify-center">
      <AssignmentStatusBadge {...args} />
    </div>
  ),
};

export const LifecycleMatrix: Story = {
  name: 'Complete Lifecycle States (BRD 7.1)',
  render: () => (
    <div className="p-8 max-w-xl mx-auto bg-white rounded-2xl border border-neutral-200/80 shadow-xs space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {ALL_STATUSES.map((status) => (
          <div
            key={status}
            className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 border border-neutral-200/60"
          >
            <span className="text-xs font-mono text-neutral-500">{status}</span>
            <AssignmentStatusBadge status={status} />
          </div>
        ))}
      </div>
    </div>
  ),
};

