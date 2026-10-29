'use client';

import React from 'react';
import { PageHeader, EmptyState, Card } from '@hs/ui';

export default function CompanySettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings & Integrations"
        description="Organization preferences, branding, AI provider key vault, and billing configuration."
        badge={{ text: 'Organization Settings', variant: 'default' }}
      />

      <Card className="p-6 sm:p-8">
        <EmptyState
          title="Organization Configuration"
          description="Manage AI provider API keys (BR-16), white-label branding, and billing subscription."
        />
      </Card>
    </div>
  );
}
