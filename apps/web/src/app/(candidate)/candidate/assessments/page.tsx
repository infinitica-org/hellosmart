'use client';

import React from 'react';
import { PageHeader, EmptyState } from '@hs/ui';

export default function CandidateAssessmentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="My Assessments"
        description="Assigned work simulations and practical evaluation workspaces."
        badge={{ text: 'Candidate Portal', variant: 'info' }}
        breadcrumbs={[
          { label: 'Candidate', href: '/candidate' },
          { label: 'Assessments' },
        ]}
      />

      <div className="bg-white rounded-2xl border border-neutral-200/80 p-6 sm:p-8 shadow-xs">
        <EmptyState
          title="No active assignments"
          description="You do not currently have any pending assessments. Please check your invitation email or contact your hiring recruiter."
        />
      </div>
    </div>
  );
}

