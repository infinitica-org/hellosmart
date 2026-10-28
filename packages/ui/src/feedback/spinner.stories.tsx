import type { Meta, StoryObj } from '@storybook/react';
import { Spinner } from './spinner';

const meta: Meta<typeof Spinner> = {
  title: 'Feedback/Spinner',
  component: Spinner,
  tags: ['autodocs'],
  args: {
    size: 'md',
    color: 'primary',
    label: 'Loading workspace...',
  },
  argTypes: {
    size: {
      control: 'select',
      options: ['xs', 'sm', 'md', 'lg', 'xl'],
    },
    color: {
      control: 'select',
      options: ['primary', 'white', 'slate'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Spinner>;

export const Default: Story = {
  args: {},
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-6 p-6">
      <Spinner size="xs" label="Extra small" />
      <Spinner size="sm" label="Small" />
      <Spinner size="md" label="Medium" />
      <Spinner size="lg" label="Large" />
      <Spinner size="xl" label="Extra large" />
    </div>
  ),
};

export const ColorVariants: Story = {
  render: () => (
    <div className="flex items-center gap-8 p-6 bg-slate-900 rounded-xl">
      <div className="flex flex-col items-center gap-2">
        <Spinner color="primary" />
        <span className="text-xs text-slate-400">Primary</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Spinner color="white" />
        <span className="text-xs text-slate-400">White</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Spinner color="slate" />
        <span className="text-xs text-slate-400">Slate</span>
      </div>
    </div>
  ),
};

