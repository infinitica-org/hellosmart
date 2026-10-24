'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { BrandMark, Button } from '@hs/ui';

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
    <div className="min-h-screen flex flex-col bg-[#090d16] text-slate-100">
      {/* Distraction-Free Top Header with Candidate Name & Logout (No Sidebar) */}
      <header className="h-16 border-b border-slate-800/80 px-4 sm:px-8 flex items-center justify-between bg-slate-950/60 backdrop-blur sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link href="/candidate" className="flex items-center gap-2">
            <BrandMark size="sm" />
          </Link>
          <span className="text-slate-700 hidden sm:inline">|</span>
          <span className="text-xs uppercase tracking-wider text-slate-400 font-mono hidden sm:inline">
            Candidate Assessment Portal
          </span>
        </div>

        {/* Candidate Info and Logout */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-xs font-semibold text-emerald-300">
              {candidateName.charAt(0)}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-medium text-slate-200">{candidateName}</div>
              <div className="text-[10px] text-slate-500">{candidateEmail}</div>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleLogout}
            disabled={isLoggingOut}
            data-testid="candidate-logout-button"
            className="text-xs text-rose-400 hover:text-rose-300 border-slate-800 hover:border-rose-900/50 hover:bg-rose-950/20 flex items-center gap-1.5"
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

      {/* Main Focus Area (Distraction Free) */}
      <main className="flex-1 w-full max-w-5xl mx-auto p-4 sm:p-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 py-4 px-6 text-center text-xs text-slate-500">
        Continuous Autosave (RPO &le; 30s, BR-11) &bull; Controlled Workspace Policy (BR-10, BR-12)
      </footer>
    </div>
  );
}
