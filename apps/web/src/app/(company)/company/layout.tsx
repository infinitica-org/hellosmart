'use client';

import React from 'react';
import { PortalShell } from '@/components/layout/portal-shell';
import { usePortalAuth } from '@/hooks/use-portal-auth';
import { companyGroups } from '@/types/navigation';

export default function CompanyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, signOut } = usePortalAuth();

  return (
    <PortalShell
      portalTitle="Company Portal"
      userRole="Company Admin"
      userName={user?.name ?? (loading ? 'Loading…' : 'Company Admin')}
      {...(user?.email ? { userEmail: user.email } : {})}
      companyName={user?.org?.name ?? 'Company Portal'}
      groups={companyGroups}
      onLogout={signOut}
    >
      {children}
    </PortalShell>
  );
}
