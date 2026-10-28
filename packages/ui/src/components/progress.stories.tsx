import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Progress } from './progress';

const meta: Meta<typeof Progress> = {
  title: 'Foundation/Progress',
  component: Progress,
  tags: ['autodocs'],
  args: {
    value: 65,
    max: 100,
    variant: 'primary',
    size: 'md',
    label: 'Session Duration Elapsed',
    showValue: true,
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'success', 'warning', 'danger'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    value: { control: { type: 'range', min: 0, max: 100, step: 1 } },
  },
};

export default meta;
type Story = StoryObj<typeof Progress>;

export const Default: Story = {};

export const SuccessState: Story = {
  args: {
    value: 100,
    variant: 'success',
    label: 'Assessment Rubric Evaluation Completed',
    showValue: true,
  },
};

export const WarningQuota: Story = {
  args: {
    value: 85,
    variant: 'warning',
    label: 'AI Token Quota Usage (BR-15)',
    showValue: true,
  },
};

export const DangerNearExpiry: Story = {
  args: {
    value: 95,
    variant: 'danger',
    label: 'Workspace Expiry Time Limit Approaching',
    showValue: true,
  },
};

export const AllSizes: Story = {
  render: () => (
    <div className="space-y-6 max-w-md">
      <Progress size="sm" value={30} label="Small (sm)" showValue />
      <Progress size="md" value={60} label="Medium (md)" showValue />
      <Progress size="lg" value={90} label="Large (lg)" showValue />
    </div>
  ),
};

