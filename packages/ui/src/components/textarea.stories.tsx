import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import { Textarea } from './textarea';

const meta: Meta<typeof Textarea> = {
  title: 'Foundation/Textarea',
  component: Textarea,
  tags: ['autodocs'],
  args: {
    placeholder: 'Enter a detailed prompt or assessment description...',
    rows: 4,
    disabled: false,
    hasError: false,
  },
  argTypes: {
    hasError: {
      control: 'boolean',
      description: 'Applies error border and focus ring styling',
    },
    disabled: {
      control: 'boolean',
      description: 'Disables textarea input interaction',
    },
    rows: {
      control: 'number',
      description: 'Number of visible text rows',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Textarea>;

export const Default: Story = {
  args: {},
};

export const WithValue: Story = {
  args: {
    defaultValue: 'This assessment requires implementing a full-stack candidate portal with real-time AI evaluation.',
  },
};

export const WithError: Story = {
  args: {
    hasError: true,
    defaultValue: 'Invalid template JSON payload provided.',
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    defaultValue: 'System locked instructions cannot be modified by candidates.',
  },
};

export const InteractiveTyping: Story = {
  args: {
    placeholder: 'Type your feedback here...',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = canvas.getByPlaceholderText('Type your feedback here...');
    await userEvent.click(textarea);
    await userEvent.type(textarea, 'Antigravity AI Reviewer Agent');
    await expect(textarea).toHaveValue('Antigravity AI Reviewer Agent');
  },
};

