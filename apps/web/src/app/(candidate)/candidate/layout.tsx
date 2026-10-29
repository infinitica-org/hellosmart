'use client';

import React from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { candidateNavigation } from '@/types/navigation';

export default function CandidateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const candidateName = 'Candidate';
  const candidateEmail = 'candidate@hellosmart.ai';

  const handleLogout = async () => {
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
        {/* Desktop Topbar */}
        <Topbar
          variant="dashboard"
          showLogo={false}
          showProfile={true}
          showNotifications={false}
          userName={candidateName}
          userEmail={candidateEmail}
          userRole="Candidate"
          companyName="Candidate Workspace"
          onLogout={handleLogout}
          className="hidden md:flex h-16 px-6 sm:px-8 bg-white border-b border-neutral-200"
         
        />

        {/* Main Content Area */}
        <main className="flex-1 w-full max-w-5xl mx-auto p-4 sm:p-6 md:p-8">
          {children}
        </main>

        {/* Footer */}
        <div className="border-t border-neutral-200/80 py-4 px-6 text-center text-xs text-neutral-500 font-light">
          Continuous Autosave (RPO &le; 30s, BR-11) &bull; Controlled Workspace Policy (BR-10, BR-12)
        </div>
      </div>
    </div>
  );
}
