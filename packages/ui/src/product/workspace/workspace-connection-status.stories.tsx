import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { WorkspaceConnectionStatus, WorkspaceConnectionState } from './workspace-connection-status';

const meta: Meta<typeof WorkspaceConnectionStatus> = {
  title: 'Domain/Workspace/ConnectionStatus',
  component: WorkspaceConnectionStatus,
  tags: ['autodocs'],
  args: {
    state: 'connected',
    onReconnect: fn(),
  },
  argTypes: {
    state: {
      control: 'select',
      options: ['provisioning', 'not_connected', 'connected', 'disconnected', 'fullscreen_exit', 'ended'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof WorkspaceConnectionStatus>;

export const ConnectedState: Story = {
  args: {
    state: 'connected',
  },
};

export const FullscreenExitPaused: Story = {
  args: {
    state: 'fullscreen_exit',
  },
};

export const DisconnectedWithResume: Story = {
  args: {
    state: 'disconnected',
  },
};

export const AllStatesShowcase: Story = {
  render: () => {
    const states: WorkspaceConnectionState[] = [
      'provisioning',
      'not_connected',
      'connected',
      'disconnected',
      'fullscreen_exit',
      'ended',
    ];

    return (
      <div className="flex flex-col gap-3 p-4">
        {states.map((st) => (
          <div key={st} className="flex items-center gap-4">
            <span className="w-36 text-xs text-slate-400 font-mono">{st}:</span>
            <WorkspaceConnectionStatus state={st} onReconnect={fn()} />
          </div>
        ))}
      </div>
    );
  },
};

