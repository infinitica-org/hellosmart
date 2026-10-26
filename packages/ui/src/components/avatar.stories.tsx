import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Avatar, AvatarGroup } from './avatar';

const meta: Meta<typeof Avatar> = {
  title: 'Foundation/Avatar',
  component: Avatar,
  tags: ['autodocs'],
  args: {
    name: 'Jane Doe',
    size: 'md',
    shape: 'circle',
  },
  argTypes: {
    size: {
      control: 'select',
      options: ['xs', 'sm', 'md', 'lg', 'xl'],
    },
    shape: {
      control: 'select',
      options: ['circle', 'rounded'],
    },
    status: {
      control: 'select',
      options: [undefined, 'online', 'busy', 'away', 'offline'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Avatar>;

export const Default: Story = {
  args: {
    name: 'Alex Turner',
  },
};

export const WithStatus: Story = {
  args: {
    name: 'Sarah Connor',
    status: 'online',
  },
};

export const WithImage: Story = {
  args: {
    name: 'Antigravity Lead',
    src: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    status: 'online',
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Avatar size="xs" name="Alex T" />
      <Avatar size="sm" name="Alex T" />
      <Avatar size="md" name="Alex T" status="online" />
      <Avatar size="lg" name="Alex T" status="busy" />
      <Avatar size="xl" name="Alex T" status="online" />
    </div>
  ),
};

export const Shapes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Avatar shape="circle" size="lg" name="Circle Shape" />
      <Avatar shape="rounded" size="lg" name="Rounded Shape" />
    </div>
  ),
};

export const Group: Story = {
  render: () => (
    <AvatarGroup max={3} size="md">
      <Avatar name="Sarah Connor" status="online" />
      <Avatar name="John Wick" status="busy" />
      <Avatar name="Bruce Wayne" status="offline" />
      <Avatar name="Diana Prince" />
      <Avatar name="Peter Parker" />
    </AvatarGroup>
  ),
};

