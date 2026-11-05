'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { PageHeader, Card, Alert, Badge, Button } from '@hs/ui';
import { usePortalAuth } from '@/hooks/use-portal-auth';
import type { UserMe } from '@/lib/api-client';

export interface CandidateProfileViewProps {
  user?: UserMe | null | undefined;
  loading?: boolean | undefined;
  timezone?: string | undefined;
  onSignOut?: (() => Promise<void>) | undefined;
}

export function CandidateProfileView({
  user = null,
  loading = false,
  timezone = 'UTC',
  onSignOut,
}: CandidateProfileViewProps) {
  if (loading && !user) {
    return (
      <div className="space-y-6" data-testid="candidate-profile-loading">
        <PageHeader
          title="My Profile"
          description="Candidate account details, contact email, and session verification preferences."
          badge={{ text: 'Loading…', variant: 'default' }}
        />
        <Card className="p-6 sm:p-8 space-y-4 shadow-xs">
          <div className="animate-pulse flex items-center gap-4 pb-6 border-b border-neutral-100">
            <div className="w-14 h-14 rounded-full bg-neutral-200" />
            <div className="space-y-2">
              <div className="h-4 w-32 bg-neutral-200 rounded" />
              <div className="h-3 w-48 bg-neutral-200 rounded" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="h-20 bg-neutral-100 rounded-xl animate-pulse" />
            <div className="h-20 bg-neutral-100 rounded-xl animate-pulse" />
          </div>
        </Card>
      </div>
    );
  }

  const name = user?.name || (user?.email ? user.email.split('@')[0] : 'Candidate');
  const email = user?.email || 'candidate@hellosmart.ai';
  const initial = (name || 'C').charAt(0).toUpperCase();
  const companyName = user?.org?.name || 'HelloSmart Simulation';
  const candidateId = user?.id || '—';
  const isResetRequired = Boolean(user?.mustResetPassword);

  return (
    <div className="space-y-6" data-testid="candidate-profile-page">
      <PageHeader
        title="My Profile"
        description="Candidate account details, contact email, and session verification preferences."
        badge={{
          text: isResetRequired ? 'Reset Required (BR-24)' : 'Candidate Account',
          variant: isResetRequired ? 'warning' : 'default',
        }}
        data-testid="profile-page-header"
      />

      {isResetRequired && (
        <Alert variant="warning" data-testid="profile-reset-warning">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
            <div>
              <p className="font-semibold text-neutral-900">First-Time Login: Password Reset Required</p>
              <p className="text-xs text-neutral-700 mt-0.5">
                Per security rule BR-24, you must choose a secure permanent password before completing assessments.
              </p>
            </div>
            <Link href="/change-password" className="shrink-0">
              <Button variant="primary" size="sm">
                Reset Password Now →
              </Button>
            </Link>
          </div>
        </Alert>
      )}

      {/* Primary Profile Identity Card */}
      <Card className="p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-100">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-lg font-medium text-primary shrink-0"
              data-testid="profile-avatar"
            >
              {initial}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-neutral-900" data-testid="profile-name">
                  {name}
                </h2>
                <Badge
                  variant={isResetRequired ? 'warning' : 'success'}
                  size="sm"
                >
                  {isResetRequired ? 'Reset Required' : 'Active & Verified'}
                </Badge>
              </div>
              <p className="text-xs text-neutral-500 font-light mt-0.5" data-testid="profile-email">
                {email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <Link href="/change-password">
              <Button variant="outline" size="sm" data-testid="profile-change-password-btn">
                Change Password
              </Button>
            </Link>
            {onSignOut && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void onSignOut()}
                data-testid="profile-signout-btn"
              >
                Sign Out
              </Button>
            )}
          </div>
        </div>

        {/* Account & Tenancy Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200/80 space-y-1">
            <span className="text-neutral-500 block font-light">Status</span>
            <span className="text-neutral-800 font-medium" data-testid="profile-status">
              {isResetRequired ? 'Password Reset Required (BR-24)' : 'Ready for Assessment'}
            </span>
            <span className="text-[11px] text-neutral-400 block">Server-enforced session authentication</span>
          </div>

          <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200/80 space-y-1">
            <span className="text-neutral-500 block font-light">Detected Timezone</span>
            <span className="text-neutral-800 font-medium" data-testid="profile-timezone">
              {timezone}
            </span>
            <span className="text-[11px] text-neutral-400 block">Timing windows evaluated in UTC (BR-08)</span>
          </div>

          <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200/80 space-y-1">
            <span className="text-neutral-500 block font-light">Assessing Organization</span>
            <span className="text-neutral-800 font-medium" data-testid="profile-org">
              {companyName}
            </span>
            <span className="text-[11px] text-neutral-400 block">Assigned private templates (BR-02)</span>
          </div>

          <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200/80 space-y-1">
            <span className="text-neutral-500 block font-light">Candidate Account ID</span>
            <span className="text-neutral-800 font-mono font-normal" data-testid="profile-id">
              {candidateId}
            </span>
            <span className="text-[11px] text-neutral-400 block">Strict tenant isolation boundary (BR-01)</span>
          </div>
        </div>
      </Card>

      {/* Assessment Access Quick Action */}
      <Card className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Work Simulation Assessments</h3>
            <p className="text-xs text-neutral-500 font-normal mt-0.5">
              Launch assigned technical evaluations in the governed cloud workspace with continuous autosave (BR-11).
            </p>
          </div>
          <Link href="/candidate/assessments">
            <Button variant="primary" size="sm">
              View My Assessments →
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}

export default function CandidateProfilePage() {
  const { user, loading, signOut } = usePortalAuth({ requiredRole: 'candidate' });
  const [timezone, setTimezone] = useState<string>('UTC');

  useEffect(() => {
    try {
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    } catch {
      setTimezone('UTC');
    }
  }, []);

  return (
    <CandidateProfileView
      user={user}
      loading={loading}
      timezone={timezone}
      onSignOut={signOut}
    />
  );
}
