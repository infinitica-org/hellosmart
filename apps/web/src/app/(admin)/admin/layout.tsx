'use client';

import React, { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { adminNavigation } from '@/types/navigation';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const adminName = 'Platform Admin';
  const adminEmail = 'platform.admin@hellosmart.ai';

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    document.cookie = 'hs_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    document.cookie = 'hs_role=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen flex bg-canvas text-neutral-900 font-sans">
      {/* Fixed Left Sidebar */}
      <Sidebar
        portalTitle="Admin Console"
        portalRole="platform_admin"
        companyName="HelloSmart Platform"
        items={adminNavigation}
        userName={adminName}
        userEmail={adminEmail}
        onLogout={handleLogout}
      />

      {/* Right Column with Sticky Header and Scrollable Content */}
      <div className="flex-1 flex flex-col min-w-0 pt-14 md:pt-0">
        {/* Sticky Top Header on Right Side */}
        <header className="h-16 border-b border-neutral-200/80 px-6 sm:px-8 flex items-center justify-between bg-white/80 backdrop-blur sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase tracking-wider text-neutral-500 font-mono hidden sm:inline">
              Platform Administration
            </span>
            <span className="text-neutral-300 hidden sm:inline">|</span>
            <span className="text-xs text-primary flex items-center gap-1.5 font-normal">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              Multi-Tenant Cluster Active
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-xs text-rose-600 font-normal">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              <span>Super Admin</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-normal text-neutral-800">{adminName}</div>
                <div className="text-[10px] text-neutral-500 font-mono font-light">{adminEmail}</div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                data-testid="admin-logout-button"
                className="text-xs text-neutral-600 hover:text-rose-600 px-2.5 py-1.5 rounded-lg border border-neutral-200 hover:border-rose-200 hover:bg-rose-50 transition-colors flex items-center gap-1.5 font-normal"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                <span>{isLoggingOut ? 'Signing out...' : 'Log Out'}</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-6 sm:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
