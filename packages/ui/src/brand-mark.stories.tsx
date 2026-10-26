import type { Meta, StoryObj } from '@storybook/react';
import { BrandMark } from './brand-mark';
import { HelloSmartLogo } from './hellosmart/logo';

const meta: Meta<typeof BrandMark> = {
  title: 'Brand/BrandMark',
  component: BrandMark,
  tags: ['autodocs'],
  args: {
    size: 'md',
    whiteLabel: false,
    showLogo: true,
  },
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    whiteLabel: {
      control: 'boolean',
      description: 'Hides "Powered by hellosmart.ai" caption for enterprise white-label customers (BR-28)',
    },
    showLogo: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof BrandMark>;

export const Default: Story = {
  args: {},
};

export const WhiteLabelMode: Story = {
  args: {
    whiteLabel: true,
  },
};

export const SmallSize: Story = {
  args: {
    size: 'sm',
  },
};

export const LargeSize: Story = {
  args: {
    size: 'lg',
  },
};

export const StandaloneLogoAsset: Story = {
  render: () => (
    <div className="flex items-center gap-6 p-6">
      <HelloSmartLogo size="xs" />
      <HelloSmartLogo size="sm" />
      <HelloSmartLogo size="md" />
      <HelloSmartLogo size="lg" />
      <HelloSmartLogo size="xl" />
      <HelloSmartLogo size="md" bgVariant="dark" />
      <HelloSmartLogo size="md" bgVariant="glow" />
    </div>
  ),
};

