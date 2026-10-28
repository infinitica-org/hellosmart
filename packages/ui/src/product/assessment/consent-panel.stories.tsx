import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';
import { ConsentPanel } from './consent-panel';

const meta: Meta<typeof ConsentPanel> = {
  title: 'Domain/Assessment/ConsentPanel',
  component: ConsentPanel,
  tags: ['autodocs'],
  args: {
    workspaceMode: 'cloud',
    aiEnabled: true,
    pauseTimerOnDisconnect: false,
    isLoading: false,
    onAccept: fn(),
  },
  argTypes: {
    workspaceMode: {
      control: 'radio',
      options: ['cloud', 'chat'],
    },
    aiEnabled: { control: 'boolean' },
    pauseTimerOnDisconnect: { control: 'boolean' },
    isLoading: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof ConsentPanel>;

export const CloudVmWithAiEnabled: Story = {
  args: {},
};

export const ChatWorkspaceWithAiOff: Story = {
  args: {
    workspaceMode: 'chat',
    aiEnabled: false,
  },
};

export const LoadingConnectState: Story = {
  args: {
    isLoading: true,
  },
};

export const InteractiveAcceptWorkflow: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const connectBtn = canvas.getByRole('button', { name: /Connect to Workspace/i });
    expect(connectBtn).toBeDisabled();

    const checkbox = canvas.getByRole('checkbox');
    await userEvent.click(checkbox);
    expect(connectBtn).not.toBeDisabled();

    await userEvent.click(connectBtn);
    expect(args.onAccept).toHaveBeenCalled();
  },
};

