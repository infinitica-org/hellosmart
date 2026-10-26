'use client';

import React from 'react';
import { PageHeader, EmptyState } from '@hs/ui';

export default function CompanySettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings & Integrations"
        description="Organization preferences, branding, AI provider key vault, and billing configuration."
        badge={{ text: 'Organization Settings', variant: 'default' }}
        breadcrumbs={[
          { label: 'Company', href: '/company' },
          { label: 'Settings' },
        ]}
      />

      <div className="bg-white rounded-2xl border border-neutral-200/80 p-6 sm:p-8 shadow-xs">
        <EmptyState
          title="Organization Configuration"
          description="Manage AI provider API keys (BR-16), white-label branding, and billing subscription."
        />
      </div>
    </div>
  );
}
