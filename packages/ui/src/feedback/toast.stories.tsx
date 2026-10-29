import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import {
  ToastItem,
  ToastProvider,
  useToast,
  ToastVariant,
  ToastPosition,
} from './toast';
import { Button } from '../components/button';

const meta: Meta<typeof ToastItem> = {
  title: 'Feedback/Toast',
  component: ToastItem,
  tags: ['autodocs'],
  args: {
    variant: 'info',
    title: 'Assessment Notification',
    description: 'Continuous autosave snapshot persisted to object storage (RPO <= 30s).',
    dismissible: true,
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['info', 'success', 'warning', 'error'],
      description: 'Semantic status visual style',
    },
    title: {
      control: 'text',
      description: 'Primary title text or element',
    },
    description: {
      control: 'text',
      description: 'Detailed description / body text',
    },
    dismissible: {
      control: 'boolean',
      description: 'Whether to show the dismiss (X) button',
    },
  },
};

export default meta;
type Story = StoryObj<typeof ToastItem>;

/**
 * 1. Standalone Direct ToastItem (With live Storybook controls)
 */
export const Default: Story = {
  name: '1. Standalone Toast (Controls Enabled)',
  render: (args) => (
    <div className="max-w-md p-6 bg-neutral-50 rounded-md border border-neutral-200">
      <ToastItem {...args} />
    </div>
  ),
};

/**
 * 2. All Color Variants Showcase
 */
export const AllVariants: Story = {
  name: '2. All Color Variants Showcase',
  render: () => (
    <div className="flex flex-col gap-3 max-w-md p-6 bg-neutral-50 rounded-md border border-neutral-200">
      <ToastItem
        variant="info"
        title="Environment Saved (Info)"
        description="Autosave snapshot persisted to object storage."
        onDismiss={() => alert('Dismissed Info')}
      />
      <ToastItem
        variant="success"
        title="Assessment Published (Success)"
        description="Template assigned and candidate token generated successfully."
        action={{ label: 'View Assessment →', onClick: () => alert('View Clicked') }}
        onDismiss={() => alert('Dismissed Success')}
      />
      <ToastItem
        variant="warning"
        title="Connection Latency Elevated (Warning)"
        description="Network latency to Cloud VM sandbox region exceeded 120ms."
        onDismiss={() => alert('Dismissed Warning')}
      />
      <ToastItem
        variant="error"
        title="Rate Limit Reached (Error)"
        description="AI Proxy token cap exceeded for this assessment session."
        action={{ label: 'Request Quota Upgrade', onClick: () => alert('Quota Upgrade Clicked') }}
        onDismiss={() => alert('Dismissed Error')}
      />
    </div>
  ),
};

/**
 * 3. With Action Callback
 */
export const WithAction: Story = {
  name: '3. Toast with Action Callback',
  render: () => (
    <div className="max-w-md p-6 bg-neutral-50 rounded-md border border-neutral-200">
      <ToastItem
        variant="success"
        title="Candidate Submitted Task"
        description="Alex Turner completed the Fullstack Python assessment."
        action={{
          label: 'Open Evaluation Grading →',
          onClick: () => alert('Opening candidate evaluation grading view'),
        }}
        onDismiss={() => alert('Dismissed')}
      />
    </div>
  ),
};

/**
 * 4. Custom Icon Override
 */
export const CustomIcon: Story = {
  name: '4. Custom Icon Override',
  render: () => (
    <div className="max-w-md p-6 bg-neutral-50 rounded-md border border-neutral-200">
      <ToastItem
        variant="info"
        title="Git Snapshot Committed"
        description="Commit hash 8f4a12b tagged on master branch."
        icon={
          <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="18" r="3" />
            <circle cx="6" cy="6" r="3" />
            <circle cx="18" cy="6" r="3" />
            <path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9" />
            <path d="M12 12v3" />
          </svg>
        }
      />
    </div>
  ),
};

/**
 * 5. Interactive Toast Provider & useToast Hook
 */
function InteractiveToastDemo({ position = 'bottom-right' }: { position?: ToastPosition }) {
  const { toast, dismissAll } = useToast();

  return (
    <div className="p-8 space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-neutral-900 mb-1">
          Interactive Toast Provider ({position})
        </h3>
        <p className="text-xs text-neutral-500">
          Click any button below to trigger reactive notifications with auto-dismiss and pause-on-hover.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            toast.info('Environment Saved', 'Autosave snapshot persisted to S3 object storage.')
          }
        >
          Info Toast
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() =>
            toast.success('Assessment Created', 'Template assigned and candidate token generated.', {
              action: { label: 'Copy Invite Link', onClick: () => alert('Copied to clipboard') },
            })
          }
        >
          Success Toast
        </Button>
        <Button
          variant="outline"
          color="orange"
          size="sm"
          onClick={() =>
            toast.warning('Connection Latency Warning', 'Elevated ping to Cloud VM container region.')
          }
        >
          Warning Toast
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={() =>
            toast.error('Token Cap Depleted', 'AI Proxy token quota exceeded for this session.')
          }
        >
          Error Toast
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={dismissAll}
        >
          Dismiss All
        </Button>
      </div>
    </div>
  );
}

export const InteractiveHook: Story = {
  name: '5. Interactive ToastProvider & useToast Hook',
  render: () => (
    <ToastProvider position="bottom-right" defaultDuration={4000} pauseOnHover>
      <InteractiveToastDemo position="bottom-right" />
    </ToastProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const successBtn = canvas.getByRole('button', { name: /success toast/i });
    await userEvent.click(successBtn);
    await expect(canvas.getByText('Assessment Created')).toBeInTheDocument();
  },
};

/**
 * 6. Position Options Showcase (Top-Right, Top-Center, Bottom-Right, etc.)
 */
export const PositionOptions: Story = {
  name: '6. Position Options Showcase',
  render: function PositionDemo() {
    const [currentPos, setCurrentPos] = useState<ToastPosition>('top-right');

    return (
      <div className="p-8 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-neutral-700">Select Toast Position:</span>
          <select
            value={currentPos}
            onChange={(e) => setCurrentPos(e.target.value as ToastPosition)}
            className="text-xs bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary"
          >
            <option value="top-right">top-right</option>
            <option value="top-left">top-left</option>
            <option value="top-center">top-center</option>
            <option value="bottom-right">bottom-right</option>
            <option value="bottom-left">bottom-left</option>
            <option value="bottom-center">bottom-center</option>
          </select>
        </div>

        <ToastProvider key={currentPos} position={currentPos} defaultDuration={5000}>
          <InteractiveToastDemo position={currentPos} />
        </ToastProvider>
      </div>
    );
  },
};
