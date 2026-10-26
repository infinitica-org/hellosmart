import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { fn } from '@storybook/test';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from './dialog';
import { Button } from '../components/button';

const meta: Meta<typeof Dialog> = {
  title: 'Overlays/Dialog',
  component: Dialog,
  tags: ['autodocs'],
  args: {
    open: true,
    size: 'md',
    onClose: fn(),
  },
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl', 'full'],
    },
    open: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Dialog>;

export const Default: Story = {
  render: (args) => (
    <Dialog {...args}>
      <DialogHeader>
        <DialogTitle>Provision Organization</DialogTitle>
        <DialogDescription>
          Create a new tenant with initial entitlements and candidate invite caps.
        </DialogDescription>
      </DialogHeader>
      <DialogContent>
        <div className="space-y-3 py-2 text-sm text-slate-300">
          <p>Tenant will be granted Cloud VM assessment capabilities and 20 candidate run tokens.</p>
        </div>
      </DialogContent>
      <DialogFooter>
        <Button variant="ghost" onClick={args.onClose}>Cancel</Button>
        <Button variant="primary">Create Organization</Button>
      </DialogFooter>
    </Dialog>
  ),
};

export const InteractiveOpener: Story = {
  render: function RenderInteractive() {
    const [open, setOpen] = useState(false);
    return (
      <div className="p-8">
        <Button variant="primary" onClick={() => setOpen(true)}>
          Open Modal Dialog
        </Button>
        <Dialog open={open} onClose={() => setOpen(false)} size="md">
          <DialogHeader>
            <DialogTitle>Configure AI Proxy Keys</DialogTitle>
            <DialogDescription>
              Assign per-session tokens or manage default provider keys.
            </DialogDescription>
          </DialogHeader>
          <DialogContent>
            <p className="text-sm text-slate-300">
              Keys are encrypted at rest with AES-256 and never returned in full (BR-16).
            </p>
          </DialogContent>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </Dialog>
      </div>
    );
  },
};
