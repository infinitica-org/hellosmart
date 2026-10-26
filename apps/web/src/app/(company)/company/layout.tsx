'use client';

import React, { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { companyNavigation } from '@/types/navigation';

export default function CompanyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const companyName = 'Company Portal';
  const userName = 'Company Admin';
  const userEmail = 'admin@company.com';

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
      {/* Reusable Sidebar with Dashboard, Assessments, Candidates, Analytics, Settings */}
      <Sidebar
        portalTitle="Company Portal"
        portalRole="company_admin"
        companyName={companyName}
        items={companyNavigation}
        userName={userName}
        userEmail={userEmail}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex flex-col min-w-0 pt-14 md:pt-0">
        {/* Top Navbar */}
        <header className="h-16 border-b border-neutral-200/80 px-6 sm:px-8 flex items-center justify-between bg-white/80 backdrop-blur sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase tracking-wider text-neutral-500 font-mono hidden sm:inline">
              Company Portal
            </span>
            <span className="text-neutral-300 hidden sm:inline">|</span>
            <span className="text-xs text-primary font-normal">
              Multi-Agent Rubric Hiring
            </span>
          </div>

          {/* Top Right: Company Name and User Menu with Logout */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-xs text-neutral-800">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span className="font-normal text-neutral-900">{companyName}</span>
            </div>

            {/* User Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-neutral-100/80 transition-colors border border-transparent hover:border-neutral-200 text-left"
                data-testid="company-user-menu-trigger"
                aria-label="User profile menu"
                aria-expanded={userMenuOpen}
              >
                <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-xs font-medium text-primary">
                  {userName.charAt(0)}
                </div>
                <div className="hidden lg:block text-left">
                  <div className="text-xs font-normal text-neutral-800">{userName}</div>
                  <div className="text-[10px] text-neutral-500 font-light">Admin</div>
                </div>
                <svg
                  className={`w-3.5 h-3.5 text-neutral-500 transition-transform ${
                    userMenuOpen ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white border border-neutral-200 shadow-xl shadow-neutral-900/10 py-1.5 z-40 text-xs">
                    <div className="px-3.5 py-2 border-b border-neutral-100">
                      <p className="font-medium text-neutral-900">{userName}</p>
                      <p className="text-[11px] text-neutral-500 font-light truncate">{userEmail}</p>
                    </div>

                    <div className="py-1">
                      <div className="px-3.5 py-1.5 text-neutral-600 font-normal">
                        Role: <span className="text-primary font-mono font-normal">company_admin</span>
                      </div>
                    </div>

                    <div className="pt-1 border-t border-neutral-100">
                      <button
                        type="button"
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        data-testid="company-logout-button"
                        className="w-full text-left px-3.5 py-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 flex items-center gap-2 transition-colors disabled:opacity-50 font-normal"
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
                </>
              )}
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
