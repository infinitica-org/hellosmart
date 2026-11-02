'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { PortalShell } from '@/components/layout/portal-shell';
import { AssessmentNavbar } from '@/components/candidate/assessment-navbar';
import { usePortalAuth } from '@/hooks/use-portal-auth';
import { candidateGroups } from '@/types/navigation';

export default function CandidateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, loading, signOut } = usePortalAuth();

  // Full-screen distraction-free mode for assessments (Diagnostics & Consent) and Workspace: dedicated assessment navbar, pure white bg, NO sidebar
  const isAssessmentFlow = Boolean(
    pathname && (pathname.includes('/assessments/') || pathname.includes('/workspaces/'))
  );

  if (isAssessmentFlow) {
    return (
      <div className="min-h-screen bg-white dark:bg-neutral-950 flex flex-col">
        <AssessmentNavbar userName={user?.name} />
        <main className="flex-1 w-full max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    );
  }

  return (
    <PortalShell
      portalTitle="Candidate Portal"
      userRole="Candidate"
      userName={user?.name ?? (loading ? 'Loading…' : 'Candidate')}
      {...(user?.email ? { userEmail: user.email } : {})}
      companyName={user?.org?.name ?? 'Candidate Workspace'}
      groups={candidateGroups}
      onLogout={signOut}
      mainClassName="flex-1 w-full max-w-5xl mx-auto p-4 sm:p-6 md:p-8"
      footer={
        <div className="border-t border-card-border py-4 px-6 text-center text-xs text-neutral-500">
          Continuous Autosave (RPO &le; 30s, BR-11) &bull; Controlled Workspace Policy (BR-10, BR-12)
        </div>
      }
    >
      {children}
    </PortalShell>
  );
}
