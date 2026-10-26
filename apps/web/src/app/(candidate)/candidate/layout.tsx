'use client';

import React, { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { candidateNavigation } from '@/types/navigation';
import { Button } from '@hs/ui';

export default function CandidateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const candidateName = 'Candidate';
  const candidateEmail = 'candidate@hellosmart.ai';

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
      {/* Candidate Sidebar with Dashboard, My Assessments, My Profile */}
      <Sidebar
        portalTitle="Candidate Portal"
        portalRole="candidate"
        companyName="Candidate Workspace"
        items={candidateNavigation}
        userName={candidateName}
        userEmail={candidateEmail}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex flex-col min-w-0 pt-14 md:pt-0">
        {/* Top Navbar */}
        <header className="h-16 border-b border-neutral-200/80 px-4 sm:px-8 flex items-center justify-between bg-white/80 backdrop-blur sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase tracking-wider text-neutral-500 font-mono hidden sm:inline">
              Candidate Workspace
            </span>
            <span className="text-neutral-300 hidden sm:inline">|</span>
            <span className="text-xs text-primary font-normal">
              Controlled Simulation Environment
            </span>
          </div>

          {/* Candidate Info and Logout */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-xs font-medium text-primary">
                {candidateName.charAt(0)}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-normal text-neutral-800">{candidateName}</div>
                <div className="text-[10px] text-neutral-500 font-light">{candidateEmail}</div>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleLogout}
              disabled={isLoggingOut}
              data-testid="candidate-logout-button"
              className="text-xs text-neutral-600 hover:text-rose-600 border-neutral-200 hover:border-rose-200 hover:bg-rose-50 flex items-center gap-1.5 font-normal"
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
            </Button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 w-full max-w-5xl mx-auto p-4 sm:p-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-neutral-200/80 py-4 px-6 text-center text-xs text-neutral-500 font-light">
          Continuous Autosave (RPO &le; 30s, BR-11) &bull; Controlled Workspace Policy (BR-10, BR-12)
        </footer>
      </div>
    </div>
  );
}
