'use client';

import React from 'react';
import { PageHeader, EmptyState, Card } from '@hs/ui';

export default function CandidateAssessmentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="My Assessments"
        description="Assigned work simulations and practical evaluation workspaces."
        badge={{ text: 'Candidate Portal', variant: 'info' }}
      />

      <Card className="p-6 sm:p-8">
        <EmptyState
          title="No active assignments"
          description="You do not currently have any pending assessments. Please check your invitation email or contact your hiring recruiter."
        />
      </Card>
    </div>
  );
}
