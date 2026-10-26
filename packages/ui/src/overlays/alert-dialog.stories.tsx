import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { fn } from '@storybook/test';
import { AlertDialog, ConfirmationDialog } from './alert-dialog';
import { Button } from '../components/button';

const meta: Meta<typeof AlertDialog> = {
  title: 'Overlays/AlertDialog',
  component: AlertDialog,
  tags: ['autodocs'],
  args: {
    open: true,
    title: 'Destroy Workspace Session?',
    description: 'This will terminate the active Cloud VM container and trigger an immutable final snapshot (BR-22).',
    confirmLabel: 'Destroy Workspace',
    cancelLabel: 'Cancel',
    variant: 'danger',
    loading: false,
    onClose: fn(),
    onConfirm: fn(),
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['danger', 'warning', 'primary'],
    },
    loading: { control: 'boolean' },
    open: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof AlertDialog>;

export const DangerVariant: Story = {
  args: {
    variant: 'danger',
  },
};

export const WarningVariant: Story = {
  args: {
    variant: 'warning',
    title: 'Finalize Assessment Scores?',
    description: 'Finalizing will lock all agent evaluations. Subsequent edits will create a new versioned entry (BR-20).',
    confirmLabel: 'Finalize Scores',
  },
};

export const LoadingState: Story = {
  args: {
    loading: true,
    confirmLabel: 'Destroying...',
  },
};

export const ConfirmationDialogWrapper: Story = {
  render: function RenderConfirmation() {
    const [open, setOpen] = useState(false);
    return (
      <div className="p-8">
        <Button variant="danger" onClick={() => setOpen(true)}>
          Trigger Destructive Action
        </Button>
        <ConfirmationDialog
          open={open}
          onClose={() => setOpen(false)}
          onConfirm={() => {
            alert('Confirmed!');
            setOpen(false);
          }}
          title="Revoke Candidate Access"
          description="Are you sure you want to revoke this candidate invitation? This action cannot be undone."
          confirmLabel="Revoke Invite"
          variant="danger"
        />
      </div>
    );
  },
};

