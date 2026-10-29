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
    title: 'Destroy Workspace Session?',
    description:
      'This will terminate the active Cloud VM container and trigger an immutable final snapshot (BR-22).',
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

export const DangerVariantWithTriggerButton: Story = {
  render: (args) => (
    <div className="p-8">
      <AlertDialog
        {...args}
        variant="danger"
        title="Destroy Cloud VM Session?"
        description="Terminating will halt all active containers and preserve state via final snapshot (BR-22)."
        confirmLabel="Destroy Workspace"
        trigger={
          <Button variant="danger">
            Click to Open Danger Dialog
          </Button>
        }
      />
    </div>
  ),
};

export const WarningVariantWithTrigger: Story = {
  render: () => (
    <div className="p-8">
      <AlertDialog
        variant="warning"
        title="Finalize Assessment Scores?"
        description="Finalizing will lock all agent evaluations. Subsequent edits will create a new versioned entry (BR-20)."
        confirmLabel="Finalize Scores"
        onConfirm={() => alert('Scores finalized!')}
        trigger={
          <Button variant="outline" className="border-warning-border text-warning-foreground hover:bg-warning-muted">
            Click to Open Warning Dialog
          </Button>
        }
      />
    </div>
  ),
};

export const ControlledWithExternalButton: Story = {
  render: function RenderControlled() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleConfirm = () => {
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        setOpen(false);
        alert('Action confirmed successfully!');
      }, 1000);
    };

    return (
      <div className="p-8 flex items-center gap-4">
        <Button variant="primary" onClick={() => setOpen(true)}>
          Trigger Confirmation Flow
        </Button>
        <ConfirmationDialog
          open={open}
          loading={loading}
          onClose={() => setOpen(false)}
          onConfirm={handleConfirm}
          title="Release Results to Candidate"
          description="The candidate will be granted read-only access to their completed rubric scores and reviewer feedback."
          confirmLabel="Release Results"
          variant="primary"
        />
      </div>
    );
  },
};
