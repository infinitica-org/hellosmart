import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { EntitlementUsageCard } from './entitlement-usage-card';

const now = Date.now();
const sevenDaysAhead = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
const twoDaysAhead = new Date(now + 2 * 24 * 60 * 60 * 1000).toISOString();

const meta: Meta<typeof EntitlementUsageCard> = {
  title: 'Domain/Organization/EntitlementUsageCard',
  component: EntitlementUsageCard,
  tags: ['autodocs'],
  args: {
    templatesUsed: 3,
    templatesMax: 5,
    candidatesUsed: 14,
    candidatesMax: 20,
    trialEndsAt: sevenDaysAhead,
    onUpgrade: fn(),
  },
  argTypes: {
    templatesUsed: { control: 'number' },
    templatesMax: { control: 'number' },
    candidatesUsed: { control: 'number' },
    candidatesMax: { control: 'number' },
  },
};

export default meta;
type Story = StoryObj<typeof EntitlementUsageCard>;

export const ActiveTrialWithHealthyQuota: Story = {
  args: {},
};

export const CriticalTrialExpiryWarning: Story = {
  args: {
    templatesUsed: 5,
    templatesMax: 5,
    candidatesUsed: 19,
    candidatesMax: 20,
    trialEndsAt: twoDaysAhead,
  },
};

export const QuotaExhausted: Story = {
  args: {
    templatesUsed: 5,
    templatesMax: 5,
    candidatesUsed: 20,
    candidatesMax: 20,
  },
};

