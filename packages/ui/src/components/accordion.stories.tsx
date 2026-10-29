import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from './accordion';

const meta: Meta<typeof Accordion> = {
  title: 'Components/Accordion',
  component: Accordion,
  tags: ['autodocs'],
  args: {
    type: 'single',
    defaultValue: 'item-1',
  },
  argTypes: {
    type: {
      control: 'radio',
      options: ['single', 'multiple'],
      description: 'Whether a single item or multiple items can be opened simultaneously',
    },
    defaultValue: {
      control: 'text',
      description: 'The default active item value',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Accordion>;

export const Default: Story = {
  render: (args) => (
    <div className="w-full max-w-xl mx-auto p-6 bg-white rounded-md border border-neutral-200/80 shadow-xs">
      <Accordion {...args}>
        <AccordionItem value="item-1">
          <AccordionTrigger>What is HelloSmart.ai?</AccordionTrigger>
          <AccordionContent>
            HelloSmart.ai is an AI-native hiring simulation platform where candidates perform real work in controlled cloud workspaces evaluated by independent AI reviewer agents.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger>How does the AI Reviewer work?</AccordionTrigger>
          <AccordionContent>
            Independent reviewer agents assess candidate work against specific rubric dimensions post-session, citing timestamped evidence and diff references for human decision-makers.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-3">
          <AccordionTrigger>Are real cloud credentials provided to candidates?</AccordionTrigger>
          <AccordionContent>
            No. Per BR-33, candidates are never provided real cloud credentials. All cloud interactions use isolated sandbox mocks or LocalStack.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  ),
};

export const MultipleExpand: Story = {
  name: 'Multiple Items Expandable',
  args: {
    type: 'multiple',
    defaultValue: ['item-1', 'item-2'],
  },
  render: (args) => (
    <div className="w-full max-w-xl mx-auto p-6 bg-white rounded-md border border-neutral-200/80 shadow-xs">
      <Accordion {...args}>
        <AccordionItem value="item-1">
          <AccordionTrigger>Assessment Configuration</AccordionTrigger>
          <AccordionContent>
            Configure time duration, AI budget caps, and specific rubric weights before sending candidate invites.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger>Workspace Environment</AccordionTrigger>
          <AccordionContent>
            Choose between full Cloud VM workspaces with VS Code and terminal or lightweight AI Chat simulation.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-3">
          <AccordionTrigger>Security & Consent (BR-12)</AccordionTrigger>
          <AccordionContent>
            Enforce mandatory candidate consent, recording disclosure, and screen drop policies prior to workspace connection.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  ),
};

