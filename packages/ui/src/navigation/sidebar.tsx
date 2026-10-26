'use client';

import React, { useState, ReactNode } from 'react';
import { BrandMark } from '../brand-mark';
import { Button } from '../components/button';

export interface SidebarItem {
  label: string;
  href: string;
  icon?: ReactNode | undefined;
  badge?: string | undefined;
}

export interface SidebarProps {
  portalTitle?: string | undefined;
  portalRole?: 'company_admin' | 'platform_admin' | 'candidate' | undefined;
  companyName?: string | undefined;
  items?: SidebarItem[] | undefined;
  userName?: string | undefined;
  userEmail?: string | undefined;
  currentPath?: string | undefined;
  onLogout?: (() => void) | undefined;
  logoSrc?: string | undefined;
  whiteLabel?: boolean | undefined;
  renderLink?: (props: {
    href: string;
    children: ReactNode;
    className: string;
    onClick?: () => void;
  }) => ReactNode;
}

export const DEFAULT_ADMIN_NAV_ITEMS: SidebarItem[] = [
  {
    label: 'Dashboard',
    href: '/admin',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
        />
      </svg>
    ),
  },
  {
    label: 'Companies',
    href: '/admin/companies',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
        />
      </svg>
    ),
  },
  {
    label: 'Audit Logs',
    href: '/admin/audit',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
  },
  {
    label: 'Agents',
    href: '/admin/agents',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
    ),
  },
];

export const DEFAULT_COMPANY_NAV_ITEMS: SidebarItem[] = [
  {
    label: 'Dashboard',
    href: '/company',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
  },
  {
    label: 'Assessments',
    href: '/company/assessments',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
        />
      </svg>
    ),
  },
  {
    label: 'Candidates',
    href: '/company/candidates',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>
    ),
  },
  {
    label: 'Analytics',
    href: '/company/analytics',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
    ),
  },
  {
    label: 'Settings',
    href: '/company/settings',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
  },
];

export const DEFAULT_CANDIDATE_NAV_ITEMS: SidebarItem[] = [
  {
    label: 'Dashboard',
    href: '/candidate',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
  },
  {
    label: 'My Assessments',
    href: '/candidate/assessments',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
        />
      </svg>
    ),
  },
  {
    label: 'My Profile',
    href: '/candidate/profile',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
    ),
  },
];

export function Sidebar({
  portalTitle = 'Hiring Portal',
  portalRole = 'company_admin',
  companyName = 'Company Portal',
  items,
  userName = 'Company Admin',
  userEmail = 'admin@company.com',
  currentPath,
  onLogout,
  logoSrc,
  whiteLabel = false,
  renderLink,
}: SidebarProps): React.JSX.Element {
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeItems =
    items ??
    (portalRole === 'candidate'
      ? DEFAULT_CANDIDATE_NAV_ITEMS
      : portalRole === 'platform_admin'
      ? DEFAULT_ADMIN_NAV_ITEMS
      : DEFAULT_COMPANY_NAV_ITEMS);

  const pathname =
    currentPath ?? (typeof window !== 'undefined' ? window.location.pathname : '');

  const defaultRenderLink = ({
    href,
    children,
    className,
    onClick,
  }: {
    href: string;
    children: ReactNode;
    className: string;
    onClick?: () => void;
  }) => (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  );

  const linkRenderer = renderLink ?? defaultRenderLink;

  const navContent = (
    <div className="flex flex-col justify-between h-full p-4">
      <div>
        {/* Brand header */}
        <div className="pb-5 pt-1 px-2 border-b border-neutral-200/80">
          <div className="inline-block">
            <BrandMark size="md" logoSrc={logoSrc} whiteLabel={whiteLabel} />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-800">{portalTitle}</span>
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                portalRole === 'platform_admin'
                  ? 'bg-rose-50 text-rose-600 border-rose-200'
                  : portalRole === 'candidate'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-primary/10 text-primary border-primary/25'
              }`}
            >
              {portalRole === 'platform_admin'
                ? 'Platform Admin'
                : portalRole === 'candidate'
                ? 'Candidate'
                : 'Company Admin'}
            </span>
          </div>
          <div className="mt-2 text-[11px] font-mono text-neutral-500 truncate">
            {companyName}
          </div>
        </div>

        {/* Navigation Links */}
        <nav
          className="mt-5 space-y-1"
          aria-label={
            portalRole === 'candidate'
              ? 'Candidate Portal Navigation'
              : portalRole === 'platform_admin'
              ? 'Platform Admin Navigation'
              : 'Company Portal Navigation'
          }
        >
          {activeItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/company' &&
                item.href !== '/candidate' &&
                item.href !== '/admin' &&
                (pathname === item.href || pathname.startsWith(item.href + '/')));

            const linkClass = `flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all ${
              isActive
                ? 'bg-primary/10 text-primary border border-primary/25 font-medium shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/70 font-normal border border-transparent'
            }`;

            return (
              <React.Fragment key={item.href}>
                {linkRenderer({
                  href: item.href,
                  onClick: () => setMobileOpen(false),
                  className: linkClass,
                  children: (
                    <>
                      <div className="flex items-center gap-3">
                        {item.icon ? (
                          <span className={isActive ? 'text-primary' : 'text-neutral-400'}>
                            {item.icon}
                          </span>
                        ) : (
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isActive ? 'bg-primary' : 'bg-neutral-300'
                            }`}
                          />
                        )}
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 border border-neutral-200 font-normal">
                          {item.badge}
                        </span>
                      )}
                    </>
                  ),
                })}
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      {/* User profile and logout */}
      <div className="pt-4 border-t border-neutral-200/80 space-y-3">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-xs font-medium text-primary flex-shrink-0">
            {userName ? userName.charAt(0).toUpperCase() : 'C'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-neutral-800 truncate">{userName}</div>
            <div className="text-[11px] text-neutral-500 font-normal truncate">{userEmail}</div>
          </div>
        </div>

        {onLogout && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            fullWidth
            onClick={onLogout}
            data-testid="company-sidebar-logout-button"
            className="text-xs text-neutral-600 hover:text-rose-600 border-neutral-200 hover:border-rose-200 hover:bg-rose-50 flex items-center justify-center gap-2 font-normal"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Sign Out
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Header Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white/95 border-b border-neutral-200 backdrop-blur z-30 flex items-center justify-between px-4">
        <BrandMark size="sm" logoSrc={logoSrc} whiteLabel={whiteLabel} />
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-lg bg-neutral-100 border border-neutral-200 text-neutral-600 hover:text-neutral-900"
          aria-label="Toggle navigation menu"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-neutral-900/40 z-30 md:hidden backdrop-blur-xs"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Drawer Menu */}
      <aside
        className={`fixed top-0 bottom-0 left-0 w-64 bg-white border-r border-neutral-200 z-40 transform transition-transform duration-200 md:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {navContent}
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-neutral-200/80 flex-shrink-0 sticky top-0 h-screen overflow-y-auto z-30">
        {navContent}
      </aside>
    </>
  );
}
