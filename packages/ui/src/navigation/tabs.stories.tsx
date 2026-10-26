import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
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
      options: ['line', 'pills'],
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
      <div className="pt-4 text-sm text-slate-300">
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
      <div className="pt-4 text-sm text-slate-300">
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
      <div className="pt-4 text-sm text-slate-300">
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

