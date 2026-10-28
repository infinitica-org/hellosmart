import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Topbar } from './topbar';

const meta: Meta<typeof Topbar> = {
  title: 'Navigation/Topbar',
  component: Topbar,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    userName: 'Sathesh Kumar',
    userEmail: 'sathesh@hellosmart.ai',
    userRole: 'Company Admin',
    notificationCount: 3,
    showNotifications: true,
    showProfile: true,
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['dashboard', 'search', 'workspace', 'default', 'minimal'],
      description: 'Visual layout variant',
    },
    notificationCount: {
      control: 'number',
      description: 'Unread notification count badge',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Topbar>;

/**
 * 1. Dashboard (With Breadcrumbs)
 * Left: Breadcrumbs trail (Dashboard > Overview)
 * Right: Notification bell with unread badge + User profile dropdown pill
 */
export const Dashboard: Story = {
  name: 'Dashboard',
  args: {
    variant: 'dashboard',
    breadcrumbItems: [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Overview' },
    ],
    notificationCount: 3,
  },
  render: function DashboardDemo(args) {
    return (
      <div className="min-h-screen bg-[#fafbfc]">
        <Topbar
          {...args}
          variant="dashboard"
          onNotificationsClick={() => alert('Notifications clicked')}
          onLogout={() => alert('Sign out clicked')}
        />
        
      </div>
    );
  },
};

/**
 * 2. Search (Without Breadcrumbs)
 * Left: Quick search input (⌘K) without breadcrumbs
 * Right: Notification bell + User profile dropdown pill
 */
export const Search: Story = {
  name: 'Search (Without Breadcrumbs)',
  args: {
    variant: 'search',
    notificationCount: 4,
  },
  render: function SearchDemo(args) {
    const [query, setQuery] = useState('');

    return (
      <div className="min-h-screen bg-[#fafbfc]">
        <Topbar
          {...args}
          variant="search"
          searchValue={query}
          onSearchChange={setQuery}
          onNotificationsClick={() => alert('Notifications clicked')}
          onLogout={() => alert('Sign out clicked')}
        />
       
      </div>
    );
  },
};

/**
 * 3. Workspace (Live Candidate Test Session)
 * Left: Brand logo + Divider + Task title ("Fullstack React + Node Task")
 * Right: Live countdown timer badge ("48:15 remaining") + AI Status badge + Candidate profile + "Submit Work" button
 */
export const Workspace: Story = {
  name: 'Workspace (Live Test Session)',
  args: {
    variant: 'workspace',
    title: 'Fullstack React + Node Task',
    timerText: '48:15 remaining',
    aiStatus: 'on',
    userRole: 'Candidate',
  },
  render: function WorkspaceDemo(args) {
    return (
      <div className="min-h-screen bg-[#fafbfc]">
        <Topbar
          {...args}
          variant="workspace"
          onSubmitWork={() => alert('Submit Work clicked — confirm submission dialog')}
          onLogout={() => alert('Sign out clicked')}
        />
       
      </div>
    );
  },
};

/**
 * 4. Default Topbar
 * Left: Brand logo + Page title / subtitle
 * Right: Search button + Notification bell + User profile pill + Action button
 */
export const Default: Story = {
  name: 'Default',
 
  render: function DefaultDemo(args) {
    return (
      <div className="min-h-screen bg-[#fafbfc]">
        <Topbar
          {...args}
          variant="default"
          onSearchClick={() => alert('Search clicked')}
          onHelpClick={() => alert('Help clicked')}
          onNotificationsClick={() => alert('Notifications clicked')}
          onLogout={() => alert('Sign out clicked')}
        />
       
      </div>
    );
  },
};

/**
 * 5. Minimal Topbar
 * Left: Brand logo
 * Right: User profile pill
 */
export const Minimal: Story = {
  name: 'Minimal',
  args: {
    variant: 'minimal',
    showProfile: true,
  },
  render: function MinimalDemo(args) {
    return (
      <div className="min-h-screen bg-[#fafbfc]">
        <Topbar
          {...args}
          variant="minimal"
          onLogout={() => alert('Sign out clicked')}
        />
      
      </div>
    );
  },
};
