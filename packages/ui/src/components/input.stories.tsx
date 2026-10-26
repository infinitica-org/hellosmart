import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import { Input } from './input';

const meta: Meta<typeof Input> = {
  title: 'Forms/Input',
  component: Input,
  tags: ['autodocs'],
  args: {
    placeholder: 'Enter candidate email...',
    disabled: false,
    hasError: false,
  },
  argTypes: {
    disabled: { control: 'boolean' },
    hasError: { control: 'boolean' },
    type: {
      control: 'select',
      options: ['text', 'email', 'number', 'password', 'search'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    placeholder: 'e.g. alex.turner@company.com',
  },
};

export const WithIcons: Story = {
  render: () => (
    <div className="space-y-4 max-w-sm">
      <Input
        placeholder="Search candidates or tasks..."
        leftIcon={
          <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        }
      />
      <Input
        placeholder="Annual quota budget"
        rightIcon={<span className="text-xs text-neutral-400 font-mono">USD</span>}
      />
    </div>
  ),
};

export const WithError: Story = {
  args: {
    hasError: true,
    defaultValue: 'invalid-email-format',
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    defaultValue: 'read-only-system-value',
  },
};

export const InteractiveTyping: Story = {
  render: () => {
    const [val, setVal] = useState('');
    return (
      <div className="max-w-sm space-y-2">
        <Input
          placeholder="Type candidate name..."
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onClear={() => setVal('')}
          data-testid="interactive-input"
        />
        <div className="text-xs text-neutral-500 font-mono">Current value: {val}</div>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByTestId('interactive-input');
    await userEvent.type(input, 'Alex Turner');
    await expect(input).toHaveValue('Alex Turner');
  },
};

