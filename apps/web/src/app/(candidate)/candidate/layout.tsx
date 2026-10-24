import React from 'react';
import { SidebarNav, type NavItem } from '@/components/navigation';

const candidateNavItems: NavItem[] = [
  {
    label: 'Assessments',
    href: '/candidate',
    badge: 'Tasks',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    label: 'Workspace Rules',
    href: '/candidate',
    badge: 'Policy',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    label: 'Submissions',
    href: '/candidate',
    badge: 'Results',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
];

export default function CandidateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex bg-[#090d16] text-slate-100">
      <SidebarNav
        portalTitle="Assessment Workspace"
        portalRole="candidate"
        items={candidateNavItems}
        userEmail="candidate@hellosmart.ai"
      />

      <div className="flex-1 flex flex-col min-w-0 pt-14 md:pt-0">
        <header className="h-16 border-b border-slate-800/80 px-6 sm:px-8 flex items-center justify-between bg-slate-950/40 backdrop-blur sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-mono">
              Candidate Workspace
            </span>
            <span className="text-slate-700">|</span>
            <span className="text-xs text-emerald-400 flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Isolated Sysbox Container Ready
            </span>
          </div>

          <div className="text-xs text-slate-400 hidden sm:block">
            Continuous Autosave (BR-11) &bull; Full-Screen Governed (BR-10)
          </div>
        </header>

        <main className="flex-1 p-6 sm:p-10 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
