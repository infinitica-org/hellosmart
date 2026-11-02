'use client';

import React from 'react';
import { PortalShell } from '@/components/layout/portal-shell';
import { usePortalAuth } from '@/hooks/use-portal-auth';
import { candidateGroups } from '@/types/navigation';
import { CandidateStoreProvider } from '@/providers/store-provider';

export default function CandidateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = usePortalAuth({ requiredRole: 'candidate' });
  const user = auth.user;
  const loading = auth.loading;
  const isAuthorized = auth.isAuthorized ?? (Boolean(user) && user?.role === 'candidate');

  return (
    <CandidateStoreProvider>
      <PortalShell
        portalTitle="Candidate Portal"
        userRole="Candidate"
        userName={user?.name ?? (loading ? 'Loading…' : 'Candidate')}
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
        ) : (
          children
        )}
      </PortalShell>
    </CandidateStoreProvider>
  );
}
