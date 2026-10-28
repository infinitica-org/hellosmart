import type { Meta, StoryObj } from '@storybook/react';
import { Tooltip } from './tooltip';
import { Button } from '../components/button';

const meta: Meta<typeof Tooltip> = {
  title: 'Overlays/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
  args: {
    content: 'Full screen exit automatically pauses cloud session (BR-10)',
    position: 'top',
    delayMs: 100,
  },
  argTypes: {
    position: {
      control: 'select',
      options: ['top', 'bottom', 'left', 'right'],
    },
    delayMs: { control: 'number' },
  },
};

export default meta;
type Story = StoryObj<typeof Tooltip>;

export const TopPosition: Story = {
  render: (args) => (
    <div className="flex justify-center items-center h-40">
      <Tooltip {...args} position="top">
        <Button variant="secondary" size="sm">
          Hover for Tooltip (Top)
        </Button>
      </Tooltip>
    </div>
  ),
};

export const BottomPosition: Story = {
  render: (args) => (
    <div className="flex justify-center items-center h-40">
      <Tooltip {...args} position="bottom" content="Server timer continues running on network drop (BR-09)">
        <Button variant="outline" size="sm">
          Hover for Tooltip (Bottom)
        </Button>
      </Tooltip>
    </div>
  ),
};

export const AllPositionsGrid: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-12 p-12 max-w-md mx-auto">
      <Tooltip position="top" content="Tooltip on top">
        <Button variant="secondary" size="sm" className="w-full">Top</Button>
      </Tooltip>
      <Tooltip position="bottom" content="Tooltip on bottom">
        <Button variant="secondary" size="sm" className="w-full">Bottom</Button>
      </Tooltip>
      <Tooltip position="left" content="Tooltip on left">
        <Button variant="secondary" size="sm" className="w-full">Left</Button>
      </Tooltip>
      <Tooltip position="right" content="Tooltip on right">
        <Button variant="secondary" size="sm" className="w-full">Right</Button>
      </Tooltip>
    </div>
  ),
};

