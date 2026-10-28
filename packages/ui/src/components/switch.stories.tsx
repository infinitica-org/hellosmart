import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';
import { Switch } from './switch';

const meta: Meta<typeof Switch> = {
  title: 'Foundation/Switch',
  component: Switch,
  tags: ['autodocs'],
  args: {
    label: 'Pause Timer On Disconnect',
    description: 'When disabled, candidate countdown timer continues running on disconnect (BR-09)',
    disabled: false,
    defaultChecked: false,
    onChange: fn(),
  },
  argTypes: {
    checked: { control: 'boolean' },
    defaultChecked: { control: 'boolean' },
    disabled: { control: 'boolean' },
    label: { control: 'text' },
    description: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof Switch>;

export const Default: Story = {
  args: {},
};

export const Checked: Story = {
  args: {
    defaultChecked: true,
    label: 'AI Proxy Enabled',
    description: 'Workspaces route LLM queries through HelloSmart security proxy (BR-13)',
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    label: 'Candidate Self-Signup',
    description: 'Disabled per MMP policy (BR-04)',
  },
};

export const InteractiveToggle: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const switchBtn = canvas.getByRole('switch');
    await expect(switchBtn).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(switchBtn);
    await expect(switchBtn).toHaveAttribute('aria-checked', 'true');
  },
};

