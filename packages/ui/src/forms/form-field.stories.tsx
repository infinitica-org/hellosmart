import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import {
  FormField,
  TextField,
  PasswordField,
  TextAreaField,
  SelectField,
  CheckboxField,
} from './form-field';
import { ValidationMessage } from './validation-message';

const meta: Meta<typeof FormField> = {
  title: 'Forms/FormField & Fields',
  component: FormField,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof FormField>;

export const TextFieldExample: Story = {
  render: () => (
    <div className="max-w-md space-y-4">
      <TextField
        id="company-name"
        label="Company Name"
        placeholder="Acme Corporation"
        required
        helperText="Official company name for tenant workspace provisioning."
      />
      <TextField
        id="email-error"
        label="Admin Work Email"
        defaultValue="invalid@"
        errorMessage="Please enter a valid business email address."
        required
      />
    </div>
  ),
};

export const PasswordFieldExample: Story = {
  render: () => (
    <div className="max-w-md space-y-4">
      <PasswordField
        id="admin-password"
        label="Account Password"
        placeholder="••••••••••••"
        required
        helperText="Must be at least 12 characters with symbol and number."
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggleButton = canvas.getByRole('button', { name: /show password/i });
    await expect(toggleButton).toBeInTheDocument();
    await userEvent.click(toggleButton);
    const hideButton = canvas.getByRole('button', { name: /hide password/i });
    await expect(hideButton).toBeInTheDocument();
  },
};

export const TextAreaFieldExample: Story = {
  render: () => (
    <div className="max-w-md space-y-4">
      <TextAreaField
        id="assessment-brief"
        label="Task Scenario Brief"
        placeholder="Describe the real-world problem candidate will solve..."
        rows={4}
        helperText="Markdown instructions shown to candidate upon workspace launch."
      />
    </div>
  ),
};

export const SelectFieldExample: Story = {
  render: () => (
    <div className="max-w-md space-y-4">
      <SelectField
        id="workspace-mode"
        label="Workspace Environment"
        options={[
          { label: 'Cloud VM (Terminal + VS Code + Egress Control)', value: 'cloud' },
          { label: 'Chat Workspace (Governed AI Proxy)', value: 'chat' },
        ]}
        helperText="Mode determines runtime container sandbox (BR-33)."
      />
    </div>
  ),
};

export const CheckboxFieldExample: Story = {
  render: () => (
    <div className="max-w-md space-y-4">
      <CheckboxField
        id="consent-check"
        label="I accept the controlled workspace recording terms"
        description="I understand full screen exit disconnects the session (BR-10)."
        required
      />
    </div>
  ),
};

export const ValidationMessages: Story = {
  render: () => (
    <div className="max-w-md space-y-2">
      <ValidationMessage type="error">This slug is already reserved by another organization (BR-01).</ValidationMessage>
      <ValidationMessage type="warning">Approaching candidate entitlement limit (18/20 used, BR-06).</ValidationMessage>
      <ValidationMessage type="success">Domain routing DNS records verified successfully.</ValidationMessage>
      <ValidationMessage type="info">AI proxy is enabled with capped provider allocation (BR-15).</ValidationMessage>
    </div>
  ),
};

