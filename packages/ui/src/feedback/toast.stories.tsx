import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import { ToastProvider, useToast } from './toast';
import { Button } from '../components/button';

const meta: Meta = {
  title: 'Feedback/Toast',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

function ToastDemoButtons() {
  const { toast } = useToast();

  return (
    <div className="flex flex-wrap gap-4 p-8">
      <Button
        variant="secondary"
        onClick={() =>
          toast({
            title: 'Environment Saved',
            description: 'Autosave snapshot persisted to object storage (RPO <= 30s).',
            variant: 'info',
          })
        }
      >
        Info Toast
      </Button>
      <Button
        variant="primary"
        onClick={() =>
          toast({
            title: 'Assessment Created',
            description: 'Template assigned and candidate token generated.',
            variant: 'success',
          })
        }
      >
        Success Toast
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast({
            title: 'Connection Latency Warning',
            description: 'Elevated ping to Cloud VM datacenter region.',
            variant: 'warning',
          })
        }
      >
        Warning Toast
      </Button>
      <Button
        variant="danger"
        onClick={() =>
          toast({
            title: 'Rate Limit Reached',
            description: 'AI Proxy token cap exceeded for this assessment session (BR-15).',
            variant: 'error',
          })
        }
      >
        Error Toast
      </Button>
    </div>
  );
}

export const InteractiveToasts: Story = {
  render: () => (
    <ToastProvider>
      <ToastDemoButtons />
    </ToastProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const successBtn = canvas.getByRole('button', { name: 'Success Toast' });
    await userEvent.click(successBtn);
    await expect(canvas.getByText('Assessment Created')).toBeInTheDocument();
  },
};

