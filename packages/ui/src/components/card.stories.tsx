import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from './card';
import { Button } from './button';

const meta: Meta<typeof Card> = {
  title: 'Foundation/Card',
  component: Card,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['glass', 'solid', 'bordered', 'interactive'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: (args) => (
    <Card {...args} className="max-w-md bg-white border-neutral-200 text-neutral-900 shadow-sm">
      <CardHeader className="border-neutral-100">
        <CardTitle className="text-neutral-900 font-medium">Full Stack Cloud Simulation</CardTitle>
        <CardDescription className="text-neutral-500 font-light">
          Evaluates React, Node.js, and distributed database debugging.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 text-sm text-neutral-600 font-normal">
        Candidate gets 60 minutes in a governed cloud VM with real developer tools and governed AI.
      </CardContent>
      <CardFooter className="flex justify-between items-center p-6 border-t border-neutral-100">
        <span className="text-xs text-neutral-500">Duration: 60 mins</span>
        <Button variant="primary" size="sm">Start Assessment</Button>
      </CardFooter>
    </Card>
  ),
};

export const InteractiveHover: Story = {
  args: {
    variant: 'interactive',
  },
  render: (args) => (
    <Card {...args} className="max-w-md bg-white border-neutral-200 text-neutral-900 shadow-sm">
      <CardHeader className="border-neutral-100">
        <CardTitle className="text-neutral-900 font-medium">Interactive Assessment Card</CardTitle>
        <CardDescription className="text-neutral-500 font-light">Hover over me to see the elevation effect.</CardDescription>
      </CardHeader>
      <CardContent className="p-6 text-sm text-neutral-600 font-normal">
        Cards with interactive variant elevate on hover and provide instant visual feedback.
      </CardContent>
    </Card>
  ),
};

export const WithTitleAndSubtitleProps: Story = {
  render: () => (
    <Card
      title="Backend Architecture Evaluation"
      subtitle="Evaluates PostgreSQL sharding, caching, and NestJS interceptors"
      variant="interactive"
      className="max-w-md shadow-xs"
    >
      <CardContent>
        <p className="text-sm text-neutral-600">
          Direct props convenience allows passing title and subtitle directly on &lt;Card title="..." subtitle="..." /&gt;
          without wrapping in manual headers.
        </p>
      </CardContent>
      <CardFooter>
        <span className="text-xs text-neutral-500">Duration: 75 mins</span>
        <Button size="sm">Launch Task</Button>
      </CardFooter>
    </Card>
  ),
};

export const AllCardVariants: Story = {
  render: () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
      <Card variant="solid" className="p-6 bg-white border-neutral-200 text-neutral-900 shadow-sm">
        <h4 className="font-medium text-neutral-900 mb-1">Solid Variant</h4>
        <p className="text-xs text-neutral-500">Opaque background with subtle border.</p>
      </Card>
      <Card variant="bordered" className="p-6 bg-transparent border-neutral-300 text-neutral-900">
        <h4 className="font-medium text-neutral-900 mb-1">Bordered Variant</h4>
        <p className="text-xs text-neutral-500">Transparent outline style container.</p>
      </Card>
      <Card variant="interactive" className="p-6 bg-white border-neutral-200 text-neutral-900 shadow-sm">
        <h4 className="font-medium text-neutral-900 mb-1">Interactive Variant</h4>
        <p className="text-xs text-neutral-500">Smooth hover transition and border glow.</p>
      </Card>
      <Card variant="glass" className="p-6 bg-white/80 backdrop-blur border-neutral-200 text-neutral-900 shadow-sm">
        <h4 className="font-medium text-neutral-900 mb-1">Glass Variant</h4>
        <p className="text-xs text-neutral-500">Frosted glass backdrop-blur effect.</p>
      </Card>
    </div>
  ),
};

