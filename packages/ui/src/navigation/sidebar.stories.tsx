import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import {
  LayoutGrid,
  BarChart2,
  FileText,
  Users,
  ClipboardCheck,
  HelpCircle,
  Bot,
  GraduationCap,
  ShieldCheck,
  Building2,
  Key,
  CreditCard,
  Settings,
  ExternalLink,
} from 'lucide-react';
import {
  Sidebar,
  type SidebarItem,
  type SidebarGroup,
  UserProfileDropdown,
} from './sidebar';

// ── Icons for diverse navigation links ───────────────────────────────────────
const ICON_CLS = 'w-5 h-5 shrink-0';

const GridIcon = () => <LayoutGrid className={ICON_CLS} strokeWidth={1.8} />;
const ChartIcon = () => <BarChart2 className={ICON_CLS} strokeWidth={1.8} />;
const DocumentReportIcon = () => <FileText className={ICON_CLS} strokeWidth={1.8} />;
const UsersIcon = () => <Users className={ICON_CLS} strokeWidth={1.8} />;
const ClipboardCheckIcon = () => <ClipboardCheck className={ICON_CLS} strokeWidth={1.8} />;
const QuestionIcon = () => <HelpCircle className={ICON_CLS} strokeWidth={1.8} />;
const BotAgentIcon = () => <Bot className={ICON_CLS} strokeWidth={1.8} />;
const GraduationCapIcon = () => <GraduationCap className={ICON_CLS} strokeWidth={1.8} />;
const ShieldCheckIcon = () => <ShieldCheck className={ICON_CLS} strokeWidth={1.8} />;
const BuildingIcon = () => <Building2 className={ICON_CLS} strokeWidth={1.8} />;
const KeyIcon = () => <Key className={ICON_CLS} strokeWidth={1.8} />;
const CreditCardIcon = () => <CreditCard className={ICON_CLS} strokeWidth={1.8} />;
const SettingsIcon = () => <Settings className={ICON_CLS} strokeWidth={1.8} />;
const ExternalLinkIcon = () => <ExternalLink className={ICON_CLS} strokeWidth={1.8} />;

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
          <div className="max-w-2xl bg-white border border-neutral-200/80 rounded-md p-6 shadow-xs">
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
          <div className="max-w-2xl bg-white border border-neutral-200/80 rounded-md p-6 shadow-xs">
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
          <div className="w-20 mt-4 flex items-center justify-center p-3 bg-white rounded-md border border-neutral-200 shadow-2xs">
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
