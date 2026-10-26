import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { CountdownTimer } from './countdown-timer';

// Generate dynamic future target
const now = Date.now();
const oneHourAhead = new Date(now + 60 * 60 * 1000).toISOString();
const tenMinutesAhead = new Date(now + 10 * 60 * 1000).toISOString();
const twoMinutesAhead = new Date(now + 2 * 60 * 1000).toISOString();
const pastDate = new Date(now - 1000).toISOString();

const meta: Meta<typeof CountdownTimer> = {
  title: 'Domain/Assessment/CountdownTimer',
  component: CountdownTimer,
  tags: ['autodocs'],
  args: {
    deadlineUtc: oneHourAhead,
    pauseTimerOnDisconnect: false,
    warningThresholdMinutes: 15,
    onExpire: fn(),
  },
  argTypes: {
    pauseTimerOnDisconnect: {
      control: 'boolean',
      description: 'Defaults to false per BR-09 (timer keeps running on disconnect)',
    },
  },
};

export default meta;
type Story = StoryObj<typeof CountdownTimer>;

export const NormalActiveSession: Story = {
  args: {
    deadlineUtc: oneHourAhead,
  },
};

export const WarningThreshold: Story = {
  args: {
    deadlineUtc: tenMinutesAhead,
    warningThresholdMinutes: 15,
  },
};

export const CriticalThreshold: Story = {
  args: {
    deadlineUtc: twoMinutesAhead,
  },
};

export const ExpiredSession: Story = {
  args: {
    deadlineUtc: pastDate,
  },
};

