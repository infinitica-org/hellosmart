import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Badge, StatusIndicator, StatusTag } from './badge';

const meta: Meta<typeof Badge> = {
  title: 'Foundation/Badge',
  component: Badge,
  tags: ['autodocs'],
  args: {
    children: 'Badge Label',
    variant: 'default',
    size: 'sm',
    dot: false,
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'primary', 'success', 'warning', 'danger', 'info'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md'],
    },
    dot: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: {
    variant: 'default',
    children: 'Default Neutral',
  },
};

export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Primary Indigo',
  },
};

export const Success: Story = {
  args: {
    variant: 'success',
    children: 'Passed Assessment',
    dot: true,
  },
};

export const Warning: Story = {
  args: {
    variant: 'warning',
    children: 'Quota Warning (85%)',
    dot: true,
  },
};

export const Danger: Story = {
  args: {
    variant: 'danger',
    children: 'Suspended Account',
    dot: true,
  },
};

export const Info: Story = {
  args: {
    variant: 'info',
    children: 'Cloud Workspace',
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Badge variant="default">Default</Badge>
      <Badge variant="primary">Primary</Badge>
      <Badge variant="success" dot>Success</Badge>
      <Badge variant="warning" dot>Warning</Badge>
      <Badge variant="danger" dot>Danger</Badge>
      <Badge variant="info">Info</Badge>
    </div>
  ),
};

export const StatusIndicators: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <StatusIndicator status="online" ping label="Workspace Active" />
      <StatusIndicator status="busy" label="Agent Running" />
      <StatusIndicator status="idle" label="Idle Timeout" />
      <StatusIndicator status="offline" label="Disconnected" />
      <StatusIndicator status="error" label="Connection Failed" />
    </div>
  ),
};

export const OrganizationStatusTags: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <StatusTag status="provisioned" />
      <StatusTag status="trial_active" />
      <StatusTag status="trial_expired" />
      <StatusTag status="paid_active" />
      <StatusTag status="suspended" />
    </div>
  ),
};

