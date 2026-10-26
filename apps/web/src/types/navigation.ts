import type { ReactNode } from 'react';

export interface NavigationItem {
  label: string;
  href: string;
  icon?: ReactNode;
  badge?: string;
}

export type PortalNavigation = NavigationItem[];

export const adminNavigation: PortalNavigation = [
  {
    label: 'Dashboard',
    href: '/admin',
  },
  {
    label: 'Companies',
    href: '/admin/companies',
  },
  {
    label: 'Audit Logs',
    href: '/admin/audit',
  },
  {
    label: 'Agents',
    href: '/admin/agents',
  },
];

export const companyNavigation: PortalNavigation = [
  {
    label: 'Dashboard',
    href: '/company',
  },
  {
    label: 'Assessments',
    href: '/company/assessments',
  },
  {
    label: 'Candidates',
    href: '/company/candidates',
  },
  {
    label: 'Analytics',
    href: '/company/analytics',
  },
  {
    label: 'Settings',
    href: '/company/settings',
  },
];

export const candidateNavigation: PortalNavigation = [
  {
    label: 'Dashboard',
    href: '/candidate',
  },
  {
    label: 'My Assessments',
    href: '/candidate/assessments',
  },
  {
    label: 'My Profile',
    href: '/candidate/profile',
  },
];

