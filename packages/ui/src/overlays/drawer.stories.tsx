import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { fn } from '@storybook/test';
import { Drawer, DrawerHeader, DrawerTitle, DrawerDescription, DrawerContent, DrawerFooter } from './drawer';
import { Button } from '../components/button';

const meta: Meta<typeof Drawer> = {
  title: 'Overlays/Drawer',
  component: Drawer,
  tags: ['autodocs'],
  args: {
    open: false,
    position: 'right',
    size: 'md',
    showCloseButton: true,
    closeOnBackdropClick: true,
    closeOnEscape: true,
    onClose: fn(),
  },
  argTypes: {
    position: {
      control: 'select',
      options: ['left', 'right', 'top', 'bottom'],
      description: 'Direction edge from which the drawer slides in',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl', 'full'],
      description: 'Width or height variant of the drawer panel',
    },
    open: {
      control: 'boolean',
      description: 'Controls open/close state of the drawer',
    },
    showCloseButton: {
      control: 'boolean',
      description: 'Display top-right accessible close X button',
    },
    closeOnBackdropClick: {
      control: 'boolean',
      description: 'Close drawer when clicking on the backdrop overlay',
    },
    closeOnEscape: {
      control: 'boolean',
      description: 'Close drawer when pressing Escape key',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Drawer>;

/**
 * Default interactive Right Drawer: starts closed and slides in smoothly from the right on button click.
 * Has top-right accessible close button, backdrop click, Escape key, and footer buttons.
 */
export const RightDrawer: Story = {
  render: function RightDrawerStory(args) {
    const [open, setOpen] = useState(false);

    return (
      <div className="flex flex-col items-start gap-4 p-8">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-neutral-900">Right Drawer / Slide-Over</h3>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-800 border border-orange-200">
              position="right"
            </span>
          </div>
          <p className="text-sm text-neutral-500">
            Click the button below to slide out the right drawer. It stays closed on page load and opens only when clicked.
          </p>
        </div>

        <Button variant="primary" onClick={() => setOpen(true)}>
          Open Right Drawer
        </Button>

        <Drawer
          {...args}
          position="right"
          open={open}
          onClose={() => setOpen(false)}
          onOpenChange={setOpen}
        >
          <DrawerHeader>
            <DrawerTitle>Reviewer Agent Transcript</DrawerTitle>
            <DrawerDescription>
              Detailed inspection of independent agent reasoning and evidence tags (BR-18 / BR-19).
            </DrawerDescription>
          </DrawerHeader>
          <DrawerContent>
            <div className="space-y-4 text-sm text-neutral-800">
              <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-primary-600">Agent: CodeQualityReviewer</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-success-muted text-success-foreground font-medium">
                    Score: 4.8 / 5.0
                  </span>
                </div>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Candidate provided clean modular breakdown, complete cross-tenant isolation, and deterministic test mocks.
                </p>
              </div>

              <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-primary-600">Agent: SecurityReviewer</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-success-muted text-success-foreground font-medium">
                    Score: 5.0 / 5.0
                  </span>
                </div>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  No secrets leaked into client bundles or logs. AI proxy token was scoped strictly to one workspace session (BR-13).
                </p>
              </div>

              <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-800">Telemetry Stream</span>
                  <span className="text-[11px] font-mono text-neutral-400">RPO &le; 30s</span>
                </div>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Continuous terminal history and git snapshot chain saved to cold storage.
                </p>
              </div>
            </div>
          </DrawerContent>
          <DrawerFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setOpen(false)}>
              Close Panel
            </Button>
          </DrawerFooter>
        </Drawer>
      </div>
    );
  },
};

/**
 * Left Drawer: slides in from the left edge.
 */
export const LeftDrawer: Story = {
  render: function LeftDrawerStory() {
    const [open, setOpen] = useState(false);

    return (
      <div className="flex flex-col items-start gap-4 p-8">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-neutral-900">Left Navigation Drawer</h3>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800 border border-blue-200">
              position="left"
            </span>
          </div>
          <p className="text-sm text-neutral-500">
            Slide out navigation or filtering sidebar from the left edge.
          </p>
        </div>

        <Button variant="outline" onClick={() => setOpen(true)}>
          Open Left Drawer
        </Button>

        <Drawer
          position="left"
          open={open}
          onClose={() => setOpen(false)}
          size="md"
        >
          <DrawerHeader>
            <DrawerTitle>Assessment Filter Panel</DrawerTitle>
            <DrawerDescription>Filter candidate cohort by status and score range.</DrawerDescription>
          </DrawerHeader>
          <DrawerContent>
            <div className="space-y-3 text-sm text-neutral-700">
              <label className="block text-xs font-medium text-neutral-600">Candidate Status</label>
              <div className="space-y-2 text-xs">
                {['All Active', 'Submitted (Ready for Human Review)', 'In Progress', 'Invited'].map((label) => (
                  <label key={label} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked={label.startsWith('All')} className="rounded text-primary-500" />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </DrawerContent>
          <DrawerFooter>
            <Button variant="primary" onClick={() => setOpen(false)}>
              Apply Filters
            </Button>
          </DrawerFooter>
        </Drawer>
      </div>
    );
  },
};

/**
 * Bottom Drawer: slides up from the bottom edge (mobile sheet pattern).
 */
export const BottomDrawer: Story = {
  render: function BottomDrawerStory() {
    const [open, setOpen] = useState(false);

    return (
      <div className="flex flex-col items-start gap-4 p-8">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-neutral-900">Bottom Sheet</h3>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-800 border border-purple-200">
              position="bottom"
            </span>
          </div>
          <p className="text-sm text-neutral-500">
            Bottom action sheet useful for quick confirmations or mobile viewports.
          </p>
        </div>

        <Button variant="outline" onClick={() => setOpen(true)}>
          Open Bottom Sheet
        </Button>

        <Drawer
          position="bottom"
          open={open}
          onClose={() => setOpen(false)}
          size="md"
        >
          <DrawerHeader>
            <DrawerTitle>Candidate Workspace Session Actions</DrawerTitle>
            <DrawerDescription>Administrative actions for active candidate run token.</DrawerDescription>
          </DrawerHeader>
          <DrawerContent>
            <div className="space-y-2 text-sm text-neutral-700">
              <p>Choose an action to apply to the running Cloud VM workspace session:</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline">Snapshot State</Button>
                <Button size="sm" variant="outline">Extend Time (+30m)</Button>
                <Button size="sm" variant="danger">Destroy Workspace (BR-22)</Button>
              </div>
            </div>
          </DrawerContent>
          <DrawerFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
          </DrawerFooter>
        </Drawer>
      </div>
    );
  },
};

/**
 * Using the `trigger` prop for zero-boilerplate uncontrolled slide out.
 */
export const WithTriggerProp: Story = {
  render: () => (
    <div className="p-8 space-y-4">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-neutral-900">Zero-State Trigger Prop</h3>
        <p className="text-sm text-neutral-500">
          Pass any React element to <code>trigger</code> to automatically handle slide-out open/close without manual state.
        </p>
      </div>

      <Drawer
        position="right"
        size="md"
        title="Candidate Git Commit History"
        description="Immutable snapshot chain captured during Cloud VM session."
        trigger={<Button variant="outline">Inspect Commits (Slide Out)</Button>}
        footer={<Button size="sm" variant="secondary">Close Inspector</Button>}
      >
        <div className="p-6 space-y-3 text-xs text-neutral-600">
          <div className="p-2.5 rounded-lg border border-neutral-200 bg-neutral-50">
            <div className="font-mono font-semibold text-neutral-900">commit 4e0dd67</div>
            <div className="text-[11px] text-neutral-500 mt-0.5">feat(BR-01): tenant context isolation</div>
          </div>
          <div className="p-2.5 rounded-lg border border-neutral-200 bg-neutral-50">
            <div className="font-mono font-semibold text-neutral-900">commit a868102</div>
            <div className="text-[11px] text-neutral-500 mt-0.5">test: tenant transaction rollback tests</div>
          </div>
        </div>
      </Drawer>
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
          <h3 className="text-base font-semibold text-neutral-900">Right Drawer Sizes</h3>
          <p className="text-sm text-neutral-500">
            Click any button below to preview the right drawer with different widths.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => setActiveSize('sm')}>
            Open Small (384px)
          </Button>
          <Button variant="outline" onClick={() => setActiveSize('md')}>
            Open Medium (448px)
          </Button>
          <Button variant="outline" onClick={() => setActiveSize('lg')}>
            Open Large (512px)
          </Button>
          <Button variant="outline" onClick={() => setActiveSize('xl')}>
            Open Extra Large (576px)
          </Button>
        </div>

        {activeSize && (
          <Drawer
            open={Boolean(activeSize)}
            position="right"
            size={activeSize}
            onClose={() => setActiveSize(null)}
          >
            <DrawerHeader>
              <DrawerTitle>Drawer Size: {activeSize.toUpperCase()}</DrawerTitle>
              <DrawerDescription>
                Responsive slide-over panel sized to <code>{activeSize}</code>.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerContent>
              <p className="text-sm text-neutral-600">
                This right drawer is rendering with size preset <code>{activeSize}</code>.
              </p>
            </DrawerContent>
            <DrawerFooter>
              <Button variant="primary" onClick={() => setActiveSize(null)}>
                Close
              </Button>
            </DrawerFooter>
          </Drawer>
        )}
      </div>
    );
  },
};
