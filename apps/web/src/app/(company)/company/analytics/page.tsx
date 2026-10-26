'use client';

import React from 'react';
import { PageHeader, EmptyState } from '@hs/ui';

export default function CompanyAnalyticsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics & Insights"
        description="Candidate performance trends, rubric item distributions, and hiring completion metrics."
        badge={{ text: 'Analytics', variant: 'info' }}
        breadcrumbs={[
          { label: 'Company', href: '/company' },
          { label: 'Analytics' },
        ]}
      />

      <div className="bg-white rounded-2xl border border-neutral-200/80 p-6 sm:p-8 shadow-xs">
        <EmptyState
          title="No analytics data"
          description="Analytics and candidate score distributions will appear once evaluations are completed."
        />
      </div>
    </div>
  );
}
