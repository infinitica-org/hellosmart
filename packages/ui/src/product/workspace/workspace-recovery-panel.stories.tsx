import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { WorkspaceRecoveryPanel } from './workspace-recovery-panel';

const meta: Meta<typeof WorkspaceRecoveryPanel> = {
  title: 'Domain/Workspace/RecoveryPanel',
  component: WorkspaceRecoveryPanel,
  tags: ['autodocs'],
  args: {
    lastSavedAt: new Date().toISOString(),
    snapshotRef: 'c4e92a819b16',
    isRestoring: false,
    onRestore: fn(),
  },
  argTypes: {
    isRestoring: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof WorkspaceRecoveryPanel>;

export const DefaultAutosaveActive: Story = {
  args: {},
};

export const RestoringState: Story = {
  args: {
    isRestoring: true,
  },
};

