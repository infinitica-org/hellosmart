import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { EmptyState } from './empty-state';

const meta: Meta<typeof EmptyState> = {
  title: 'Feedback/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  args: {
    title: 'No Assessments Found',
    description: 'You have not created any assessments yet. Start by selecting a blueprint template assigned to your organization.',
    action: {
      label: 'Create Assessment',
      onClick: fn(),
    },
  },
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const DefaultWithButtonAction: Story = {
  args: {},
};

export const WithLinkAction: Story = {
  args: {
    title: 'No Candidates Enrolled',
    description: 'Invite candidates individually or upload a batch CSV roster to begin evaluation.',
    action: {
      label: 'Invite Candidates',
      href: '/company/candidates/new',
    },
  },
};

export const WithoutAction: Story = {
  args: {
    title: 'No Audit Records',
    description: 'All system and security events will be streamed here in real time once candidates connect.',
    action: undefined,
  },
};

