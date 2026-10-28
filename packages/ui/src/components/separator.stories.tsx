import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Separator } from './separator';

const meta: Meta<typeof Separator> = {
  title: 'Foundation/Separator',
  component: Separator,
  tags: ['autodocs'],
  argTypes: {
    orientation: {
      control: 'select',
      options: ['horizontal', 'vertical'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Separator>;

export const Horizontal: Story = {
  render: () => (
    <div className="max-w-md bg-white p-6 rounded-2xl border border-neutral-200 text-sm">
      <div className="font-medium text-neutral-900">Task Overview</div>
      <div className="text-xs text-neutral-500">Cloud VM Architecture Assessment</div>
      <Separator className="bg-neutral-200" />
      <div className="text-xs text-neutral-600">
        Review the candidate workspace state, terminal history, and git commits.
      </div>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="flex items-center h-8 bg-white p-4 rounded-xl border border-neutral-200 text-xs">
      <span className="font-medium text-neutral-800">HelloSmart</span>
      <Separator orientation="vertical" className="bg-neutral-200 h-4 mx-3" />
      <span className="text-neutral-500">MMP Pipeline</span>
      <Separator orientation="vertical" className="bg-neutral-200 h-4 mx-3" />
      <span className="text-primary font-medium">Tenant Isolation Verified</span>
    </div>
  ),
};

export const WithTitleAndSubtitle: Story = {
  render: () => (
    <div className="max-w-md bg-white p-6 rounded-2xl border border-neutral-200 text-sm space-y-4">
      <div className="text-neutral-800">General Information Section</div>
      <Separator
        title="Candidate Submission"
        subtitle="Snapshot captured at session expiry (BR-11)"
      />
      <div className="text-neutral-800">Reviewer Rubric Scoring Section</div>
      <Separator
        title="AI Evaluation"
        subtitle="Independent grading agent signals"
        textAlign="left"
      />
      <div className="text-xs text-neutral-500">All agent scores citations verified.</div>
    </div>
  ),
};


