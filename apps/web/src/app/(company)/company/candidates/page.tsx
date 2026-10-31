'use client';

import React, { useState, useMemo } from 'react';
import { PageHeader, Alert, Card, StatCard, Users, Mail, Check } from '@hs/ui';
import {
  CandidateToolbar,
  CandidateTable,
  InviteCandidateDialog,
  BulkUploadDialog,
  EditCandidateDialog,
  DeleteCandidateDialog,
  type CandidateDto,
  type CandidateFilters,
  type CandidateStatus,
  type CreateCandidateDto,
  type UpdateCandidateInput,
} from '@/components/company/candidates';
import {
  useCandidates,
  useInviteCandidate,
  useBulkUploadCandidates,
  useUpdateCandidate,
  useDeleteCandidate,
  useResendCandidateInvite,
} from '@/hooks/company/use-candidates';

export default function CompanyCandidatesPage() {
  // Query Filters state
  const [filters, setFilters] = useState<CandidateFilters>({
    search: '',
    status: 'all',
    page: 1,
    limit: 10,
  });

  // Dialog states
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<CandidateDto | null>(null);
  const [deletingCandidate, setDeletingCandidate] = useState<CandidateDto | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Queries & Mutations
  const { data, isLoading, error, refetch } = useCandidates(filters);
  const inviteMutation = useInviteCandidate();
  const bulkUploadMutation = useBulkUploadCandidates();
  const updateMutation = useUpdateCandidate();
  const deleteMutation = useDeleteCandidate();
  const resendMutation = useResendCandidateInvite();

  const candidates = data?.items ?? [];
  const total = data?.total ?? 0;

  // Compute metrics and existing emails set
  const metrics = useMemo(() => {
    let invitedCount = 0;
    let activeCount = 0;

    for (const c of candidates) {
      if (c.status === 'invited') invitedCount++;
      if (c.status === 'active') activeCount++;
    }

    return {
      total,
      invited: invitedCount,
      active: activeCount,
    };
  }, [candidates, total]);

  const existingEmails = useMemo(() => {
    return new Set(candidates.map((c) => c.email.toLowerCase()));
  }, [candidates]);

  // Handlers
  const handleSearchChange = (search: string) => {
    setFilters((prev) => ({ ...prev, search, page: 1 }));
  };

  const handleStatusChange = (status: CandidateStatus | 'all') => {
    setFilters((prev) => ({ ...prev, status, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  const handleResetFilters = () => {
    setFilters({
      search: '',
      status: 'all',
      page: 1,
      limit: 10,
    });
  };

  const handleInviteSubmit = async (dto: CreateCandidateDto) => {
    await inviteMutation.mutateAsync(dto);
    setNotification({
      type: 'success',
      message: `Invitation email dispatched to ${dto.email} (expiring in 72 hours).`,
    });
    void refetch();
  };

  const handleBulkImportSubmit = async (batch: CreateCandidateDto[]) => {
    const res = await bulkUploadMutation.mutateAsync({ candidates: batch });
    setNotification({
      type: 'success',
      message: `Successfully imported ${res.created.length} candidates.`,
    });
    void refetch();
    return res;
  };

  const handleEditSubmit = async (candidateId: string, input: UpdateCandidateInput) => {
    await updateMutation.mutateAsync({ candidateId, input });
    setNotification({
      type: 'success',
      message: 'Candidate profile updated successfully.',
    });
    void refetch();
  };

  const handleDeleteConfirm = async (candidateId: string) => {
    await deleteMutation.mutateAsync(candidateId);
    setNotification({
      type: 'info',
      message: 'Candidate soft-deleted and active sessions terminated.',
    });
    void refetch();
  };

  const handleResendInvite = async (candidate: CandidateDto) => {
    try {
      await resendMutation.mutateAsync(candidate.id);
      setNotification({
        type: 'success',
        message: `Fresh invitation link sent to ${candidate.email}.`,
      });
      void refetch();
    } catch {
      setNotification({
        type: 'info',
        message: `Failed to resend invitation to ${candidate.email}.`,
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Candidate Hub"
        description="Invite candidates, manage test assignments, monitor progress, and review scored submissions."
        badge={{ text: 'Candidate Pipeline', variant: 'info' }}
      />

      {/* Action Notification */}
      {notification && (
        <Alert
          variant={notification.type === 'success' ? 'success' : 'info'}
          title={notification.type === 'success' ? 'Action Completed' : 'Notice'}
        >
          <div className="flex items-center justify-between">
            <span>{notification.message}</span>
            <button
              type="button"
              onClick={() => setNotification(null)}
              className="ml-4 text-xs font-semibold underline hover:opacity-80"
            >
              Dismiss
            </button>
          </div>
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="error" title="Failed to Load Candidates">
          {error.message || 'An error occurred while fetching organization candidates.'}
        </Alert>
      )}

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Candidates"
          value={metrics.total.toString()}
          description="Organization candidate pool"
          icon={<Users className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />}
        />
        <StatCard
          label="Invited Candidates"
          value={metrics.invited.toString()}
          description="Pending account activation (BR-24)"
          icon={<Mail className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
        />
        <StatCard
          label="Active Candidates"
          value={metrics.active.toString()}
          description="Password set & test ready"
          icon={<Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
        />
      </div>

      {/* Directory Card */}
      <Card className="p-6 space-y-6">
        <CandidateToolbar
          search={filters.search}
          onSearchChange={handleSearchChange}
          status={filters.status}
          onStatusChange={handleStatusChange}
          onOpenInvite={() => setIsInviteOpen(true)}
          onOpenBulkUpload={() => setIsBulkOpen(true)}
          disabled={isLoading}
        />

        <CandidateTable
          candidates={candidates}
          total={total}
          filters={filters}
          onPageChange={handlePageChange}
          isLoading={isLoading}
          onEdit={(c) => setEditingCandidate(c)}
          onDelete={(c) => setDeletingCandidate(c)}
          onResendInvite={handleResendInvite}
          onResetFilters={handleResetFilters}
          onOpenInvite={() => setIsInviteOpen(true)}
          isResendingId={resendMutation.isPending ? resendMutation.variables : null}
        />
      </Card>

      {/* Dialogs */}
      <InviteCandidateDialog
        open={isInviteOpen}
        onOpenChange={setIsInviteOpen}
        onSubmit={handleInviteSubmit}
        isSubmitting={inviteMutation.isPending}
      />

      <BulkUploadDialog
        open={isBulkOpen}
        onOpenChange={setIsBulkOpen}
        onImport={handleBulkImportSubmit}
        existingEmails={existingEmails}
        isSubmitting={bulkUploadMutation.isPending}
      />

      <EditCandidateDialog
        candidate={editingCandidate}
        open={Boolean(editingCandidate)}
        onOpenChange={(open) => !open && setEditingCandidate(null)}
        onSubmit={handleEditSubmit}
        isSubmitting={updateMutation.isPending}
      />

      <DeleteCandidateDialog
        candidate={deletingCandidate}
        open={Boolean(deletingCandidate)}
        onOpenChange={(open) => !open && setDeletingCandidate(null)}
        onConfirm={handleDeleteConfirm}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}
