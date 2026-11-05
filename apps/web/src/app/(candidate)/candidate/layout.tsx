'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { PortalShell } from '@/components/layout/portal-shell';
import { AssessmentNavbar } from '@/components/candidate/assessment-navbar';
import { usePortalAuth } from '@/hooks/use-portal-auth';
import { candidateGroups } from '@/types/navigation';
import { CandidateStoreProvider } from '@/providers/store-provider';

export default function CandidateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const auth = usePortalAuth({ requiredRole: 'candidate' });
  const user = auth.user;
  const loading = auth.loading;
  const isAuthorized = auth.isAuthorized ?? (Boolean(user) && user?.role === 'candidate');

  // Full-screen distraction-free mode for assessments (Diagnostics & Consent) and Workspace: dedicated assessment navbar, clean SaaS bg, NO sidebar
  const isAssessmentFlow = Boolean(
    pathname && (pathname.includes('/assessments/') || pathname.includes('/workspaces/') || pathname.includes('/workspace/'))
  );
  const isWorkspace = Boolean(
    pathname && (pathname.includes('/workspaces/') || pathname.includes('/workspace/'))
  );

  return (
    <CandidateStoreProvider>
      {loading || !isAuthorized ? (
        <div
          className="flex items-center justify-center p-12 min-h-[300px]"
          data-testid="candidate-layout-loading"
        >
          <div className="animate-pulse space-y-4 w-full max-w-md">
            <div className="h-6 bg-neutral-200 rounded w-1/3" />
            <div className="h-24 bg-neutral-100 rounded-lg" />
          </div>
        </div>
      ) : isAssessmentFlow ? (
        <div
          className={`${
            isWorkspace
              ? 'h-screen max-h-screen overflow-hidden'
              : 'min-h-screen'
          } bg-neutral-50/70 dark:bg-neutral-950 flex flex-col antialiased`}
        >
          <AssessmentNavbar userName={user?.name} />
          <main
            className={`flex-1 w-full mx-auto ${
              isWorkspace
                ? 'min-h-0 overflow-hidden flex flex-col max-w-[1680px] px-3 sm:px-5 lg:px-6 py-2.5 sm:py-3.5'
                : 'max-w-4xl px-4 sm:px-6 lg:px-8 py-8'
            }`}
          >
            {children}
          </main>
        </div>
      ) : (
        <PortalShell
          portalTitle="Candidate Portal"
          userRole="Candidate"
          userName={user?.name ?? 'Candidate'}
          {...(user?.email ? { userEmail: user.email } : {})}
          companyName={user?.org?.name ?? 'Candidate Workspace'}
          groups={candidateGroups}
          onLogout={auth.signOut}
          mainClassName="flex-1 w-full max-w-5xl mx-auto p-4 sm:p-6 md:p-8"
          footer={
            <div className="border-t border-card-border py-4 px-6 text-center text-xs text-neutral-500">
              Continuous Autosave (RPO &le; 30s, BR-11) &bull; Controlled Workspace Policy (BR-10, BR-12)
            </div>
          }
        >
          {children}
        </PortalShell>
      )}
    </CandidateStoreProvider>
  );
}
