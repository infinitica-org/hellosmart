import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn, expect, userEvent, within } from '@storybook/test';
import { IconButton } from './icon-button';

const settingsIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const plusIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
  </svg>
);

const deleteIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
);

const meta: Meta<typeof IconButton> = {
  title: 'Foundation/IconButton',
  component: IconButton,
  tags: ['autodocs'],
  args: {
    'aria-label': 'Settings',
    onClick: fn(),
    icon: settingsIcon,
  },
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'primary',
        'orange',
        'black',
        'white',
        'secondary',
        'outline',
        'ghost',
        'danger',
        'success',
      ],
    },
    color: {
      control: 'select',
      options: [undefined, 'orange', 'black', 'white', 'danger', 'success'],
    },
    shape: {
      control: 'select',
      options: ['rounded', 'circle', 'full'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    disabled: { control: 'boolean' },
    isLoading: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof IconButton>;

export const Primary: Story = {
  args: {
    variant: 'primary',
  },
};

export const OrangeCircle: Story = {
  name: 'Orange Circle (Rounded Full)',
  args: {
    variant: 'orange',
    shape: 'circle',
    icon: plusIcon,
    'aria-label': 'Add Item',
  },
};

export const BlackCircle: Story = {
  name: 'Black Circle (Rounded Full)',
  args: {
    variant: 'black',
    shape: 'circle',
    icon: settingsIcon,
    'aria-label': 'Settings',
  },
};

export const WhiteCircle: Story = {
  name: 'White Circle (Rounded Full)',
  args: {
    variant: 'white',
    shape: 'circle',
    icon: settingsIcon,
    'aria-label': 'Settings',
  },
};

export const CircleRoundedFull: Story = {
  name: 'Circle / Rounded Full Gallery',
  render: () => (
    <div className="flex flex-col gap-6 p-6 bg-white rounded-xl border border-neutral-200">
      <div>
        <h4 className="text-sm font-semibold text-neutral-900 mb-1">Circular Solid Colors (`shape="circle"`)</h4>
        <p className="text-xs text-neutral-500 mb-3">Fully rounded circular icon buttons in all brand colors.</p>
        <div className="flex items-center gap-4">
          <IconButton shape="circle" variant="orange" icon={plusIcon} aria-label="Add" />
          <IconButton shape="circle" variant="black" icon={settingsIcon} aria-label="Settings" />
          <IconButton shape="circle" variant="white" icon={settingsIcon} aria-label="Settings" />
          <IconButton shape="circle" variant="secondary" icon={settingsIcon} aria-label="Settings" />
          <IconButton shape="circle" variant="danger" icon={deleteIcon} aria-label="Delete" />
        </div>
      </div>

      <div className="pt-4 border-t border-neutral-100">
        <h4 className="text-sm font-semibold text-neutral-900 mb-1">Circular Outline & Ghost</h4>
        <div className="flex items-center gap-4 mt-2">
          <IconButton shape="circle" variant="outline" color="orange" icon={plusIcon} aria-label="Add" />
          <IconButton shape="circle" variant="outline" color="black" icon={settingsIcon} aria-label="Settings" />
          <IconButton shape="circle" variant="outline" icon={settingsIcon} aria-label="Settings" />
          <IconButton shape="circle" variant="ghost" color="orange" icon={plusIcon} aria-label="Add" />
          <IconButton shape="circle" variant="ghost" color="black" icon={settingsIcon} aria-label="Settings" />
          <IconButton shape="circle" variant="ghost" icon={settingsIcon} aria-label="Settings" />
        </div>
      </div>

      <div className="pt-4 border-t border-neutral-100">
        <h4 className="text-sm font-semibold text-neutral-900 mb-1">Circular Sizes (sm, md, lg)</h4>
        <div className="flex items-center gap-4 mt-2">
          <IconButton shape="circle" size="sm" variant="orange" icon={plusIcon} aria-label="Small" />
          <IconButton shape="circle" size="md" variant="orange" icon={plusIcon} aria-label="Medium" />
          <IconButton shape="circle" size="lg" variant="orange" icon={plusIcon} aria-label="Large" />
          <div className="w-px h-6 bg-neutral-200" />
          <IconButton shape="circle" size="sm" variant="black" icon={settingsIcon} aria-label="Small" />
          <IconButton shape="circle" size="md" variant="black" icon={settingsIcon} aria-label="Medium" />
          <IconButton shape="circle" size="lg" variant="black" icon={settingsIcon} aria-label="Large" />
        </div>
      </div>
    </div>
  ),
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
  },
};

export const Ghost: Story = {
  args: {
    variant: 'ghost',
  },
};

export const Danger: Story = {
  args: {
    variant: 'danger',
    'aria-label': 'Delete assessment',
    icon: deleteIcon,
  },
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-center gap-3">
      <IconButton {...args} size="sm" aria-label="Small" />
      <IconButton {...args} size="md" aria-label="Medium" />
      <IconButton {...args} size="lg" aria-label="Large" />
    </div>
  ),
};

export const ClickTest: Story = {
  args: {
    variant: 'secondary',
    'aria-label': 'Click test button',
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const btn = canvas.getByRole('button', { name: /click test button/i });
    await expect(btn).toBeInTheDocument();
    await userEvent.click(btn);
    await expect(args.onClick).toHaveBeenCalled();
  },
};
