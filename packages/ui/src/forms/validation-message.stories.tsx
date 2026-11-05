import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ValidationMessage } from './validation-message';

const meta: Meta<typeof ValidationMessage> = {
  title: 'Forms/ValidationMessage',
  component: ValidationMessage,
  tags: ['autodocs'],
  args: {
    type: 'error',
    children: 'This field is required to proceed.',
  },
  argTypes: {
    type: {
      control: 'select',
      options: ['error', 'warning', 'success', 'info'],
      description: 'Validation feedback message type',
    },
    children: {
      control: 'text',
      description: 'Message content',
    },
  },
};

export default meta;
type Story = StoryObj<typeof ValidationMessage>;

export const Default: Story = {
  render: (args) => (
    <div className="p-6 max-w-md bg-white rounded-xl border border-neutral-200 shadow-xs">
      <ValidationMessage {...args} />
    </div>
  ),
};

export const AllTypes: Story = {
  name: 'All Validation States',
  render: () => (
    <div className="p-6 max-w-md bg-white rounded-xl border border-neutral-200 shadow-xs space-y-4">
      <div>
        <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Error</span>
        <ValidationMessage type="error">
          Please enter a valid work email address (e.g. name@company.com).
        </ValidationMessage>
      </div>
      <div>
        <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Warning</span>
        <ValidationMessage type="warning">
          Password strength is medium. Consider adding a symbol or number.
        </ValidationMessage>
      </div>
      <div>
        <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Success</span>
        <ValidationMessage type="success">
          Workspace environment health check passed successfully.
        </ValidationMessage>
      </div>
      <div>
        <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Info</span>
        <ValidationMessage type="info">
          Countdown timer will start immediately upon first connect (BR-08).
        </ValidationMessage>
      </div>
    </div>
  ),
};

