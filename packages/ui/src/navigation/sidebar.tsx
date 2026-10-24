'use client';

import React, { useState, ReactNode } from 'react';
import { BrandMark } from '../brand-mark';
import { Button } from '../components/button';

export interface SidebarItem {
  label: string;
  href: string;
  icon: ReactNode;
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
  renderLink?: (props: {
    href: string;
    children: ReactNode;
    className: string;
    onClick?: () => void;
  }) => ReactNode;
}

export const DEFAULT_COMPANY_NAV_ITEMS: SidebarItem[] = [
  {
    label: 'Assessments',
    href: '/company',
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
    label: 'AI Keys',
    href: '/company/ai-keys',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
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

export function Sidebar({
  portalTitle = 'Hiring Portal',
  portalRole = 'company_admin',
  companyName = 'Company Portal',
  items = DEFAULT_COMPANY_NAV_ITEMS,
  userName = 'Company Admin',
  userEmail = 'admin@company.com',
  currentPath,
  onLogout,
  renderLink,
}: SidebarProps): React.JSX.Element {
  const [mobileOpen, setMobileOpen] = useState(false);

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
        <div className="pb-5 pt-1 px-2 border-b border-slate-800/80">
          <div className="inline-block">
            <BrandMark size="md" />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">{portalTitle}</span>
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                portalRole === 'platform_admin'
                  ? 'bg-rose-950/80 text-rose-400 border-rose-800/60'
                  : 'bg-indigo-950/80 text-indigo-400 border-indigo-800/60'
              }`}
            >
              {portalRole === 'platform_admin' ? 'Platform Admin' : 'Company Admin'}
            </span>
          </div>
          <div className="mt-2 text-[11px] font-mono text-slate-400 truncate">
            {companyName}
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="mt-5 space-y-1" aria-label="Company Portal Navigation">
          {items.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/company' && pathname.startsWith(item.href));

            const linkClass = `flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              isActive
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 font-semibold shadow-sm shadow-indigo-950/50'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
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
                        <span className={isActive ? 'text-indigo-400' : 'text-slate-500'}>
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-700/60">
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
      <div className="pt-4 border-t border-slate-800/80 space-y-3">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-xs font-semibold text-indigo-300 flex-shrink-0">
            {userName ? userName.charAt(0).toUpperCase() : 'C'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-slate-200 truncate">{userName}</div>
            <div className="text-[11px] text-slate-500 truncate">{userEmail}</div>
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
            className="text-xs text-rose-400 hover:text-rose-300 border-slate-800 hover:border-rose-900/50 hover:bg-rose-950/20 flex items-center justify-center gap-2"
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
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-slate-950/90 border-b border-slate-800 backdrop-blur z-30 flex items-center justify-between px-4">
        <BrandMark size="sm" />
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
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
          className="fixed inset-0 bg-black/60 z-30 md:hidden backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Drawer Menu */}
      <aside
        className={`fixed top-0 bottom-0 left-0 w-64 bg-slate-950 border-r border-slate-800 z-40 transform transition-transform duration-200 md:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {navContent}
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-[#080c14] border-r border-slate-800/80 flex-shrink-0 sticky top-0 h-screen overflow-y-auto z-30">
        {navContent}
      </aside>
    </>
  );
}
