'use client';

import React from 'react';
import { ToastProvider } from '@hs/ui';
import { AdminCompaniesView } from '@/components/admin/companies-view';

export default function AdminDashboardPage() {
  return (
    <ToastProvider>
      <AdminCompaniesView
        title="Platform Administration"
        description="Customer Companies global tenant provisioning, entitlement enforcement, and platform telemetry."
        badgeText="Super Admin"
      />
    </ToastProvider>
  );
}
