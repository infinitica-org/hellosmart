'use client';

import React from 'react';
import { PageHeader, EmptyState, Card } from '@hs/ui';
import { UI_LABELS } from '@/constants';

export default function CompanyAssessmentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title={UI_LABELS.PAGE_HEADERS.ASSESSMENT_HUB_TITLE}
        description={UI_LABELS.PAGE_HEADERS.ASSESSMENT_HUB_DESCRIPTION}
        badge={{ text: 'Templates & Rubrics', variant: 'info' }}
      />

      <Card className="p-6 sm:p-8">
        <EmptyState
          title="No assessments published"
          description="Create and publish your first assessment to start evaluating candidates in realistic work simulations."
        />
      </Card>
    </div>
  );
}
