import type { Meta, StoryObj } from '@storybook/react';
import { AiUsageIndicator } from './ai-usage-indicator';

const meta: Meta<typeof AiUsageIndicator> = {
  title: 'Domain/Workspace/AiUsageIndicator',
  component: AiUsageIndicator,
  tags: ['autodocs'],
  args: {
    usedTokens: 6420,
    capTokens: 25000,
    unit: 'tokens',
  },
  argTypes: {
    usedTokens: { control: 'number' },
    capTokens: { control: 'number' },
  },
};

export default meta;
type Story = StoryObj<typeof AiUsageIndicator>;

export const NormalBudgetUsage: Story = {
  args: {
    usedTokens: 5200,
    capTokens: 25000,
  },
};

export const WarningAt80Percent: Story = {
  args: {
    usedTokens: 21000,
    capTokens: 25000,
  },
};

export const ExceededAt100Percent: Story = {
  args: {
    usedTokens: 25000,
    capTokens: 25000,
  },
};

