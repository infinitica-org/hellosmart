import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { fn } from '@storybook/test';
import { Drawer, DrawerHeader, DrawerTitle, DrawerDescription, DrawerContent, DrawerFooter } from './drawer';
import { Button } from '../components/button';

const meta: Meta<typeof Drawer> = {
  title: 'Overlays/Drawer',
  component: Drawer,
  tags: ['autodocs'],
  args: {
    open: true,
    position: 'right',
    size: 'md',
    onClose: fn(),
  },
  argTypes: {
    position: {
      control: 'select',
      options: ['left', 'right', 'top', 'bottom'],
    },
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
type Story = StoryObj<typeof Drawer>;

export const RightDrawer: Story = {
  render: (args) => (
    <Drawer {...args} position="right">
      <DrawerHeader>
        <DrawerTitle>Reviewer Agent Transcript</DrawerTitle>
        <DrawerDescription>Detailed inspection of independent agent reasoning and evidence tags.</DrawerDescription>
      </DrawerHeader>
      <DrawerContent>
        <div className="space-y-4 text-sm text-slate-300">
          <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
            <span className="font-semibold text-indigo-400">Agent: CodeQualityReviewer</span>
            <p className="mt-1 text-xs text-slate-400">Inspecting git commit history and test coverage.</p>
          </div>
          <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
            <span className="font-semibold text-emerald-400">Score: 4.5 / 5.0</span>
            <p className="mt-1 text-xs text-slate-400">Candidate provided clear modular breakdown with deterministic mocks.</p>
          </div>
        </div>
      </DrawerContent>
      <DrawerFooter>
        <Button variant="secondary" onClick={args.onClose}>Close Panel</Button>
      </DrawerFooter>
    </Drawer>
  ),
};

export const InteractiveDrawer: Story = {
  render: function RenderInteractive() {
    const [open, setOpen] = useState(false);
    return (
      <div className="p-8">
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Slide Out Inspection Drawer
        </Button>
        <Drawer open={open} onClose={() => setOpen(false)} position="right" size="lg">
          <DrawerHeader>
            <DrawerTitle>Assessment Activity Logs</DrawerTitle>
            <DrawerDescription>Real-time event capture stream (BR-11 / BR-31).</DrawerDescription>
          </DrawerHeader>
          <DrawerContent>
            <p className="text-sm text-slate-300">Continuous telemetry active.</p>
          </DrawerContent>
          <DrawerFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Dismiss
            </Button>
          </DrawerFooter>
        </Drawer>
      </div>
    );
  },
};
