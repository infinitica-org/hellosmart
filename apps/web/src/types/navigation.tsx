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
  CreditCard,
  Briefcase,
  File,
  FileText,
  ClipboardCheck,
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
  {
    title: 'Sales & Commercial',
    items: [
      {
        label: 'Overview',
        href: ROUTES.ADMIN.SALES,
        icon: <BarChart3 className="w-4 h-4" strokeWidth={2} />,
      },
      {
        label: 'Leads & Bookings',
        href: ROUTES.ADMIN.SALES_LEADS,
        icon: <Users className="w-4 h-4" strokeWidth={2} />,
      },
      {
        label: 'Pricing Catalog',
        href: ROUTES.ADMIN.SALES_CATALOG,
        icon: <Layers className="w-4 h-4" strokeWidth={2} />,
      },
      {
        label: 'Promo Codes',
        href: ROUTES.ADMIN.SALES_PROMOS,
        icon: <CreditCard className="w-4 h-4" strokeWidth={2} />,
      },
      {
        label: 'GST Calculator',
        href: ROUTES.ADMIN.SALES_GST,
        icon: <Briefcase className="w-4 h-4" strokeWidth={2} />,
      },
      {
        label: 'Quote Builder',
        href: ROUTES.ADMIN.SALES_QUOTE_NEW,
        icon: <File className="w-4 h-4" strokeWidth={2} />,
      },
      {
        label: 'Sent Quotes',
        href: ROUTES.ADMIN.SALES_QUOTES,
        icon: <FileText className="w-4 h-4" strokeWidth={2} />,
      },
      {
        label: 'Customer Approvals',
        href: ROUTES.ADMIN.SALES_APPROVALS,
        icon: <ClipboardCheck className="w-4 h-4" strokeWidth={2} />,
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
    label: 'Dashboard',
    href: ROUTES.CANDIDATE.DASHBOARD,
    icon: <LayoutDashboard className="w-4 h-4" strokeWidth={2} />,
  },
  {
    label: 'My Assessments',
    href: ROUTES.CANDIDATE.ASSESSMENTS,
    icon: <Terminal className="w-4 h-4" strokeWidth={2} />,
  },
  {
    label: 'My Profile',
    href: ROUTES.CANDIDATE.PROFILE,
    icon: <User className="w-4 h-4" strokeWidth={2} />,
  },
];

export const candidateGroups: NavigationGroup[] = [
  {
    title: 'Overview',
    items: [
      {
        label: 'Dashboard',
        href: ROUTES.CANDIDATE.DASHBOARD,
        icon: <LayoutDashboard className="w-4 h-4" strokeWidth={2} />,
      },
      {
        label: 'My Assessments',
        href: ROUTES.CANDIDATE.ASSESSMENTS,
        icon: <Terminal className="w-4 h-4" strokeWidth={2} />,
      },
    ],
  },
  {
    title: 'Insights',
    items: [
      {
        label: 'My Profile',
        href: ROUTES.CANDIDATE.PROFILE,
        icon: <User className="w-4 h-4" strokeWidth={2} />,
      },
    ],
  },
];
