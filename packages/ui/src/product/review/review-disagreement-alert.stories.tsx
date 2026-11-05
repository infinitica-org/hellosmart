import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { ReviewDisagreementAlert } from './review-disagreement-alert';

const meta: Meta<typeof ReviewDisagreementAlert> = {
  title: 'Domain/Review/ReviewDisagreementAlert',
  component: ReviewDisagreementAlert,
  tags: ['autodocs'],
  args: {
    disagreementItem: 'System Concurrency & Lock Contention',
    agentVariance: 'Agent A scored 90 vs Agent B scored 55',
    onReview: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof ReviewDisagreementAlert>;

export const DefaultVarianceFlagged: Story = {
  args: {},
};

export const WithoutInspectorButton: Story = {
  args: {
    onReview: undefined,
  },
};

