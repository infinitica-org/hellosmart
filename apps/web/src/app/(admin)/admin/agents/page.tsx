'use client';

import React from 'react';
import { PageHeader, EmptyState } from '@hs/ui';

export default function AdminAgentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reviewer Agent Library"
        description="Inspect and configure independent evaluation agents, rubric anchor dimensions, and aggregator thresholds."
        badge={{ text: 'Agent Service', variant: 'info' }}
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Agents' },
        ]}
      />

      <div className="bg-white rounded-2xl border border-neutral-200/80 p-6 sm:p-8 shadow-xs">
        <EmptyState
          title="Reviewer Agents Catalog"
          description="Independent AI reviewer agents evaluate submissions against pinned rubric dimensions and cite evidence."
        />
      </div>
    </div>
  );
}
