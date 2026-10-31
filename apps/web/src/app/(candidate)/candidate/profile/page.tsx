'use client';

import React from 'react';
import { PageHeader, Card } from '@hs/ui';
import { usePortalAuth } from '@/hooks/use-portal-auth';

export default function CandidateProfilePage() {
  const { user } = usePortalAuth();
  const candidateName = user?.name || 'Candidate';
  const candidateEmail = user?.email || '';

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Profile"
        description="Candidate account details, contact email, and session verification preferences."
        badge={{ text: 'Candidate Account', variant: 'default' }}
      />

      <Card className="p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="flex items-center gap-4 pb-6 border-b border-neutral-100">
          <div className="w-14 h-14 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-lg font-medium text-primary">
            {candidateName.charAt(0) || 'C'}
          </div>
          <div>
            <h2 className="text-base font-medium text-neutral-900">{candidateName}</h2>
            <p className="text-xs text-neutral-500 font-light">{candidateEmail}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200/80 space-y-1">
            <span className="text-neutral-500 block font-light">Status</span>
            <span className="text-neutral-800 font-medium">Active</span>
          </div>
          <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200/80 space-y-1">
            <span className="text-neutral-500 block font-light">Timezone</span>
            <span className="text-neutral-800 font-medium">UTC</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
