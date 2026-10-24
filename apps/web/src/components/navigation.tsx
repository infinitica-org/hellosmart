'use client';

import React, { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BrandMark } from '@hs/ui';

export interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  badge?: string | undefined;
  active?: boolean | undefined;
}

export interface SidebarNavProps {
  portalTitle: string;
  portalRole: 'platform_admin' | 'company_admin' | 'candidate';
  items: NavItem[];
  whiteLabel?: boolean | undefined;
  userEmail?: string | undefined;
  onSignOut?: (() => void) | undefined;
}

export function SidebarNav({
  portalTitle,
  portalRole,
  items,
  whiteLabel = false,
  userEmail = 'user@hellosmart.ai',
  onSignOut,
}: SidebarNavProps): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const roleLabels = {
    platform_admin: 'Platform Admin',
    company_admin: 'Company Admin',
    candidate: 'Candidate',
  };

  const roleBadgeColors = {
    platform_admin: 'bg-rose-950/80 text-rose-400 border-rose-800/60',
    company_admin: 'bg-indigo-950/80 text-indigo-400 border-indigo-800/60',
    candidate: 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60',
  };

  const handleSignOut = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (onSignOut) {
      onSignOut();
      return;
    }
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    router.push('/login');
  };

  const navContent = (
    <div className="flex flex-col justify-between h-full p-4">
      <div>
        {/* Brand header */}
        <div className="pb-6 pt-2 px-2 border-b border-slate-800/60">
          <BrandMark whiteLabel={whiteLabel} size="md" />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">{portalTitle}</span>
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${roleBadgeColors[portalRole]}`}
            >
              {roleLabels[portalRole]}
            </span>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="mt-6 space-y-1">
          {items.map((item) => {
            const isActive = item.active !== undefined ? item.active : pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={isActive ? 'text-indigo-400' : 'text-slate-500'}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-300">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User profile footer */}
      <div className="pt-4 border-t border-slate-800/60">
        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/40 border border-slate-800/40">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-xs font-semibold text-indigo-300 flex-shrink-0">
              {userEmail.charAt(0).toUpperCase()}
            </div>
            <div className="truncate">
              <p className="text-xs font-medium text-slate-200 truncate">{userEmail}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            title="Sign out"
            className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors rounded-lg hover:bg-slate-800/60"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden h-14 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-4 flex items-center justify-between sticky top-0 z-30">
        <BrandMark whiteLabel={whiteLabel} size="sm" />
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 text-slate-400 hover:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label="Toggle navigation"
        >
          {mobileOpen ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm">
          <div className="fixed inset-y-0 left-0 w-64 bg-slate-950 border-r border-slate-800 shadow-xl">
            {navContent}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 border-r border-slate-800/80 bg-slate-950/60 backdrop-blur-md z-20">
        {navContent}
      </aside>
    </>
  );
}

export interface HeaderNavProps {
  portalName: string;
  userRole: 'candidate' | 'company_admin' | 'platform_admin';
  userEmail?: string | undefined;
  orgName?: string | undefined;
  whiteLabel?: boolean | undefined;
  onSignOut?: (() => void) | undefined;
}

export function HeaderNav({
  portalName,
  userEmail = 'candidate@hellosmart.ai',
  orgName,
  whiteLabel,
  onSignOut,
}: HeaderNavProps): React.JSX.Element {
  const router = useRouter();

  const handleSignOut = async () => {
    if (onSignOut) {
      onSignOut();
      return;
    }
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    router.push('/login');
  };

  return (
    <header className="h-16 border-b border-slate-800/80 bg-slate-950/50 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <BrandMark whiteLabel={whiteLabel} size="sm" />
        <span className="text-slate-600">/</span>
        <span className="text-sm font-semibold text-slate-200">{portalName}</span>
        {orgName && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-400 border border-slate-700/60">
            {orgName}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-950/80 border border-emerald-800/60 flex items-center justify-center text-xs font-semibold text-emerald-400">
            {userEmail.charAt(0).toUpperCase()}
          </div>
          <span className="text-xs text-slate-400 hidden sm:inline">{userEmail}</span>
        </div>
        <button
          onClick={handleSignOut}
          title="Sign out"
          className="text-xs text-slate-400 hover:text-rose-400 transition-colors px-2 py-1 rounded-md hover:bg-slate-900/60"
        >
          Sign Out
        </button>
      </div>
    </header>
  );
}
