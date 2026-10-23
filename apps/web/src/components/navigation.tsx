'use client';

import React, { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BrandMark } from './brand-mark';

export interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  badge?: string;
  active?: boolean;
}

export interface SidebarNavProps {
  portalTitle: string;
  portalRole: 'platform_admin' | 'company_admin' | 'candidate';
  items: NavItem[];
  whiteLabel?: boolean | undefined;
  userEmail?: string | undefined;
}

export function SidebarNav({
  portalTitle,
  portalRole,
  items,
  whiteLabel = false,
  userEmail = 'user@hellosmart.ai',
}: SidebarNavProps) {
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

  const handleSignOut = (e: React.MouseEvent) => {
    e.preventDefault();
    // Clear non-sensitive routing hint cookie
    document.cookie = 'hs_role=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    router.push('/login');
  };

  const navContent = (
    <div className="flex flex-col justify-between h-full p-4">
      <div>
        {/* Brand header */}
        <div className="pb-6 pt-2 px-2 border-b border-slate-800/60">
          <BrandMark whiteLabel={whiteLabel} size="md" />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {portalTitle}
            </span>
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${roleBadgeColors[portalRole]}`}
            >
              {roleLabels[portalRole]}
            </span>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="mt-6 flex flex-col gap-1.5" aria-label="Sidebar navigation">
          {items.map((item, idx) => {
            const isActive =
              item.active ??
              (pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href)));
            return (
              <Link
                key={idx}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`${isActive ? 'text-indigo-400' : 'text-slate-500'}`}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700/60">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer / user status */}
      <div className="pt-4 border-t border-slate-800/60 px-2 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-medium text-slate-300">
            {userEmail[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium text-slate-200 truncate">{userEmail}</span>
            <span className="text-[10px] text-slate-500 truncate">{roleLabels[portalRole]}</span>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          type="button"
          className="text-xs text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-2 py-1 text-left"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar toggle */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-slate-950/90 backdrop-blur border-b border-slate-800 px-4 h-14 flex items-center justify-between">
        <BrandMark whiteLabel={whiteLabel} size="sm" />
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          type="button"
          className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-300"
          aria-label="Toggle Navigation"
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

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-shrink-0 min-h-screen bg-slate-950/80 border-r border-slate-800/80 sticky top-0">
        {navContent}
      </aside>

      {/* Mobile overlay sidebar */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-64 bg-slate-950 border-r border-slate-800 z-10 flex flex-col pt-14">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}

export interface HeaderNavProps {
  portalName: string;
  userRole?: string | undefined;
  orgName?: string | undefined;
  whiteLabel?: boolean | undefined;
  onSignOut?: () => void;
}

export function HeaderNav({
  portalName,
  userRole,
  orgName,
  whiteLabel,
  onSignOut,
}: HeaderNavProps) {
  const router = useRouter();

  const handleSignOut = () => {
    if (onSignOut) {
      onSignOut();
      return;
    }
    document.cookie = 'hs_role=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    router.push('/login');
  };

  return (
    <header className="h-16 border-b border-slate-800/80 bg-slate-950/50 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <BrandMark whiteLabel={whiteLabel} size="sm" />
        <span className="text-slate-600">/</span>
        <span className="text-sm font-semibold text-slate-200">{portalName}</span>
        {orgName && (
          <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-300 border border-slate-700/60">
            {orgName}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        {userRole && (
          <span className="text-xs text-slate-400 hidden sm:inline">
            Role: <span className="font-mono text-slate-300">{userRole}</span>
          </span>
        )}
        <button
          onClick={handleSignOut}
          type="button"
          className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
