'use client';

import React, { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';

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
    <div className="min-h-screen flex bg-[#090d16] text-slate-100">
      {/* Reusable Sidebar with Assessments, Candidates, AI Keys, Analytics, Settings */}
      <Sidebar
        companyName={companyName}
        userName={userName}
        userEmail={userEmail}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex flex-col min-w-0 pt-14 md:pt-0">
        {/* Top Navbar */}
        <header className="h-16 border-b border-slate-800/80 px-6 sm:px-8 flex items-center justify-between bg-slate-950/40 backdrop-blur sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-mono hidden sm:inline">
              Company Portal
            </span>
            <span className="text-slate-700 hidden sm:inline">|</span>
            <span className="text-xs text-indigo-400 font-medium">
              Multi-Agent Rubric Hiring
            </span>
          </div>

          {/* Top Right: Company Name and User Menu with Logout */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              <span className="font-medium text-white">{companyName}</span>
            </div>

            {/* User Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-900 transition-colors border border-transparent hover:border-slate-800 text-left"
                data-testid="company-user-menu-trigger"
                aria-label="User profile menu"
                aria-expanded={userMenuOpen}
              >
                <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-xs font-semibold text-indigo-300">
                  {userName.charAt(0)}
                </div>
                <div className="hidden lg:block text-left">
                  <div className="text-xs font-medium text-slate-200">{userName}</div>
                  <div className="text-[10px] text-slate-500">Admin</div>
                </div>
                <svg
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
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
                  <div className="absolute right-0 mt-2 w-56 rounded-xl bg-slate-900 border border-slate-800 shadow-xl shadow-black/80 py-1.5 z-40 text-xs">
                    <div className="px-3.5 py-2 border-b border-slate-800/80">
                      <p className="font-medium text-slate-200">{userName}</p>
                      <p className="text-[11px] text-slate-400 truncate">{userEmail}</p>
                    </div>

                    <div className="py-1">
                      <div className="px-3.5 py-1.5 text-slate-400">
                        Role: <span className="text-indigo-400 font-mono">company_admin</span>
                      </div>
                    </div>

                    <div className="pt-1 border-t border-slate-800/80">
                      <button
                        type="button"
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        data-testid="company-logout-button"
                        className="w-full text-left px-3.5 py-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 flex items-center gap-2 transition-colors disabled:opacity-50"
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
