import type { Meta, StoryObj } from '@storybook/react';
import { Label } from './label';

const meta: Meta<typeof Label> = {
  title: 'Foundation/Label',
  component: Label,
  tags: ['autodocs'],
  args: {
    children: 'Assessment Title',
    required: false,
    optional: false,
  },
  argTypes: {
    children: { control: 'text' },
    required: { control: 'boolean' },
    optional: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Label>;

export const Default: Story = {
  args: {},
};

export const Required: Story = {
  args: {
    children: 'Company Organization Name',
    required: true,
  },
};

export const Optional: Story = {
  args: {
    children: 'Custom Domain CNAME',
    optional: true,
  },
};

