import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import {
  Sidebar,
  type SidebarItem,
  type SidebarGroup,
  UserProfileDropdown,
} from './sidebar';

// ── Icons for diverse navigation links ───────────────────────────────────────
const ICON_CLS = 'w-5 h-5 shrink-0';

const GridIcon = () => (
  <svg className={ICON_CLS} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

const ChartIcon = () => (
  <svg className={ICON_CLS} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

const DocumentReportIcon = () => (
  <svg className={ICON_CLS} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const UsersIcon = () => (
  <svg className={ICON_CLS} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const ClipboardCheckIcon = () => (
  <svg className={ICON_CLS} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    <path d="M9 14l2 2 4-4" />
  </svg>
);

const QuestionIcon = () => (
  <svg className={ICON_CLS} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const BotAgentIcon = () => (
  <svg className={ICON_CLS} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <circle cx="12" cy="5" r="2" />
    <path d="M12 7v4" />
    <line x1="8" y1="16" x2="8.01" y2="16" />
    <line x1="16" y1="16" x2="16.01" y2="16" />
  </svg>
);

const GraduationCapIcon = () => (
  <svg className={ICON_CLS} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
    <path d="M6 12v5c0 1.657 2.686 3 6 3s6-1.343 6-3v-5" />
  </svg>
);

const ShieldCheckIcon = () => (
  <svg className={ICON_CLS} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

const BuildingIcon = () => (
  <svg className={ICON_CLS} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="2" />
    <path d="M9 22v-4h6v4" />
    <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
  </svg>
);

const KeyIcon = () => (
  <svg className={ICON_CLS} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="7.5" cy="15.5" r="5.5" />
    <path d="M21 2l-9.6 9.6" />
    <path d="M15.5 7.5l3 3L22 7l-3-3" />
  </svg>
);

const CreditCardIcon = () => (
  <svg className={ICON_CLS} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
    <line x1="1" y1="10" x2="23" y2="10" />
  </svg>
);

const SettingsIcon = () => (
  <svg className={ICON_CLS} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg className={ICON_CLS} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

// ── Rich 18+ Navigation Links for testing scrolling ──────────────────────────
const EXTENDED_DASHBOARD_GROUPS: SidebarGroup[] = [
  {
    id: 'core',
    title: 'Core Platform',
    items: [
      { id: 'dashboard', label: 'Dashboard', href: '/dashboard', 'data-testid': 'nav-dashboard', icon: <GridIcon /> },
      { id: 'students', label: 'Students', href: '/students', 'data-testid': 'nav-students', icon: <GraduationCapIcon /> },
      { id: 'whitelist', label: 'Whitelist', href: '/whitelist', 'data-testid': 'nav-whitelist', icon: <ShieldCheckIcon /> },
      { id: 'employers', label: 'Employers', href: '/employers', 'data-testid': 'nav-employers', icon: <BuildingIcon /> },
      { id: 'campus', label: 'Campus Access', href: '/campus', 'data-testid': 'nav-campus', icon: <KeyIcon /> },
      { id: 'reports', label: 'Reports', href: '/reports', 'data-testid': 'nav-reports', badge: 'Live', badgeVariant: 'success', icon: <DocumentReportIcon /> },
    ],
  },
  {
    id: 'talent',
    title: 'Hiring & Assessments',
    items: [
      { id: 'candidates', label: 'Candidates', href: '/candidates', 'data-testid': 'nav-candidates', badge: 28, badgeVariant: 'warning', icon: <UsersIcon /> },
      { id: 'assessments', label: 'Assessments', href: '/assessments', 'data-testid': 'nav-assessments', badge: 'New', badgeVariant: 'primary', icon: <ClipboardCheckIcon /> },
      { id: 'questions', label: 'Question Bank', href: '/questions', 'data-testid': 'nav-questions', icon: <QuestionIcon /> },
      { id: 'agents', label: 'Reviewer Agents', href: '/agents', 'data-testid': 'nav-agents', icon: <BotAgentIcon /> },
      { id: 'analytics', label: 'Analytics', href: '/analytics', 'data-testid': 'nav-analytics', icon: <ChartIcon /> },
    ],
  },
  {
    id: 'system',
    title: 'Platform & Settings',
    items: [
      { id: 'keys', label: 'AI Provider Keys', href: '/keys', 'data-testid': 'nav-keys', icon: <KeyIcon /> },
      { id: 'billing', label: 'Billing & Invoices', href: '/billing', 'data-testid': 'nav-billing', icon: <CreditCardIcon /> },
      { id: 'settings', label: 'Settings', href: '/settings', 'data-testid': 'nav-settings', icon: <SettingsIcon /> },
      { id: 'documentation', label: 'Documentation', href: 'https://docs.hellosmart.ai', target: '_blank', rel: 'noopener noreferrer', 'data-testid': 'nav-docs', icon: <ExternalLinkIcon /> },
    ],
  },
];

// Flat list of all extended links
const ALL_EXTENDED_NAV_LINKS: SidebarItem[] = EXTENDED_DASHBOARD_GROUPS.flatMap((g) => g.items);

const meta: Meta<typeof Sidebar> = {
  title: 'Navigation/Sidebar',
  component: Sidebar,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    userName: 'Sathesh Kumar',
    userEmail: 'sathesh@hellosmart.ai',
    portalRole: 'company_admin',
    showLogo: true,
    collapsible: false,
    showCollapseButton: false,
    activeStyle: 'light',
    navLinks: ALL_EXTENDED_NAV_LINKS,
  },
  argTypes: {
    navLinks: {
      control: 'object',
      description: 'Navigation links/items passed to the sidebar via navLinks prop',
    },
    variant: {
      control: 'select',
      options: ['default', 'dashboard', 'rail'],
      description: 'Sidebar variant',
    },
    activeStyle: {
      control: 'radio',
      options: ['light', 'brand', 'subtle', 'dark'],
      description: 'Active nav item styling (light brand orange, subtle neutral, or dark)',
    },
    collapsible: {
      control: 'boolean',
      description: 'Whether the sidebar can be collapsed',
    },
    showCollapseButton: {
      control: 'boolean',
      description: 'Whether to show the collapse toggle button in the header',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Sidebar>;

/**
 * 1. Default Dashboard Sidebar (with Many Links & Sleek Scrollbar)
 * Renders categorized groups of links with our sleek custom scrollbar.
 */
export const DashboardSidebar: Story = {
  name: '1. Dashboard Sidebar ',
  render: function DashboardSidebarDemo(args) {
    const [currentPath, setCurrentPath] = useState('/dashboard');

    return (
      <div className="flex h-screen bg-[#fafbfc]">
        <Sidebar
          {...args}
          variant="dashboard"
          collapsible={false}
          showCollapseButton={false}
          currentPath={currentPath}
          groups={EXTENDED_DASHBOARD_GROUPS}
          onSelect={(item) => {
            if (item.href) setCurrentPath(item.href);
          }}
        />

        <main className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-2xl bg-white border border-neutral-200/80 rounded-2xl p-6 shadow-xs">
            <h2 className="text-base font-semibold text-neutral-900">Scrollable Navigation Preview</h2>
            <p className="text-xs text-neutral-500 mt-1">
              Scroll the sidebar navigation on the left to see the smooth, custom ultra-thin scrollbar with 15+ links organized across categories.
            </p>
          </div>
        </main>
      </div>
    );
  },
};

/**
 * 2. Icon-Only Carousel Rail Sidebar (Scrollable Icons + Maximize/Minimize)
 * Renders many icon links in a smooth scrollable column with light active styling.
 */
export const CarouselRailSidebar: Story = {
  name: '2. Carousel Rail Sidebar ',
  args: {
    activeStyle: 'light',
  },
  render: function CarouselRailSidebarDemo(args) {
    const [currentPath, setCurrentPath] = useState('/dashboard');

    return (
      <div className="flex h-screen bg-[#fafbfc]">
        <Sidebar
          {...args}
          variant="rail"
          currentPath={currentPath}
          navLinks={args.navLinks ?? ALL_EXTENDED_NAV_LINKS}
          onSelect={(item) => {
            if (item.href) setCurrentPath(item.href);
          }}
        />

        <main className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-2xl bg-white border border-neutral-200/80 rounded-2xl p-6 shadow-xs">
            <h2 className="text-base font-semibold text-neutral-900">Rail Scrollable Navigation</h2>
            <p className="text-xs text-neutral-500 mt-1">
              Scroll the icon-only rail sidebar to access all 15+ icons, or click the circular chevron button to expand to the full sidebar!
            </p>
          </div>
        </main>
      </div>
    );
  },
};

/**
 * 3. Standalone User Profile Dropdown Menus
 */
export const UserProfileCardDropdown: Story = {
  name: '3. User Profile Dropdown Menus',
  render: function UserProfileDropdownDemo() {
    const [lastAction, setLastAction] = useState('None');

    return (
      <div className="p-8 max-w-xl mx-auto space-y-8">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">1. Standard Sidebar Bottom User Card</h3>
          <p className="text-xs text-neutral-500 mt-1">
            Click the three-dot icon on the right to open the dropdown menu upwards.
          </p>
          <div className="w-64 mt-4 pt-36">
            <UserProfileDropdown
              userName="Sathesh Kumar"
              userEmail="sathesh@hellosmart.ai"
              portalRole="Company Admin"
              variant="card"
              placement="top"
              onLogout={() => setLastAction('Sign out triggered from Card Menu!')}
            />
          </div>
        </div>

        <div className="border-t border-neutral-200 pt-6">
          <h3 className="text-sm font-semibold text-neutral-900">2. Rail Sidebar Bottom User Avatar</h3>
          <p className="text-xs text-neutral-500 mt-1">
            Click the user avatar to open the dropdown menu to the right.
          </p>
          <div className="w-20 mt-4 flex items-center justify-center p-3 bg-white rounded-2xl border border-neutral-200 shadow-2xs">
            <UserProfileDropdown
              userName="Sathesh Kumar"
              userEmail="sathesh@hellosmart.ai"
              portalRole="Company Admin"
              variant="avatar"
              placement="right"
              onLogout={() => setLastAction('Sign out triggered from Avatar Menu!')}
            />
          </div>
        </div>

        <div className="p-3 bg-neutral-100 rounded-xl text-xs font-mono text-neutral-700">
          Last Action: {lastAction}
        </div>
      </div>
    );
  },
};
