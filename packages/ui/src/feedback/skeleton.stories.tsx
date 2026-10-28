import type { Meta, StoryObj } from '@storybook/react';
import { Skeleton } from './skeleton';

const meta: Meta<typeof Skeleton> = {
  title: 'Feedback/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
  args: {
    variant: 'rectangular',
    className: 'h-24 w-64',
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['rectangular', 'circular', 'text'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Skeleton>;

export const Rectangular: Story = {
  args: {
    variant: 'rectangular',
    className: 'h-32 w-full max-w-sm',
  },
};

export const CircularAvatar: Story = {
  args: {
    variant: 'circular',
    className: 'h-14 w-14',
  },
};

export const TextLine: Story = {
  args: {
    variant: 'text',
    className: 'max-w-md',
  },
};

export const CardLoadingPlaceholder: Story = {
  render: () => (
    <div className="p-6 max-w-sm bg-white rounded-2xl border border-neutral-200/80 shadow-xs space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton variant="circular" className="h-12 w-12 bg-neutral-200" />
        <div className="space-y-2 flex-1">
          <Skeleton variant="text" className="w-3/4 h-4 bg-neutral-200" />
          <Skeleton variant="text" className="w-1/2 h-3 bg-neutral-200" />
        </div>
      </div>
      <Skeleton variant="rectangular" className="h-28 w-full bg-neutral-100 border border-neutral-200/50" />
      <div className="flex gap-2">
        <Skeleton variant="rectangular" className="h-8 w-20 bg-neutral-200" />
        <Skeleton variant="rectangular" className="h-8 w-24 bg-neutral-200" />
      </div>
    </div>
  ),
};

