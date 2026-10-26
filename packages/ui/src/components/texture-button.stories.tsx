import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn, expect, userEvent, within } from '@storybook/test';
import { TextureButton } from './texture-button';

const meta: Meta<typeof TextureButton> = {
  title: 'Foundation/TextureButton',
  component: TextureButton,
  tags: ['autodocs'],
  args: {
    children: 'Explore HelloSmart',
    onClick: fn(),
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'brand', 'accent', 'destructive', 'secondary', 'minimal', 'icon'],
    },
    size: {
      control: 'select',
      options: ['sm', 'default', 'lg', 'pill', 'pillLg', 'hero', 'icon'],
    },
    disabled: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof TextureButton>;

export const Brand: Story = {
  args: {
    variant: 'brand',
    children: 'Get Started →',
  },
};

export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Dark Textured Action',
  },
};

export const Minimal: Story = {
  args: {
    variant: 'minimal',
    children: 'Explore HelloSmart',
  },
};

export const Accent: Story = {
  args: {
    variant: 'accent',
    children: 'Accent Action',
  },
};

export const Destructive: Story = {
  args: {
    variant: 'destructive',
    children: 'Delete Resource',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary Action',
  },
};

export const HeroVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4 p-4 bg-canvas">
      <TextureButton variant="primary" size="hero">
        Get Started →
      </TextureButton>
      <TextureButton variant="minimal" size="hero">
        Explore HelloSmart
      </TextureButton>
      <TextureButton variant="brand" size="pill">
        Book a Demo
      </TextureButton>
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <TextureButton size="sm" variant="brand">Small (sm)</TextureButton>
      <TextureButton size="default" variant="brand">Default</TextureButton>
      <TextureButton size="lg" variant="brand">Large (lg)</TextureButton>
      <TextureButton size="pill" variant="brand">Pill</TextureButton>
      <TextureButton size="pillLg" variant="brand">Pill Large</TextureButton>
      <TextureButton size="hero" variant="brand">Hero</TextureButton>
    </div>
  ),
};

export const AsLink: Story = {
  args: {
    variant: 'brand',
    href: '/login',
    children: 'Sign In Link',
  },
};

export const ClickTest: Story = {
  args: {
    variant: 'brand',
    children: 'Interactive Test',
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const btn = canvas.getByRole('button', { name: /interactive test/i });
    await expect(btn).toBeInTheDocument();
    await userEvent.click(btn);
    await expect(args.onClick).toHaveBeenCalled();
  },
};

