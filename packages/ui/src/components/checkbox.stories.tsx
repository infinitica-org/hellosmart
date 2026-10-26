import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import { Checkbox, RadioGroup, RadioGroupItem } from './checkbox';

const meta: Meta<typeof Checkbox> = {
  title: 'Foundation/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  args: {
    label: 'I accept candidate recording terms and AI monitoring policy',
    description: 'Mandatory consent required before workspace connection (BR-12)',
    disabled: false,
    indeterminate: false,
  },
  argTypes: {
    label: { control: 'text' },
    description: { control: 'text' },
    disabled: { control: 'boolean' },
    indeterminate: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {
  args: {},
};

export const Checked: Story = {
  args: {
    defaultChecked: true,
  },
};

export const Indeterminate: Story = {
  args: {
    indeterminate: true,
    label: 'Select all assessments (partial)',
    description: '2 of 5 candidates selected',
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    label: 'Fixed platform restriction',
    description: 'This option cannot be configured by company admin',
  },
};

export const InteractiveToggle: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const checkbox = canvas.getByRole('checkbox');
    await expect(checkbox).not.toBeChecked();
    await userEvent.click(checkbox);
    await expect(checkbox).toBeChecked();
  },
};

export const RadioGroupExample: Story = {
  render: () => (
    <RadioGroup defaultValue="post_session">
      <RadioGroupItem
        value="post_session"
        label="Post-session Reviewer Agents (MMP)"
        description="Independent evaluator agents run asynchronously after session completion"
      />
      <RadioGroupItem
        value="live"
        label="Live Monitoring Agents (Phase 2)"
        description="Real-time candidate interaction evaluation during workspace session"
        disabled
      />
      <RadioGroupItem
        value="manual"
        label="Human Only Review"
        description="Bypasses AI scoring agents; rubric evaluated directly by company reviewers"
      />
    </RadioGroup>
  ),
};

