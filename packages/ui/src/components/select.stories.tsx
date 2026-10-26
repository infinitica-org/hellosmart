import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import { Select } from './select';

const mockOptions = [
  { value: 'cloud', label: 'Cloud VM Workspace (Full Linux Shell & IDE)' },
  { value: 'chat', label: 'Chat Only Workspace (AI Agent Simulation)' },
  { value: 'local', label: 'Local Development CLI (Phase 2)', disabled: true },
  { value: 'browser', label: 'Browser Sandbox (Phase 2)', disabled: true },
];

const meta: Meta<typeof Select> = {
  title: 'Foundation/Select',
  component: Select,
  tags: ['autodocs'],
  args: {
    placeholder: 'Select assessment workspace mode...',
    options: mockOptions,
    disabled: false,
    hasError: false,
  },
  argTypes: {
    hasError: {
      control: 'boolean',
      description: 'Highlights select input in error state',
    },
    disabled: {
      control: 'boolean',
      description: 'Disables select dropdown interaction',
    },
    placeholder: {
      control: 'text',
      description: 'Placeholder label for unselected option',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Select>;

export const Default: Story = {
  args: {},
};

export const Preselected: Story = {
  args: {
    defaultValue: 'cloud',
  },
};

export const WithError: Story = {
  args: {
    hasError: true,
    defaultValue: '',
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    defaultValue: 'cloud',
  },
};

export const InteractiveSelection: Story = {
  args: {
    placeholder: 'Choose mode...',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const select = canvas.getByRole('combobox');
    await userEvent.selectOptions(select, 'chat');
    await expect(select).toHaveValue('chat');
  },
};

