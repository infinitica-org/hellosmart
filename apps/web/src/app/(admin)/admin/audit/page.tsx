'use client';

import React from 'react';
import { PageHeader, EmptyState } from '@hs/ui';

export default function AdminAuditPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        description="Immutable, append-only security and operational audit trail across all platform organizations (BR-31)."
        badge={{ text: 'Append-Only', variant: 'default' }}
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Audit Logs' },
        ]}
      />

      <div className="bg-white rounded-2xl border border-neutral-200/80 p-6 sm:p-8 shadow-xs">
        <EmptyState
          title="Audit Trail Stream"
          description="Global administrative actions (provisioning, key rotation, workspace destroy, permission changes) are logged immutably."
        />
      </div>
    </div>
  );
}
