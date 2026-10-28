import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import {
  ErrorState,
  NotFound,
  AccessDenied,
  ServerError,
  NetworkError,
  LoadingState,
} from './error-state';

const meta: Meta<typeof ErrorState> = {
  title: 'Feedback/ErrorState',
  component: ErrorState,
  tags: ['autodocs'],
  args: {
    title: 'Unexpected Platform Failure',
    description: 'An unhandled exception occurred in the orchestrator pipeline. The issue has been logged.',
    actionLabel: 'Return Home',
    actionHref: '/',
    onRetry: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof ErrorState>;

export const DefaultServerError: Story = {
  args: {},
};

export const NotFoundPage: Story = {
  render: () => (
    <NotFound
      title="Assessment Not Found"
      description="The requested assessment session either expired or belongs to an unauthorized organization (BR-01)."
      actionLabel="Back to Assessments"
      actionHref="/company/assessments"
    />
  ),
};

export const AccessDeniedPage: Story = {
  render: () => (
    <AccessDenied
      title="Candidate Route Restricted"
      description="Candidate sessions can never access company admin routes (BR-25)."
      actionLabel="Sign In as Company Admin"
      actionHref="/login"
    />
  ),
};

export const ServerError500Page: Story = {
  render: () => (
    <ServerError
      onRetry={fn()}
      title="500 Internal Server Error"
      description="Database pool connectivity timeout during snapshot ingestion."
    />
  ),
};

export const NetworkDisconnectedPage: Story = {
  render: () => (
    <NetworkError
      onRetry={fn()}
      title="Connection Interrupted"
      description="Lost websocket heartbeat with the Cloud VM container. Reconnecting automatically..."
    />
  ),
};

export const LoadingStateView: Story = {
  render: () => (
    <LoadingState
      title="Restoring Assessment Workspace..."
      description="Retrieving persistent file snapshots and terminal history (RPO <= 30s)."
    />
  ),
};
