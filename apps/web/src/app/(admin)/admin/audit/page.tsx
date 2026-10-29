'use client';

import React from 'react';
import { PageHeader, EmptyState, Card } from '@hs/ui';

export default function AdminAuditPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        description="Immutable, append-only security and operational audit trail across all platform organizations (BR-31)."
        badge={{ text: 'Append-Only', variant: 'default' }}
      />

      <Card className="p-6 sm:p-8">
        <EmptyState
          title="Audit Trail Stream"
          description="Global administrative actions (provisioning, key rotation, workspace destroy, permission changes) are logged immutably."
        />
      </Card>
    </div>
  );
}
