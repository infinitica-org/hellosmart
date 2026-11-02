'use client';

import React from 'react';
import { PortalShell } from '@/components/layout/portal-shell';
import { usePortalAuth } from '@/hooks/use-portal-auth';
import { adminGroups } from '@/types/navigation';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, signOut } = usePortalAuth();

  return (
    <PortalShell
      portalTitle="Admin Console"
      userRole="Super Admin"
      userName={user?.name ?? (loading ? 'Loading…' : 'Platform Admin')}
      {...(user?.email ? { userEmail: user.email } : {})}
      companyName="HelloSmart Platform"
      groups={adminGroups}
      onLogout={signOut}
    >
      {children}
    </PortalShell>
  );
}
