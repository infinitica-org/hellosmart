import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn, expect, userEvent, within } from '@storybook/test';
import { Button } from './button';

const meta: Meta<typeof Button> = {
  title: 'Foundation/Button',
  component: Button,
  tags: ['autodocs'],
  args: {
    children: 'Button Action',
    onClick: fn(),
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
        'text',
        'link',
      ],
    },
    color: {
      control: 'select',
      options: [undefined, 'orange', 'black', 'white', 'danger', 'success'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    shape: {
      control: 'select',
      options: ['default', 'pill', 'full'],
    },
    rounded: { control: 'boolean' },
    isLoading: { control: 'boolean' },
    disabled: { control: 'boolean' },
    fullWidth: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Primary Action',
  },
};

export const OrangeButton: Story = {
  name: 'Orange (Brand Primary)',
  args: {
    variant: 'orange',
    children: 'Orange Button',
  },
};

export const BlackButton: Story = {
  name: 'Black (Solid Dark)',
  args: {
    variant: 'black',
    children: 'Black Button',
  },
};

export const WhiteButton: Story = {
  name: 'White (Solid Light)',
  args: {
    variant: 'white',
    children: 'White Button',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary Action',
  },
};

export const Outline: Story = {
  args: {
    variant: 'outline',
    children: 'Outline Button',
  },
};

export const Ghost: Story = {
  args: {
    variant: 'ghost',
    children: 'Ghost Button',
  },
};

export const Danger: Story = {
  args: {
    variant: 'danger',
    children: 'Danger Action',
  },
};

export const Success: Story = {
  args: {
    variant: 'success',
    children: 'Success Action',
  },
};

export const TextButton: Story = {
  args: {
    variant: 'text',
    children: 'Text Action',
  },
};

export const LinkButton: Story = {
  args: {
    variant: 'link',
    children: 'View Documentation →',
  },
};

export const AllColorsShowcase: Story = {
  name: 'All Color Variants Showcase',
  render: () => (
    <div className="flex flex-col gap-8 p-6 bg-white rounded-xl border border-neutral-200">
      <div>
        <h4 className="text-sm font-semibold text-neutral-900 mb-1">1. Solid Buttons (All Colors)</h4>
        <p className="text-xs text-neutral-500 mb-4">Direct variants or colors for high-priority calls to action.</p>
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="orange">Orange Brand</Button>
          <Button variant="black">Black / Dark</Button>
          <Button variant="white">White Light</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="success">Success</Button>
        </div>
      </div>

      <div className="pt-6 border-t border-neutral-100">
        <h4 className="text-sm font-semibold text-neutral-900 mb-1">2. Outline Buttons (Color Tuned)</h4>
        <p className="text-xs text-neutral-500 mb-4">Color prop paired with outline style.</p>
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="outline" color="orange">Orange Outline</Button>
          <Button variant="outline" color="black">Black Outline</Button>
          <Button variant="outline">Neutral Outline</Button>
          <Button variant="outline" color="danger">Danger Outline</Button>
          <Button variant="outline" color="success">Success Outline</Button>
        </div>
      </div>

      <div className="pt-6 border-t border-neutral-100">
        <h4 className="text-sm font-semibold text-neutral-900 mb-1">3. Text & Ghost Buttons (Color Tuned)</h4>
        <p className="text-xs text-neutral-500 mb-4">Subtle buttons with colored text and background hover.</p>
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="text" color="orange">Orange Text</Button>
          <Button variant="text" color="black">Black Text</Button>
          <Button variant="text">Neutral Text</Button>
          <Button variant="text" color="danger">Danger Text</Button>
          <Button variant="ghost" color="orange">Orange Ghost</Button>
          <Button variant="ghost" color="black">Black Ghost</Button>
        </div>
      </div>
    </div>
  ),
};

export const RoundedFullPillButtons: Story = {
  name: 'Rounded Full (Pill Buttons)',
  render: () => (
    <div className="flex flex-col gap-6 p-6 bg-white rounded-xl border border-neutral-200">
      <div>
        <h4 className="text-sm font-semibold text-neutral-900 mb-1">Rounded Full Solid Colors</h4>
        <p className="text-xs text-neutral-500 mb-3">Pill-shaped buttons with `shape="full"` or `rounded` prop.</p>
        <div className="flex flex-wrap items-center gap-4">
          <Button shape="full" variant="orange">Orange Full Pill</Button>
          <Button shape="full" variant="black">Black Full Pill</Button>
          <Button shape="full" variant="white">White Full Pill</Button>
          <Button shape="full" variant="secondary">Secondary Full Pill</Button>
          <Button shape="full" variant="danger">Danger Full Pill</Button>
        </div>
      </div>

      <div className="pt-4 border-t border-neutral-100">
        <h4 className="text-sm font-semibold text-neutral-900 mb-1">Rounded Full Outlines</h4>
        <div className="flex flex-wrap items-center gap-4 mt-2">
          <Button shape="full" variant="outline" color="orange">Orange Outline Pill</Button>
          <Button shape="full" variant="outline" color="black">Black Outline Pill</Button>
          <Button shape="full" variant="outline">Neutral Outline Pill</Button>
        </div>
      </div>

      <div className="pt-4 border-t border-neutral-100">
        <h4 className="text-sm font-semibold text-neutral-900 mb-1">Sizes with Rounded Full</h4>
        <div className="flex items-center gap-4 mt-2">
          <Button shape="full" size="sm" variant="orange">Small Pill</Button>
          <Button shape="full" size="md" variant="orange">Medium Pill</Button>
          <Button shape="full" size="lg" variant="orange">Large Pill</Button>
        </div>
      </div>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <Button size="sm" variant="orange">Small Orange</Button>
        <Button size="md" variant="orange">Medium Orange</Button>
        <Button size="lg" variant="orange">Large Orange</Button>
      </div>
      <div className="flex items-center gap-4">
        <Button size="sm" variant="black">Small Black</Button>
        <Button size="md" variant="black">Medium Black</Button>
        <Button size="lg" variant="black">Large Black</Button>
      </div>
    </div>
  ),
};

export const WithIcons: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Button
        variant="orange"
        leftIcon={
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
        }
      >
        Create Task
      </Button>
      <Button
        variant="black"
        rightIcon={
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        }
      >
        Next Step
      </Button>
      <Button
        variant="outline"
        color="orange"
        leftIcon={
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        }
      >
        Preview
      </Button>
    </div>
  ),
};

export const Loading: Story = {
  args: {
    variant: 'orange',
    isLoading: true,
    children: 'Saving Changes...',
  },
};

export const Disabled: Story = {
  args: {
    variant: 'orange',
    disabled: true,
    children: 'Disabled Button',
  },
};

export const FullWidth: Story = {
  args: {
    variant: 'orange',
    fullWidth: true,
    children: 'Full Width Action',
  },
};

export const ClickInteraction: Story = {
  args: {
    variant: 'primary',
    children: 'Click to Verify',
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: /click to verify/i });
    await expect(button).toBeInTheDocument();
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalled();
  },
};
