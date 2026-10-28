import type { Meta, StoryObj } from '@storybook/react';
import { BrandMark } from './brand-mark';
import { HelloSmartLogo } from './hellosmart/logo';

const meta: Meta<typeof BrandMark> = {
  title: 'Brand/BrandMark',
  component: BrandMark,
  tags: ['autodocs'],
  args: {
    size: 'md',
    variant: 'mixed',
    logoRounded: 'lg',
    fullText: true,
    showSubtitle: true,
    whiteLabel: false,
    showLogo: true,
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['mixed', 'black', 'white'],
      description: 'Color theme: mixed (orange .ai), black (monochrome dark), or white (monochrome light)',
    },
    showSubtitle: {
      control: 'boolean',
      description: 'Toggle subtitle / "Powered by hellosmart.ai" caption on or off',
    },
    logoRounded: {
      control: 'select',
      options: ['none', 'sm', 'md', 'lg', 'xl', 'full'],
      description: 'Border radius applied to logo image/container',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl'],
    },
    fullText: {
      control: 'boolean',
      description: 'Whether full brand text is displayed',
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

export const MixedColorText: Story = {
  args: {
    variant: 'mixed',
    logoRounded: 'lg',
  },
};

export const SolidBlackText: Story = {
  args: {
    variant: 'black',
    logoRounded: 'lg',
  },
};

export const PureWhiteText: Story = {
  args: {
    variant: 'white',
    logoRounded: 'lg',
  },
  render: (args) => (
    <div className="p-6 bg-neutral-950 rounded-2xl border border-neutral-800">
      <BrandMark {...args} />
    </div>
  ),
};

export const AllColorVariantsWithoutSubtitle: Story = {
  render: () => (
    <div className="flex flex-col gap-6 max-w-xl">
      <div className="p-4 bg-white rounded-xl border border-neutral-200 shadow-2xs">
        <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
          1. Mixed Color (No Subtitle)
        </div>
        <BrandMark variant="mixed" size="lg" logoRounded="lg" showSubtitle={false} />
      </div>

      <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 shadow-2xs">
        <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
          2. Solid Black Full Text (No Subtitle)
        </div>
        <BrandMark variant="black" size="lg" logoRounded="lg" showSubtitle={false} />
      </div>

      <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 shadow-md">
        <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
          3. Pure White Full Text (No Subtitle)
        </div>
        <BrandMark variant="white" size="lg" logoRounded="lg" showSubtitle={false} />
      </div>
    </div>
  ),
};

export const MixedColorWithoutSubtitle: Story = {
  args: {
    variant: 'mixed',
    showSubtitle: false,
    logoRounded: 'lg',
  },
};

export const BlackTextWithoutSubtitle: Story = {
  args: {
    variant: 'black',
    showSubtitle: false,
    logoRounded: 'lg',
  },
};

export const WhiteTextWithoutSubtitle: Story = {
  args: {
    variant: 'white',
    showSubtitle: false,
    logoRounded: 'lg',
  },
  render: (args) => (
    <div className="p-6 bg-neutral-950 rounded-2xl border border-neutral-800">
      <BrandMark {...args} />
    </div>
  ),
};

export const AllColorVariantsComparison: Story = {
  render: () => (
    <div className="flex flex-col gap-6 max-w-xl">
      <div className="p-4 bg-white rounded-xl border border-neutral-200 shadow-2xs">
        <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
          1. Mixed Color (With Subtitle)
        </div>
        <BrandMark variant="mixed" size="lg" logoRounded="lg" />
      </div>

      <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 shadow-2xs">
        <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
          2. Solid Black Full Text (With Subtitle)
        </div>
        <BrandMark variant="black" size="lg" logoRounded="lg" />
      </div>

      <div className="p-4 bg-neutral-900 rounded-xl border border-neutral-800 shadow-md">
        <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
          3. Pure White Full Text (With Subtitle)
        </div>
        <BrandMark variant="white" size="lg" logoRounded="lg" />
      </div>
    </div>
  ),
};

export const RoundedImageVariations: Story = {
  render: () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
      <div className="p-4 bg-white rounded-xl border border-neutral-200">
        <div className="text-xs text-neutral-400 mb-2 font-mono">logoRounded="lg" (Default)</div>
        <BrandMark logoRounded="lg" size="lg" showSubtitle={false} />
      </div>
      <div className="p-4 bg-white rounded-xl border border-neutral-200">
        <div className="text-xs text-neutral-400 mb-2 font-mono">logoRounded="xl"</div>
        <BrandMark logoRounded="xl" size="lg" showSubtitle={false} />
      </div>
      <div className="p-4 bg-white rounded-xl border border-neutral-200">
        <div className="text-xs text-neutral-400 mb-2 font-mono">logoRounded="full"</div>
        <BrandMark logoRounded="full" size="lg" showSubtitle={false} />
      </div>
      <div className="p-4 bg-white rounded-xl border border-neutral-200">
        <div className="text-xs text-neutral-400 mb-2 font-mono">logoRounded="none"</div>
        <BrandMark logoRounded="none" size="lg" showSubtitle={false} />
      </div>
    </div>
  ),
};

export const WhiteLabelMode: Story = {
  args: {
    whiteLabel: true,
  },
};

export const VectorLogoVariant: Story = {
  args: {
    logoVariant: 'vector',
    showSubtitle: false,
  },
};

export const StandaloneLogoAsset: Story = {
  render: () => (
    <div className="flex items-center gap-6 p-6">
      <HelloSmartLogo size="xs" rounded="lg" />
      <HelloSmartLogo size="sm" rounded="lg" />
      <HelloSmartLogo size="md" rounded="lg" />
      <HelloSmartLogo size="lg" rounded="lg" />
      <HelloSmartLogo size="xl" rounded="lg" />
      <HelloSmartLogo size="md" variant="vector" rounded="lg" />
      <HelloSmartLogo size="md" bgVariant="dark" rounded="lg" />
      <HelloSmartLogo size="md" bgVariant="glow" rounded="lg" />
    </div>
  ),
};
