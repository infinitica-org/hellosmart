'use client';

import React, { useState } from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Button,
  Badge,
  AlertDialog,
  useToast,
} from '@hs/ui';
import { Organization, OrganizationStatus } from '@/types/organization';

export interface TenantTableProps {
  organizations: Organization[];
  isLoading?: boolean;
  onRefresh?: () => void;
  'data-testid'?: string;
}

export function TenantTable({
  organizations,
  isLoading = false,
  onRefresh,
  'data-testid': testId = 'tenant-table',
}: TenantTableProps) {
  const { toast } = useToast();
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    org: Organization | null;
    targetStatus: OrganizationStatus;
  }>({
    open: false,
    org: null,
    targetStatus: 'suspended',
  });
  const [isUpdating, setIsUpdating] = useState(false);

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

    setIsUpdating(true);
    try {
      const res = await fetch('/api/admin/organizations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: org.id, status: targetStatus }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.detail || data?.message || 'Failed to update organization status');
      }

      toast({
        title: targetStatus === 'suspended' ? 'Company Suspended' : 'Company Reinstated',
        description: `"${org.name}" status updated to ${targetStatus} (BR-07).`,
        variant: targetStatus === 'suspended' ? 'warning' : 'success',
      });

      setConfirmDialog({ open: false, org: null, targetStatus: 'suspended' });
      onRefresh?.();
    } catch (err: any) {
      toast({
        title: 'Status Update Failed',
        description: err.message || 'An unexpected error occurred.',
        variant: 'error',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const renderStatusBadge = (status: OrganizationStatus, slug: string) => {
    if (status === 'trial') {
      return (
        <Badge
          variant="warning"
          dot
          className="font-medium capitalize text-[11px]"
          data-testid={`tenant-status-${slug}`}
        >
          Trial
        </Badge>
      );
    }
    if (status === 'active') {
      return (
        <Badge
          variant="success"
          dot
          className="font-medium capitalize text-[11px]"
          data-testid={`tenant-status-${slug}`}
        >
          Active
        </Badge>
      );
    }
    return (
      <Badge
        variant="danger"
        dot
        className="font-medium capitalize text-[11px]"
        data-testid={`tenant-status-${slug}`}
      >
        Suspended
      </Badge>
    );
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toISOString().split('T')[0];
    } catch {
      return isoString;
    }
  };

  return (
    <div className="w-full space-y-4">
      <div className="rounded-2xl border border-neutral-200 bg-white overflow-x-auto shadow-xs">
        <Table data-testid={testId}>
          <TableHeader>
            <TableRow className="border-b border-neutral-200 bg-neutral-50/70">
              <TableHead className="font-semibold text-neutral-800">Company Name</TableHead>
              <TableHead className="font-semibold text-neutral-800">Slug</TableHead>
              <TableHead className="font-semibold text-neutral-800">Status</TableHead>
              <TableHead className="font-semibold text-neutral-800 text-center">Candidates</TableHead>
              <TableHead className="font-semibold text-neutral-800">Created Date</TableHead>
              <TableHead className="font-semibold text-neutral-800 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {organizations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-neutral-500 text-sm">
                  {isLoading ? 'Loading organizations...' : 'No customer companies found.'}
                </TableCell>
              </TableRow>
            ) : (
              organizations.map((org) => {
                const isSuspended = org.status === 'suspended';

                return (
                  <TableRow
                    key={org.id}
                    className="border-b border-neutral-200 hover:bg-neutral-50/60 transition-colors"
                    data-testid={`tenant-row-${org.slug}`}
                  >
                    {/* Name */}
                    <TableCell className="py-4">
                      <div className="font-medium text-neutral-900 flex items-center gap-2">
                        <span>{org.name}</span>
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 border border-neutral-200">
                          {org.plan}
                        </span>
                      </div>
                      <div className="text-xs text-neutral-500 mt-0.5 font-mono">
                        {org.adminEmail}
                      </div>
                    </TableCell>

                    {/* Slug */}
                    <TableCell className="py-4">
                      <span className="font-mono text-xs text-neutral-700 bg-neutral-100 border border-neutral-200 px-2 py-1 rounded-md">
                        {org.slug}
                      </span>
                    </TableCell>

                    {/* Status Badge */}
                    <TableCell className="py-4">
                      {renderStatusBadge(org.status, org.slug)}
                    </TableCell>

                    {/* Candidates */}
                    <TableCell className="py-4 text-center font-mono text-neutral-700">
                      <span className="font-semibold text-neutral-900">{org.candidatesCount}</span>
                      {org.maxCandidates && (
                        <span className="text-neutral-500 text-xs"> / {org.maxCandidates}</span>
                      )}
                    </TableCell>

                    {/* Created Date */}
                    <TableCell className="py-4 text-neutral-500 font-mono text-xs" suppressHydrationWarning>
                      {formatDate(org.createdAt)}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="py-4 text-right">
                      {isSuspended ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-emerald-700 hover:text-emerald-800 border-emerald-300 hover:bg-emerald-50"
                          onClick={() => handleOpenConfirm(org, 'active')}
                          data-testid={`reinstate-btn-${org.slug}`}
                        >
                          Reinstate
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          onClick={() => handleOpenConfirm(org, 'suspended')}
                          data-testid={`suspend-btn-${org.slug}`}
                        >
                          Suspend
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

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
            ? 'Suspending this company immediately blocks new candidate workspace launches, assessment publishing, and AI proxy routing (BR-07). Running candidate sessions will complete gracefully.'
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

