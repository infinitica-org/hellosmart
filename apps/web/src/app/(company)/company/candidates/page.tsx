'use client';

import React from 'react';
import { PageHeader, EmptyState } from '@hs/ui';

export default function CompanyCandidatesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Candidates"
        description="Invite candidates, manage test assignments, monitor progress, and review scored submissions."
        badge={{ text: 'Candidate Pipeline', variant: 'info' }}
        breadcrumbs={[
          { label: 'Company', href: '/company' },
          { label: 'Candidates' },
        ]}
      />

      <div className="bg-white rounded-2xl border border-neutral-200/80 p-6 sm:p-8 shadow-xs">
        <EmptyState
          title="No candidates invited yet"
          description="Add candidate invitations individually or in bulk with single-use expiring links (BR-24)."
        />
      </div>
    </div>
  );
}

