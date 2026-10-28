'use client';

import React from 'react';
import { PageHeader, EmptyState, Card } from '@hs/ui';

export default function CompanyAnalyticsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics & Insights"
        description="Candidate performance trends, rubric item distributions, and hiring completion metrics."
        badge={{ text: 'Analytics', variant: 'info' }}
      />

      <Card className="p-6 sm:p-8">
        <EmptyState
          title="No analytics data"
          description="Analytics and candidate score distributions will appear once evaluations are completed."
        />
      </Card>
    </div>
  );
}
