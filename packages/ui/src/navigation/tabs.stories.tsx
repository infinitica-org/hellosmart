import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import { Terminal, Code, Zap } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs';
import { Badge } from '../components/badge';

const meta: Meta<typeof Tabs> = {
  title: 'Navigation/Tabs',
  component: Tabs,
  tags: ['autodocs'],
  args: {
    defaultValue: 'overview',
    variant: 'line',
  },
  argTypes: {
    variant: {
      control: 'radio',
      options: ['line', 'pills', 'segmented'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Tabs>;

export const LineVariant: Story = {
  render: (args) => (
    <Tabs {...args} defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="assessments" badge={<Badge variant="primary" size="sm">12</Badge>}>
          Assessments
        </TabsTrigger>
        <TabsTrigger value="candidates">Candidates</TabsTrigger>
        <TabsTrigger value="settings" disabled>Settings (Locked)</TabsTrigger>
      </TabsList>
      <div className="pt-4 text-sm text-neutral-700">
        <TabsContent value="overview">Organization overview and active candidate session stats.</TabsContent>
        <TabsContent value="assessments">List of active, published, and archived assessments.</TabsContent>
        <TabsContent value="candidates">Candidate roster and evaluation pipeline.</TabsContent>
      </div>
    </Tabs>
  ),
};

export const PillsVariant: Story = {
  render: (args) => (
    <Tabs {...args} variant="pills" defaultValue="terminal">
      <TabsList>
        <TabsTrigger value="terminal">Cloud Terminal</TabsTrigger>
        <TabsTrigger value="editor">Code Editor</TabsTrigger>
        <TabsTrigger value="ai-chat">AI Assistant</TabsTrigger>
      </TabsList>
      <div className="pt-4 text-sm text-neutral-700">
        <TabsContent value="terminal">Interactive bash shell connected to Cloud VM container.</TabsContent>
        <TabsContent value="editor">VS Code web editor with syntax highlighting and autosave.</TabsContent>
        <TabsContent value="ai-chat">HelloSmart AI Proxy Assistant with scoped candidate tokens.</TabsContent>
      </div>
    </Tabs>
  ),
};

export const InteractiveTabSwitching: Story = {
  render: () => (
    <Tabs defaultValue="first">
      <TabsList>
        <TabsTrigger value="first">Tab 1</TabsTrigger>
        <TabsTrigger value="second">Tab 2</TabsTrigger>
      </TabsList>
      <div className="pt-4 text-sm text-neutral-800">
        <TabsContent value="first">Content for Tab One</TabsContent>
        <TabsContent value="second">Content for Tab Two</TabsContent>
      </div>
    </Tabs>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tab2 = canvas.getByRole('tab', { name: 'Tab 2' });
    await userEvent.click(tab2);
    await expect(canvas.getByText('Content for Tab Two')).toBeInTheDocument();
  },
};

export const FittedSegmentedTabs: Story = {
  render: () => (
    <div className="max-w-md bg-white p-4 rounded-md border border-neutral-200">
      <Tabs variant="segmented" fitted defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All (42)</TabsTrigger>
          <TabsTrigger value="active">Active (12)</TabsTrigger>
          <TabsTrigger value="completed">Completed (30)</TabsTrigger>
        </TabsList>
        <div className="pt-3 text-xs text-neutral-600">
          <TabsContent value="all">Showing all candidate assessments across tenants.</TabsContent>
          <TabsContent value="active">12 sessions currently in progress with active heartbeat.</TabsContent>
          <TabsContent value="completed">30 submissions ready for human review override.</TabsContent>
        </div>
      </Tabs>
    </div>
  ),
};

export const FittedPillTabsWithIcons: Story = {
  render: () => (
    <div className="max-w-lg bg-white p-4 rounded-md border border-neutral-200">
      <Tabs variant="pills" fitted defaultValue="terminal">
        <TabsList>
          <TabsTrigger
            value="terminal"
            icon={<Terminal className="w-3.5 h-3.5" />}
          >
            Terminal
          </TabsTrigger>
          <TabsTrigger
            value="code"
            icon={<Code className="w-3.5 h-3.5" />}
          >
            IDE Editor
          </TabsTrigger>
          <TabsTrigger
            value="ai"
            icon={<Zap className="w-3.5 h-3.5" />}
          >
            AI Assistant
          </TabsTrigger>
        </TabsList>
        <div className="pt-3 text-xs text-neutral-600">
          <TabsContent value="terminal">Governed Cloud VM terminal with live stream.</TabsContent>
          <TabsContent value="code">Autosaving Monaco/VS Code environment with diff snapshots.</TabsContent>
          <TabsContent value="ai">HelloSmart AI Proxy with token consumption quotas.</TabsContent>
        </div>
      </Tabs>
    </div>
  ),
};


