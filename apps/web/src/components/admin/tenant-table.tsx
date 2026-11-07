'use client';

import React, { useState, useEffect } from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  EmptyState,
  Spinner,
  Pagination,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  AlertDialog,
  useToast,
  IconButton,
  CheckCircle2,
  AlertTriangle,
  MoreHorizontal,
} from '@hs/ui';
import { Organization, OrganizationStatus } from '@/types/organization';
import { useUpdateOrganizationStatusMutation } from '@/store/admin/adminApi';

export interface TenantTableProps {
  organizations: Organization[];
  isLoading?: boolean;
  onRefresh?: () => void;
  'data-testid'?: string;
  isFiltered?: boolean;
  onResetFilters?: () => void;
  onOpenProvision?: () => void;
}

export function TenantTable({
  organizations,
  isLoading = false,
  onRefresh,
  'data-testid': testId = 'tenant-table',
  isFiltered = false,
  onResetFilters,
  onOpenProvision,
}: TenantTableProps) {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const total = organizations.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Reset pagination when organizations array length changes
  useEffect(() => {
    setPage(1);
  }, [organizations.length]);

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    org: Organization | null;
    targetStatus: OrganizationStatus;
  }>({
    open: false,
    org: null,
    targetStatus: 'suspended',
  });
  const [updateStatus, { isLoading: isUpdating }] = useUpdateOrganizationStatusMutation();

  const handleOpenConfirm = (org: Organization, targetStatus: OrganizationStatus) => {
    setConfirmDialog({
      open: true,
      org,
      targetStatus,
    });
  };

  const handleConfirmStatusChange = async () => {
    const { org, targetStatus } = confirmDialog;
    if (!org) return;

    try {
      await updateStatus({ id: org.id, status: targetStatus }).unwrap();

      toast({
        title: targetStatus === 'suspended' ? 'Company Suspended' : 'Company Reinstated',
        description: `"${org.name}" status updated to ${targetStatus}.`,
        variant: targetStatus === 'suspended' ? 'warning' : 'success',
      });

      setConfirmDialog({ open: false, org: null, targetStatus: 'suspended' });
      onRefresh?.();
    } catch (err: any) {
      toast({
        title: 'Status Update Failed',
        description: err?.data?.message || err?.message || 'An unexpected error occurred.',
        variant: 'error',
      });
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  // Loading state (matching CandidateTable)
  if (isLoading && organizations.length === 0) {
    return (
      <div className="flex min-h-[300px] items-center justify-center rounded-lg border border-neutral-200 bg-white p-12 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" className="text-primary-600" />
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading organizations...</p>
        </div>
      </div>
    );
  }

  // Empty state (matching CandidateTable)
  if (organizations.length === 0) {
    return (
      <div
        className="rounded-lg border border-neutral-200 bg-white p-8 dark:border-neutral-800 dark:bg-neutral-900"
        data-testid={testId}
      >
        <EmptyState
          title={isFiltered ? 'No companies match your criteria' : 'No customer companies found'}
          description={
            isFiltered
              ? 'Try modifying your search keywords or resetting status filters to view more organizations.'
              : 'Tenants must be provisioned by a Platform Admin (no public self-signup in MMP).'
          }
          action={
            isFiltered && onResetFilters
              ? {
                  label: 'Clear Filters',
                  onClick: onResetFilters,
                }
              : onOpenProvision
              ? {
                  label: 'Provision New Company',
                  onClick: onOpenProvision,
                }
              : undefined
          }
        />
      </div>
    );
  }

  const paginatedOrgs = organizations.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <Table data-testid={testId}>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30%]">COMPANY</TableHead>
              <TableHead className="w-[20%]">STATUS</TableHead>
              <TableHead className="w-[20%]">CAP ALLOCATION</TableHead>
              <TableHead className="w-[15%]">DATE ADDED</TableHead>
              <TableHead className="w-[15%] text-right">ACTIONS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedOrgs.map((org) => {
              const isSuspended = org.status === 'suspended';
              const isTrial = org.status === 'trial' || org.status === 'trial_active';
              const isActive = org.status === 'active' || org.status === 'paid_active';
              const isProvisioned = org.status === 'provisioned';
              const isTrialExpired = org.status === 'trial_expired';

              let badgeVariant: 'success' | 'warning' | 'danger' | 'default' = 'danger';
              let statusLabel = 'Suspended';

              if (isActive) {
                badgeVariant = 'success';
                statusLabel = 'Active';
              } else if (isTrial) {
                badgeVariant = 'warning';
                statusLabel = 'Trial';
              } else if (isProvisioned) {
                badgeVariant = 'default';
                statusLabel = 'Provisioned';
              } else if (isTrialExpired) {
                badgeVariant = 'danger';
                statusLabel = 'Trial Expired';
              }

              const targetReinstateStatus: OrganizationStatus =
                org.plan === 'trial' ? 'trial' : 'active';

              return (
                <TableRow
                  key={org.id}
                  className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50"
                  data-testid={`tenant-row-${org.slug}`}
                >
                  {/* Company Name, Avatar & Email */}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                        {org.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium text-neutral-900 dark:text-neutral-100">
                            {org.name}
                          </span>
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 border border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700">
                            {org.plan}
                          </span>
                        </div>
                        <div className="truncate text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                          {org.adminEmail} &bull; <span className="text-neutral-400">{org.slug}</span>
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  {/* Status Badge */}
                  <TableCell>
                    <Badge
                      variant={badgeVariant}
                      dot
                      className="font-semibold uppercase text-[11px] tracking-wide"
                      data-testid={`tenant-status-${org.slug}`}
                    >
                      {statusLabel}
                    </Badge>
                  </TableCell>

                  {/* Cap Allocation */}
                  <TableCell>
                    <div className="text-xs text-neutral-600 dark:text-neutral-400">
                      {org.candidatesCount
                        ? `${org.candidatesCount} / ${org.maxCandidates || '∞'}`
                        : 'Pending (2x Cap Pool)'}
                    </div>
                    {org.candidatesCount ? (
                      <div className="text-[11px] text-neutral-400 dark:text-neutral-500">
                        Pending (2x Cap Pool)
                      </div>
                    ) : null}
                  </TableCell>

                  {/* Date Added */}
                  <TableCell>
                    <span className="text-xs text-neutral-600 dark:text-neutral-400 font-normal" suppressHydrationWarning>
                      {formatDate(org.createdAt)}
                    </span>
                  </TableCell>

                  {/* Actions: 3-Dot Dropdown Menu */}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <IconButton
                            variant="outline"
                            size="sm"
                            aria-label={`Actions for ${org.name}`}
                            icon={<MoreHorizontal className="w-4 h-4" />}
                            data-testid={`tenant-actions-${org.slug}`}
                          />
                        </DropdownMenuTrigger>

                        <DropdownMenuContent
                          align="right"
                          className="w-48 p-1 shadow-lg rounded-xl border border-neutral-200 bg-white dark:bg-neutral-900 dark:border-neutral-800"
                        >
                          {isSuspended ? (
                            <DropdownMenuItem
                              icon={<CheckCircle2 className="h-4 w-4 text-success" />}
                              onClick={() => handleOpenConfirm(org, targetReinstateStatus)}
                              className="text-xs text-success-foreground"
                              data-testid={`reinstate-btn-${org.slug}`}
                            >
                              Reinstate Company
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              variant="danger"
                              icon={<AlertTriangle className="h-4 w-4" />}
                              onClick={() => handleOpenConfirm(org, 'suspended')}
                              className="text-xs"
                              data-testid={`suspend-btn-${org.slug}`}
                            >
                              Suspend Company
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-neutral-200 px-2 py-3 dark:border-neutral-800">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            Showing{' '}
            <span className="font-medium text-neutral-900 dark:text-neutral-100">
              {(page - 1) * pageSize + 1}
            </span>{' '}
            to{' '}
            <span className="font-medium text-neutral-900 dark:text-neutral-100">
              {Math.min(page * pageSize, total)}
            </span>{' '}
            of{' '}
            <span className="font-medium text-neutral-900 dark:text-neutral-100">{total}</span>{' '}
            companies
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Confirmation Modal */}
      <AlertDialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false, org: null, targetStatus: 'suspended' })}
        onConfirm={handleConfirmStatusChange}
        loading={isUpdating}
        title={
          confirmDialog.targetStatus === 'suspended'
            ? `Suspend "${confirmDialog.org?.name}"?`
            : `Reinstate "${confirmDialog.org?.name}"?`
        }
        description={
          confirmDialog.targetStatus === 'suspended'
            ? 'Suspending this company immediately blocks new candidate workspace launches, assessment publishing, and AI proxy routing. Running candidate sessions will complete gracefully.'
            : 'Reinstating this company restores full access to the company portal, candidate workspace launches, and assigned assessment templates.'
        }
        confirmLabel={confirmDialog.targetStatus === 'suspended' ? 'Suspend Company' : 'Reinstate Company'}
        cancelLabel="Cancel"
        variant={confirmDialog.targetStatus === 'suspended' ? 'danger' : 'primary'}
        data-testid="confirm-status-modal"
      />
    </div>
  );
}
