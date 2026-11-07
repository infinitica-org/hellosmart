'use client';

import React from 'react';
import { PortalShell } from '@/components/layout/portal-shell';
import { usePortalAuth } from '@/hooks/use-portal-auth';
import { companyGroups } from '@/types/navigation';
import { CompanyStoreProvider } from '@/providers/store-provider';

export default function CompanyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = usePortalAuth({ requiredRole: 'company_admin' });
  const user = auth.user;
  const loading = auth.loading;
  const isAuthorized = auth.isAuthorized ?? (Boolean(user) && user?.role === 'company_admin');

  return (
    <CompanyStoreProvider>
      <PortalShell
        portalTitle="Company Portal"
        userRole="Company Admin"
        userName={user?.name ?? (loading ? 'Loading…' : 'Company Admin')}
        {...(user?.email ? { userEmail: user.email } : {})}
        companyName={user?.org?.name ?? 'Company Portal'}
        groups={companyGroups}
        showHelp={false}
        onLogout={auth.signOut}
      >
        {loading || !isAuthorized ? (
          <div
            className="flex items-center justify-center p-12 min-h-[300px]"
            data-testid="company-layout-loading"
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
    </CompanyStoreProvider>
  );
}
