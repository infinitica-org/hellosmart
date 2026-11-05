import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';
import { HumanReviewPanel } from './human-review-panel';

const meta: Meta<typeof HumanReviewPanel> = {
  title: 'Domain/Review/HumanReviewPanel',
  component: HumanReviewPanel,
  tags: ['autodocs'],
  args: {
    currentScore: 82,
    initialNotes: 'Candidate demonstrated outstanding system architectural insight and clean Go idiom.',
    isFinalized: false,
    currentVersion: 1,
    releaseResults: false,
    isLoading: false,
    onFinalize: fn(),
  },
  argTypes: {
    currentScore: { control: 'number' },
    isFinalized: { control: 'boolean' },
    currentVersion: { control: 'number' },
    releaseResults: { control: 'boolean' },
    isLoading: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof HumanReviewPanel>;

export const PendingReview: Story = {
  args: {},
};

export const AlreadyFinalizedVersion: Story = {
  args: {
    isFinalized: true,
    currentVersion: 2,
    currentScore: 88,
    releaseResults: true,
    initialNotes: 'Adjusted score after reviewing disagreement alert regarding concurrency model.',
  },
};

export const InteractiveFinalizeWorkflow: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const finalizeBtn = canvas.getByRole('button', { name: /Finalize Review/i });
    await userEvent.click(finalizeBtn);
    expect(args.onFinalize).toHaveBeenCalledWith({
      score: 82,
      notes: 'Candidate demonstrated outstanding system architectural insight and clean Go idiom.',
      release: false,
    });
  },
};

