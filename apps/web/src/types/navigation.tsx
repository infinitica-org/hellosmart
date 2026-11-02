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
import { ROUTES } from '@/constants';

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
    href: ROUTES.ADMIN.DASHBOARD,
    icon: <LayoutDashboard className="w-4 h-4" strokeWidth={2} />,
  },
  {
    label: 'Companies',
    href: ROUTES.ADMIN.COMPANIES,
    icon: <Building2 className="w-4 h-4" strokeWidth={2} />,
  },
  {
    label: 'Audit Logs',
    href: ROUTES.ADMIN.AUDIT,
    icon: <ShieldCheck className="w-4 h-4" strokeWidth={2} />,
  },
  {
    label: 'Agents',
    href: ROUTES.ADMIN.AGENTS,
    icon: <Bot className="w-4 h-4" strokeWidth={2} />,
  },
  {
    label: 'Security',
    href: ROUTES.ADMIN.SECURITY,
    icon: <ShieldCheck className="w-4 h-4" strokeWidth={2} />,
  },
];

export const adminGroups: NavigationGroup[] = [
  {
    title: 'Overview',
    items: [
      {
        label: 'Dashboard',
        href: ROUTES.ADMIN.DASHBOARD,
        icon: <LayoutDashboard className="w-4 h-4" strokeWidth={2} />,
      },
      {
        label: 'Companies',
        href: ROUTES.ADMIN.COMPANIES,
        icon: <Building2 className="w-4 h-4" strokeWidth={2} />,
      },
      {
        label: 'Agents',
        href: ROUTES.ADMIN.AGENTS,
        icon: <Bot className="w-4 h-4" strokeWidth={2} />,
      },
    ],
  },
  {
    title: 'Insights',
    items: [
      {
        label: 'Audit Logs',
        href: ROUTES.ADMIN.AUDIT,
        icon: <ShieldCheck className="w-4 h-4" strokeWidth={2} />,
      },
      {
        label: 'Security',
        href: ROUTES.ADMIN.SECURITY,
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
    href: ROUTES.COMPANY.DASHBOARD,
    icon: <LayoutDashboard className="w-4 h-4" strokeWidth={2} />,
  },
  {
    label: 'Templates',
    href: ROUTES.COMPANY.TEMPLATES,
    icon: <Layers className="w-4 h-4" strokeWidth={2} />,
  },
  {
    label: 'Assessments',
    href: ROUTES.COMPANY.ASSESSMENTS,
    icon: <ClipboardList className="w-4 h-4" strokeWidth={2} />,
  },
  {
    label: 'Candidates',
    href: ROUTES.COMPANY.CANDIDATES,
    icon: <Users className="w-4 h-4" strokeWidth={2} />,
  },
  {
    label: 'Analytics',
    href: ROUTES.COMPANY.ANALYTICS,
    icon: <BarChart3 className="w-4 h-4" strokeWidth={2} />,
  },
  {
    label: 'Settings',
    href: ROUTES.COMPANY.SETTINGS,
    icon: <Settings className="w-4 h-4" strokeWidth={2} />,
  },
];

export const companyGroups: NavigationGroup[] = [
  {
    title: 'Overview',
    items: [
      {
        label: 'Dashboard',
        href: ROUTES.COMPANY.DASHBOARD,
        icon: <LayoutDashboard className="w-4 h-4" strokeWidth={2} />,
      },
      {
        label: 'Templates',
        href: ROUTES.COMPANY.TEMPLATES,
        icon: <Layers className="w-4 h-4" strokeWidth={2} />,
      },
      {
        label: 'Assessments',
        href: ROUTES.COMPANY.ASSESSMENTS,
        icon: <ClipboardList className="w-4 h-4" strokeWidth={2} />,
      },
      {
        label: 'Candidates',
        href: ROUTES.COMPANY.CANDIDATES,
        icon: <Users className="w-4 h-4" strokeWidth={2} />,
      },
    ],
  },
  {
    title: 'Insights',
    items: [
      {
        label: 'Analytics',
        href: ROUTES.COMPANY.ANALYTICS,
        icon: <BarChart3 className="w-4 h-4" strokeWidth={2} />,
      },
      {
        label: 'Settings',
        href: ROUTES.COMPANY.SETTINGS,
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
    label: 'My Workspace',
    href: ROUTES.CANDIDATE.DASHBOARD,
    icon: <LayoutDashboard className="w-4 h-4" strokeWidth={2} />,
  },
  {
    label: 'My Profile',
    href: ROUTES.CANDIDATE.PROFILE,
    icon: <User className="w-4 h-4" strokeWidth={2} />,
  },
];

export const candidateGroups: NavigationGroup[] = [
  {
    items: [
      {
        label: 'My Workspace',
        href: ROUTES.CANDIDATE.DASHBOARD,
        icon: <LayoutDashboard className="w-4 h-4" strokeWidth={2} />,
      },
      {
        label: 'My Profile',
        href: ROUTES.CANDIDATE.PROFILE,
        icon: <User className="w-4 h-4" strokeWidth={2} />,
      },
    ],
  },
];
