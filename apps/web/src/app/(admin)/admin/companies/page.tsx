'use client';

import React from 'react';
import { ToastProvider } from '@hs/ui';
import { AdminCompaniesView } from '@/components/admin/companies-view';

export default function AdminCompaniesPage() {
  return (
    <ToastProvider>
      <AdminCompaniesView
        title="Companies & Tenants"
        description="Provision, configure, and inspect customer organization workspaces, entitlements, and caps."
        badgeText="Multi-Tenant Scoped"
      />
    </ToastProvider>
  );
}
