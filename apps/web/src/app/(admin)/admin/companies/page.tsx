'use client';

import React from 'react';
import Link from 'next/link';
import { PageHeader, Button } from '@hs/ui';

export default function AdminCompaniesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Companies & Tenants"
        description="Provision, configure, and inspect customer organization workspaces, entitlements, and caps."
        badge={{ text: 'Multi-Tenant Scoped', variant: 'default' }}
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Companies' },
        ]}
        actions={
          <Link href="/admin">
            <Button variant="primary" className="bg-primary hover:bg-primary-hover text-white border-transparent font-medium">
              Go to Organizations Table →
            </Button>
          </Link>
        }
      />

      <div className="bg-white rounded-2xl border border-neutral-200/80 p-6 sm:p-8 shadow-xs">
        <p className="text-sm text-neutral-600 font-normal">
          Company tenant management and provisioning are unified on the main admin dashboard.
        </p>
        <div className="mt-4">
          <Link href="/admin" className="text-xs text-primary hover:underline font-medium">
            ← View all provisioned organizations
          </Link>
        </div>
      </div>
    </div>
  );
}
