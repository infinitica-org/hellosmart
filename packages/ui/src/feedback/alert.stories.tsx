import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { Alert } from './alert';

const meta: Meta<typeof Alert> = {
  title: 'Feedback/Alert',
  component: Alert,
  tags: ['autodocs'],
  args: {
    variant: 'info',
    title: 'Cloud Workspace Connected',
    children: 'Interactive bash terminal and development tools are now operational. Fullscreen mode is enforced.',
    onClose: fn(),
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['info', 'success', 'warning', 'error'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Alert>;

export const Info: Story = {
  args: {
    variant: 'info',
  },
};

export const Success: Story = {
  args: {
    variant: 'success',
    title: 'Assessment Submitted Successfully',
    children: 'All test cases executed and snapshot artifacts archived. Evaluator reviewer agents have been triggered.',
  },
};

export const Warning: Story = {
  args: {
    variant: 'warning',
    title: 'AI Token Budget Alert (80% Reached)',
    children: 'Candidate has consumed 16,000 of 20,000 permitted tokens. Subsequent queries will be rate-limited (BR-15).',
  },
};

export const ErrorStateAlert: Story = {
  args: {
    variant: 'error',
    title: 'Workspace Health Check Failed',
    children: 'Failed to bind port 8080 inside container. Automatic recovery retry scheduled in 30 seconds.',
  },
};

export const WithoutCloseButton: Story = {
  args: {
    variant: 'info',
    title: 'Immutable Version Notice',
    children: 'This assessment template version is published and cannot be modified.',
    onClose: undefined,
  },
};

