import React, { type ReactNode } from 'react';
import {
  LayoutDashboard,
  Building2,
  ShieldCheck,
  Bot,
  ClipboardList,
  Users,
  BarChart3,
  Settings,
  Terminal,
  User,
  Layers,
} from '@hs/ui';

export interface NavigationItem {
  label: string;
  href: string;
  icon?: ReactNode;
  badge?: string;
}

export interface NavigationGroup {
  id?: string;
  title?: string;
  items: NavigationItem[];
}

export type PortalNavigation = NavigationItem[];

// ─────────────────────────────────────────────────────────────────────────────
// Admin Portal Navigation Icons (Lucide)
// ─────────────────────────────────────────────────────────────────────────────
export const adminNavigation: PortalNavigation = [
  {
    label: 'Dashboard',
    href: '/admin',
    icon: <LayoutDashboard className="w-4 h-4" strokeWidth={2} />,
  },
  {
    label: 'Companies',
    href: '/admin/companies',
    icon: <Building2 className="w-4 h-4" strokeWidth={2} />,
  },
  {
    label: 'Audit Logs',
    href: '/admin/audit',
    icon: <ShieldCheck className="w-4 h-4" strokeWidth={2} />,
  },
  {
    label: 'Agents',
    href: '/admin/agents',
    icon: <Bot className="w-4 h-4" strokeWidth={2} />,
  },
  {
    label: 'Security',
    href: '/admin/settings/security',
    icon: <ShieldCheck className="w-4 h-4" strokeWidth={2} />,
  },
];

export const adminGroups: NavigationGroup[] = [
  {
    title: 'Overview',
    items: [
      {
        label: 'Dashboard',
        href: '/admin',
        icon: <LayoutDashboard className="w-4 h-4" strokeWidth={2} />,
      },
      {
        label: 'Companies',
        href: '/admin/companies',
        icon: <Building2 className="w-4 h-4" strokeWidth={2} />,
      },
      {
        label: 'Agents',
        href: '/admin/agents',
        icon: <Bot className="w-4 h-4" strokeWidth={2} />,
      },
    ],
  },
  {
    title: 'Insights',
    items: [
      {
        label: 'Audit Logs',
        href: '/admin/audit',
        icon: <ShieldCheck className="w-4 h-4" strokeWidth={2} />,
      },
      {
        label: 'Security',
        href: '/admin/settings/security',
        icon: <ShieldCheck className="w-4 h-4" strokeWidth={2} />,
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Company Portal Navigation Icons (Lucide)
// ─────────────────────────────────────────────────────────────────────────────
export const companyNavigation: PortalNavigation = [
  {
    label: 'Dashboard',
    href: '/company',
    icon: <LayoutDashboard className="w-4 h-4" strokeWidth={2} />,
  },
  {
    label: 'Templates',
    href: '/company/templates',
    icon: <Layers className="w-4 h-4" strokeWidth={2} />,
  },
  {
    label: 'Assessments',
    href: '/company/assessments',
    icon: <ClipboardList className="w-4 h-4" strokeWidth={2} />,
  },
  {
    label: 'Candidates',
    href: '/company/candidates',
    icon: <Users className="w-4 h-4" strokeWidth={2} />,
  },
  {
    label: 'Analytics',
    href: '/company/analytics',
    icon: <BarChart3 className="w-4 h-4" strokeWidth={2} />,
  },
  {
    label: 'Settings',
    href: '/company/settings',
    icon: <Settings className="w-4 h-4" strokeWidth={2} />,
  },
];

export const companyGroups: NavigationGroup[] = [
  {
    title: 'Overview',
    items: [
      {
        label: 'Dashboard',
        href: '/company',
        icon: <LayoutDashboard className="w-4 h-4" strokeWidth={2} />,
      },
      {
        label: 'Templates',
        href: '/company/templates',
        icon: <Layers className="w-4 h-4" strokeWidth={2} />,
      },
      {
        label: 'Assessments',
        href: '/company/assessments',
        icon: <ClipboardList className="w-4 h-4" strokeWidth={2} />,
      },
      {
        label: 'Candidates',
        href: '/company/candidates',
        icon: <Users className="w-4 h-4" strokeWidth={2} />,
      },
    ],
  },
  {
    title: 'Insights',
    items: [
      {
        label: 'Analytics',
        href: '/company/analytics',
        icon: <BarChart3 className="w-4 h-4" strokeWidth={2} />,
      },
      {
        label: 'Settings',
        href: '/company/settings',
        icon: <Settings className="w-4 h-4" strokeWidth={2} />,
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Candidate Portal Navigation Icons (Lucide)
// ─────────────────────────────────────────────────────────────────────────────
export const candidateNavigation: PortalNavigation = [
  {
    label: 'Dashboard',
    href: '/candidate',
    icon: <LayoutDashboard className="w-4 h-4" strokeWidth={2} />,
  },
  {
    label: 'My Assessments',
    href: '/candidate/assessments',
    icon: <Terminal className="w-4 h-4" strokeWidth={2} />,
  },
  {
    label: 'My Profile',
    href: '/candidate/profile',
    icon: <User className="w-4 h-4" strokeWidth={2} />,
  },
];

export const candidateGroups: NavigationGroup[] = [
  {
    title: 'Overview',
    items: [
      {
        label: 'Dashboard',
        href: '/candidate',
        icon: <LayoutDashboard className="w-4 h-4" strokeWidth={2} />,
      },
      {
        label: 'My Assessments',
        href: '/candidate/assessments',
        icon: <Terminal className="w-4 h-4" strokeWidth={2} />,
      },
    ],
  },
  {
    title: 'Insights',
    items: [
      {
        label: 'My Profile',
        href: '/candidate/profile',
        icon: <User className="w-4 h-4" strokeWidth={2} />,
      },
    ],
  },
];
