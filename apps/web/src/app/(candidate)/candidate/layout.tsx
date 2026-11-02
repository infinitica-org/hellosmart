'use client';

import React from 'react';
import { PortalShell } from '@/components/layout/portal-shell';
import { usePortalAuth } from '@/hooks/use-portal-auth';
import { candidateGroups } from '@/types/navigation';

export default function CandidateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, signOut } = usePortalAuth();

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
