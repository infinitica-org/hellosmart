import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { fn } from '@storybook/test';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from './dialog';
import { Button } from '../components/button';

const meta: Meta<typeof Dialog> = {
  title: 'Overlays/Dialog',
  component: Dialog,
  tags: ['autodocs'],
  args: {
    open: false,
    size: 'md',
    showCloseButton: true,
    closeOnBackdropClick: true,
    closeOnEscape: true,
    onClose: fn(),
  },
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl', 'full'],
      description: 'Size variant of the modal card',
    },
    open: {
      control: 'boolean',
      description: 'Controls open/close state of the dialog',
    },
    showCloseButton: {
      control: 'boolean',
      description: 'Display top-right accessible close X button',
    },
    closeOnBackdropClick: {
      control: 'boolean',
      description: 'Close dialog when clicking on the backdrop overlay',
    },
    closeOnEscape: {
      control: 'boolean',
      description: 'Close dialog when pressing Escape key',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Dialog>;

/**
 * Default interactive dialog: starts closed and opens smoothly on button click.
 * Has top-right 'X' close button, backdrop click, Escape key, and footer buttons.
 */
export const Default: Story = {
  render: function DefaultStory(args) {
    const [open, setOpen] = useState(false);

    return (
      <div className="flex flex-col items-start gap-4 p-8">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-neutral-900">Modal Dialog Demonstration</h3>
          <p className="text-sm text-neutral-500">
            Click the button below to open the modal dialog. It does not open suddenly or block the screen on page load.
          </p>
        </div>

        <Button variant="primary" onClick={() => setOpen(true)}>
          Open Dialog
        </Button>

        <Dialog
          {...args}
          open={open}
          onClose={() => setOpen(false)}
          onOpenChange={setOpen}
        >
          <DialogHeader>
            <DialogTitle>Provision Organization</DialogTitle>
            <DialogDescription>
              Create a new tenant with initial entitlements and candidate invite caps (BR-04 / BR-05).
            </DialogDescription>
          </DialogHeader>
          <DialogContent>
            <div className="space-y-3 py-2 text-sm text-neutral-700">
              <p>
                Tenant will be granted Cloud VM assessment capabilities and 20 candidate run tokens.
                AI proxy policies will be enforced server-side.
              </p>
              <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 text-xs text-neutral-600">
                <span className="font-semibold text-neutral-800">Plan:</span> Enterprise Trial (90-day retention)
              </div>
            </div>
          </DialogContent>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setOpen(false)}>
              Create Organization
            </Button>
          </DialogFooter>
        </Dialog>
      </div>
    );
  },
};

/**
 * Using the `trigger` prop for zero-boilerplate uncontrolled usage.
 */
export const WithTriggerProp: Story = {
  render: () => (
    <div className="p-8 space-y-4">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-neutral-900">Zero-State Trigger Prop</h3>
        <p className="text-sm text-neutral-500">
          Pass any React element to <code>trigger</code> to automatically handle open/close without manual state.
        </p>
      </div>

      <Dialog
        title="Provision New Customer Tenant"
        description="Configure organization entitlements, candidate run caps, and white-label branding (BR-05)."
        trigger={<Button variant="primary">Launch Provisioning Dialog</Button>}
        footer={
          <div className="flex gap-2 justify-end w-full">
            <Button variant="outline" size="sm">
              Cancel
            </Button>
            <Button variant="primary" size="sm">
              Confirm Tenant
            </Button>
          </div>
        }
      >
        <div className="py-2 text-sm text-neutral-600 space-y-2">
          <p>
            Convenient direct props support allows declaring <code>title</code>, <code>description</code>,{' '}
            <code>trigger</code>, and <code>footer</code> directly on the Dialog component.
          </p>
          <p className="text-xs text-neutral-400">
            Click outside, click the top-right 'X', or hit Escape to close.
          </p>
        </div>
      </Dialog>
    </div>
  ),
};

/**
 * Size variants demonstration: small, medium, large, extra-large.
 */
export const Sizes: Story = {
  render: function SizesStory() {
    const [activeSize, setActiveSize] = useState<'sm' | 'md' | 'lg' | 'xl' | null>(null);

    return (
      <div className="p-8 space-y-4">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-neutral-900">Dialog Sizes</h3>
          <p className="text-sm text-neutral-500">
            Click any button below to preview the dialog in different responsive sizes.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => setActiveSize('sm')}>
            Open Small (sm)
          </Button>
          <Button variant="outline" onClick={() => setActiveSize('md')}>
            Open Medium (md)
          </Button>
          <Button variant="outline" onClick={() => setActiveSize('lg')}>
            Open Large (lg)
          </Button>
          <Button variant="outline" onClick={() => setActiveSize('xl')}>
            Open Extra Large (xl)
          </Button>
        </div>

        {activeSize && (
          <Dialog
            open={Boolean(activeSize)}
            size={activeSize}
            onClose={() => setActiveSize(null)}
          >
            <DialogHeader>
              <DialogTitle>Dialog Size: {activeSize.toUpperCase()}</DialogTitle>
              <DialogDescription>
                Responsive container styled according to design tokens.
              </DialogDescription>
            </DialogHeader>
            <DialogContent>
              <p className="text-sm text-neutral-600">
                This dialog is currently rendering with size <code>{activeSize}</code>.
              </p>
            </DialogContent>
            <DialogFooter>
              <Button variant="primary" onClick={() => setActiveSize(null)}>
                Got it
              </Button>
            </DialogFooter>
          </Dialog>
        )}
      </div>
    );
  },
};
