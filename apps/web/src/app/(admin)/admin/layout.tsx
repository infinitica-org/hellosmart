'use client';

import React from 'react';
import { PortalShell } from '@/components/layout/portal-shell';
import { usePortalAuth } from '@/hooks/use-portal-auth';
import { adminGroups } from '@/types/navigation';
import { AdminStoreProvider } from '@/providers/store-provider';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = usePortalAuth({ requiredRole: 'platform_admin' });
  const user = auth.user;
  const loading = auth.loading;
  const isAuthorized = auth.isAuthorized ?? (Boolean(user) && user?.role === 'platform_admin');

  return (
    <AdminStoreProvider>
      <PortalShell
        portalTitle="Admin Console"
        userRole="Super Admin"
        userName={user?.name ?? (loading ? 'Loading…' : 'Platform Admin')}
        {...(user?.email ? { userEmail: user.email } : {})}
        companyName="HelloSmart Platform"
        groups={adminGroups}
        onLogout={auth.signOut}
      >
        {loading || !isAuthorized ? (
          <div
            className="flex items-center justify-center p-12 min-h-[300px]"
            data-testid="admin-layout-loading"
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
    </AdminStoreProvider>
  );
}
