'use client';

import React from 'react';
import { PageHeader, EmptyState } from '@hs/ui';

export default function CompanyAssessmentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Assessments"
        description="Version-pinned blueprints, rubrics, timing windows, and AI policies for candidate evaluations."
        badge={{ text: 'Templates & Rubrics', variant: 'info' }}
        breadcrumbs={[
          { label: 'Company', href: '/company' },
          { label: 'Assessments' },
        ]}
      />

      <div className="bg-white rounded-2xl border border-neutral-200/80 p-6 sm:p-8 shadow-xs">
        <EmptyState
          title="No assessments published"
          description="Create and publish your first assessment to start evaluating candidates in realistic work simulations."
        />
      </div>
    </div>
  );
}

