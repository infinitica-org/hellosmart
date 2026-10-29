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
    variant: 'orange',
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
    variant: {
      control: 'select',
      options: ['orange', 'subtle', 'neutral', 'dark'],
    },
    status: {
      control: 'select',
      options: [undefined, 'online', 'busy', 'away', 'offline'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Avatar>;

const sampleImages = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80',
];

export const Default: Story = {
  args: {
    name: 'Alex Turner',
    variant: 'orange',
  },
};

export const SolidOrangeTwoLetters: Story = {
  name: 'Solid Orange with 2 Letters',
  render: () => (
    <div className="flex flex-col gap-6 p-4 bg-white rounded-xl border border-neutral-200">
      <div>
        <h4 className="text-sm font-semibold text-neutral-900 mb-1">Full Solid Orange (Brand Primary)</h4>
        <p className="text-xs text-neutral-500 mb-3">High-contrast solid orange background with two-letter initials</p>
        <div className="flex items-center gap-4">
          <Avatar size="sm" name="Sathesh Kumar" variant="orange" status="online" />
          <Avatar size="md" name="Sathesh Kumar" variant="orange" status="online" />
          <Avatar size="lg" name="Sathesh Kumar" variant="orange" status="online" />
          <Avatar size="xl" name="Sathesh Kumar" variant="orange" status="online" />
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-neutral-900 mb-1">Two-Letter Parsing Algorithm</h4>
        <div className="flex items-center gap-4 mt-2">
          <div className="flex flex-col items-center gap-1">
            <Avatar size="lg" name="Jane Doe" variant="orange" />
            <span className="text-[11px] text-neutral-500 font-mono">Jane Doe &rarr; JD</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Avatar size="lg" name="Sathesh" variant="orange" />
            <span className="text-[11px] text-neutral-500 font-mono">Sathesh &rarr; SA</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Avatar size="lg" initials="HS" variant="orange" />
            <span className="text-[11px] text-neutral-500 font-mono">Explicit &rarr; HS</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Avatar size="lg" variant="orange" />
            <span className="text-[11px] text-neutral-500 font-mono">Fallback &rarr; HS</span>
          </div>
        </div>
      </div>
    </div>
  ),
};

export const AllColorVariants: Story = {
  name: 'All Color Variants',
  render: () => (
    <div className="flex items-center gap-6 p-4 bg-white rounded-xl border border-neutral-200">
      <div className="flex flex-col items-center gap-2">
        <Avatar size="lg" name="Sathesh Kumar" variant="orange" status="online" />
        <span className="text-xs font-semibold text-primary">Orange (Default)</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Avatar size="lg" name="Sathesh Kumar" variant="subtle" status="online" />
        <span className="text-xs font-semibold text-neutral-700">Subtle</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Avatar size="lg" name="Sathesh Kumar" variant="neutral" status="online" />
        <span className="text-xs font-semibold text-neutral-700">Neutral</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Avatar size="lg" name="Sathesh Kumar" variant="dark" status="online" />
        <span className="text-xs font-semibold text-neutral-700">Dark</span>
      </div>
    </div>
  ),
};

export const WithStatus: Story = {
  args: {
    name: 'Sarah Connor',
    status: 'online',
    variant: 'orange',
  },
};

export const WithImage: Story = {
  args: {
    name: 'Antigravity Lead',
    src: sampleImages[0],
    status: 'online',
    variant: 'orange',
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Avatar size="xs" name="Alex T" variant="orange" />
      <Avatar size="sm" name="Alex T" variant="orange" />
      <Avatar size="md" name="Alex T" variant="orange" status="online" />
      <Avatar size="lg" name="Alex T" variant="orange" status="busy" />
      <Avatar size="xl" name="Alex T" variant="orange" status="online" />
    </div>
  ),
};

export const Shapes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Avatar shape="circle" size="lg" name="Circle Shape" variant="orange" />
      <Avatar shape="rounded" size="lg" name="Rounded Shape" variant="orange" />
    </div>
  ),
};

export const GroupWithImagesWithoutStatus: Story = {
  name: 'Group: Images (Without Status Tag)',
  render: () => (
    <div className="flex flex-col gap-4 p-4 bg-white rounded-xl border border-neutral-200">
      <div>
        <h4 className="text-sm font-semibold text-neutral-900 mb-1">Clean Image Avatars (No Status Tags)</h4>
        <p className="text-xs text-neutral-500 mb-3">Avatar group rendering photos cleanly without any busy or online indicators.</p>
        <AvatarGroup max={4} size="md">
          <Avatar name="Sarah Connor" src={sampleImages[0]} />
          <Avatar name="Alex Turner" src={sampleImages[1]} />
          <Avatar name="Emma Watson" src={sampleImages[2]} />
          <Avatar name="David Miller" src={sampleImages[3]} />
          <Avatar name="Rachel Green" src={sampleImages[4]} />
        </AvatarGroup>
      </div>

      <div className="pt-2 border-t border-neutral-100">
        <h4 className="text-xs font-semibold text-neutral-700 mb-2">Sizes (Without Status)</h4>
        <div className="flex items-center gap-6">
          <AvatarGroup max={3} size="sm">
            <Avatar name="User 1" src={sampleImages[0]} />
            <Avatar name="User 2" src={sampleImages[1]} />
            <Avatar name="User 3" src={sampleImages[2]} />
            <Avatar name="User 4" src={sampleImages[3]} />
          </AvatarGroup>

          <AvatarGroup max={3} size="lg">
            <Avatar name="User 1" src={sampleImages[0]} />
            <Avatar name="User 2" src={sampleImages[1]} />
            <Avatar name="User 3" src={sampleImages[2]} />
            <Avatar name="User 4" src={sampleImages[3]} />
          </AvatarGroup>
        </div>
      </div>
    </div>
  ),
};

export const GroupWithImagesAndOneStatus: Story = {
  name: 'Group: Images (With 1 Status Tag)',
  render: () => (
    <div className="flex flex-col gap-4 p-4 bg-white rounded-xl border border-neutral-200">
      <div>
        <h4 className="text-sm font-semibold text-neutral-900 mb-1">Images with Single Status Indicator</h4>
        <p className="text-xs text-neutral-500 mb-3">Group of image avatars where the lead or current user has an active status dot.</p>
        <AvatarGroup max={4} size="md">
          <Avatar name="Sarah Connor" src={sampleImages[0]} status="online" />
          <Avatar name="Alex Turner" src={sampleImages[1]} />
          <Avatar name="Emma Watson" src={sampleImages[2]} />
          <Avatar name="David Miller" src={sampleImages[3]} />
          <Avatar name="Rachel Green" src={sampleImages[4]} />
        </AvatarGroup>
      </div>

      <div className="pt-2 border-t border-neutral-100">
        <h4 className="text-xs font-semibold text-neutral-700 mb-2">With Busy Status</h4>
        <AvatarGroup max={3} size="md">
          <Avatar name="Alex Turner" src={sampleImages[1]} status="busy" />
          <Avatar name="Emma Watson" src={sampleImages[2]} />
          <Avatar name="David Miller" src={sampleImages[3]} />
          <Avatar name="Rachel Green" src={sampleImages[4]} />
        </AvatarGroup>
      </div>
    </div>
  ),
};

export const Group: Story = {
  render: () => (
    <div className="flex flex-col gap-6 p-4 bg-white rounded-xl border border-neutral-200">
      <div>
        <h4 className="text-sm font-semibold text-neutral-900 mb-2">1. Image Group (Clean - No Status Tags)</h4>
        <AvatarGroup max={3} size="md">
          <Avatar name="Sarah Connor" src={sampleImages[0]} />
          <Avatar name="Alex Turner" src={sampleImages[1]} />
          <Avatar name="Emma Watson" src={sampleImages[2]} />
          <Avatar name="David Miller" src={sampleImages[3]} />
          <Avatar name="Rachel Green" src={sampleImages[4]} />
        </AvatarGroup>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-neutral-900 mb-2">2. Image Group (With 1 Status Tag)</h4>
        <AvatarGroup max={3} size="md">
          <Avatar name="Sarah Connor" src={sampleImages[0]} status="online" />
          <Avatar name="Alex Turner" src={sampleImages[1]} />
          <Avatar name="Emma Watson" src={sampleImages[2]} />
          <Avatar name="David Miller" src={sampleImages[3]} />
        </AvatarGroup>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-neutral-900 mb-2">3. Mixed Images & Solid Orange Initials</h4>
        <AvatarGroup max={4} size="md">
          <Avatar name="Sarah Connor" src={sampleImages[0]} />
          <Avatar name="Sathesh Kumar" variant="orange" status="online" />
          <Avatar name="Alex Turner" src={sampleImages[1]} />
          <Avatar name="Antigravity Team" variant="orange" />
          <Avatar name="David Miller" src={sampleImages[3]} />
        </AvatarGroup>
      </div>
    </div>
  ),
};
