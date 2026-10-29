import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';
import { Pagination } from './pagination';

const meta: Meta<typeof Pagination> = {
  title: 'Navigation/Pagination',
  component: Pagination,
  tags: ['autodocs'],
  args: {
    page: 1,
    totalPages: 10,
    disabled: false,
    showFirstLast: true,
    siblingCount: 1,
    onPageChange: fn(),
  },
  argTypes: {
    page: { control: 'number' },
    totalPages: { control: 'number' },
    disabled: { control: 'boolean' },
    showFirstLast: { control: 'boolean' },
    siblingCount: { control: 'number' },
  },
};

export default meta;
type Story = StoryObj<typeof Pagination>;

export const StartPage: Story = {
  args: {
    page: 1,
    totalPages: 12,
  },
};

export const MiddlePage: Story = {
  args: {
    page: 6,
    totalPages: 12,
  },
};

export const EndPage: Story = {
  args: {
    page: 12,
    totalPages: 12,
  },
};

export const FewPages: Story = {
  args: {
    page: 2,
    totalPages: 4,
  },
};

export const Disabled: Story = {
  args: {
    page: 3,
    totalPages: 8,
    disabled: true,
  },
};

export const InteractivePageClick: Story = {
  args: {
    page: 1,
    totalPages: 5,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const page2Button = canvas.getByRole('button', { name: '2' });
    await userEvent.click(page2Button);
    await expect(args.onPageChange).toHaveBeenCalledWith(2);
  },
};

