import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from './dropdown-menu';
import { Button } from '../components/button';

const meta: Meta<typeof DropdownMenu> = {
  title: 'Navigation/DropdownMenu',
  component: DropdownMenu,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof DropdownMenu>;

export const Default: Story = {
  render: () => (
    <div className="h-64 p-4">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="sm">
            Actions menu ▾
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="left">
          <DropdownMenuLabel>Session Controls</DropdownMenuLabel>
          <DropdownMenuItem>View Live Transcript</DropdownMenuItem>
          <DropdownMenuItem>Snapshot Environment</DropdownMenuItem>
          <DropdownMenuItem>Download Terminal Logs</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Administrative</DropdownMenuLabel>
          <DropdownMenuItem>Extend Session (+15m)</DropdownMenuItem>
          <DropdownMenuItem variant="danger">
            Force Terminate Workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  ),
};

export const RightAligned: Story = {
  render: () => (
    <div className="flex justify-end h-64 p-4">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            Account Options ▾
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="right">
          <DropdownMenuLabel>Signed in as Admin</DropdownMenuLabel>
          <DropdownMenuItem>My Organization</DropdownMenuItem>
          <DropdownMenuItem>API Keys Vault</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="danger">Sign Out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  ),
};

export const InteractiveOpenAndSelect: Story = {
  render: () => (
    <div className="h-64 p-4">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="sm">
            Trigger Menu
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item One</DropdownMenuItem>
          <DropdownMenuItem>Item Two</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Trigger Menu' });
    await userEvent.click(trigger);
    await expect(canvas.getByText('Item One')).toBeInTheDocument();
  },
};

