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
import { Organization, OrganizationStatus } from '../../lib/types/organization';

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
      <div className="rounded-xl border border-slate-800 bg-[#0c1222] overflow-hidden shadow-xl shadow-black/40">
        <Table data-testid={testId}>
          <TableHeader>
            <TableRow className="border-b border-slate-800/80 bg-slate-900/60">
              <TableHead className="font-semibold text-slate-200">Company Name</TableHead>
              <TableHead className="font-semibold text-slate-200">Slug</TableHead>
              <TableHead className="font-semibold text-slate-200">Status</TableHead>
              <TableHead className="font-semibold text-slate-200 text-center">Candidates</TableHead>
              <TableHead className="font-semibold text-slate-200">Created Date</TableHead>
              <TableHead className="font-semibold text-slate-200 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {organizations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-slate-400 text-sm">
                  {isLoading ? 'Loading organizations...' : 'No customer companies found.'}
                </TableCell>
              </TableRow>
            ) : (
              organizations.map((org) => {
                const isSuspended = org.status === 'suspended';

                return (
                  <TableRow
                    key={org.id}
                    className="border-b border-slate-800/60 hover:bg-slate-850/40 transition-colors"
                    data-testid={`tenant-row-${org.slug}`}
                  >
                    {/* Name */}
                    <TableCell className="py-4">
                      <div className="font-medium text-slate-100 flex items-center gap-2">
                        <span>{org.name}</span>
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60">
                          {org.plan}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 font-mono">
                        {org.adminEmail}
                      </div>
                    </TableCell>

                    {/* Slug */}
                    <TableCell className="py-4">
                      <span className="font-mono text-xs text-indigo-300 bg-indigo-950/60 border border-indigo-800/40 px-2 py-1 rounded-md">
                        {org.slug}
                      </span>
                    </TableCell>

                    {/* Status Badge */}
                    <TableCell className="py-4">
                      {renderStatusBadge(org.status, org.slug)}
                    </TableCell>

                    {/* Candidates */}
                    <TableCell className="py-4 text-center font-mono text-slate-300">
                      <span className="font-semibold text-white">{org.candidatesCount}</span>
                      {org.maxCandidates && (
                        <span className="text-slate-500 text-xs"> / {org.maxCandidates}</span>
                      )}
                    </TableCell>

                    {/* Created Date */}
                    <TableCell className="py-4 text-slate-400 font-mono text-xs" suppressHydrationWarning>
                      {formatDate(org.createdAt)}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="py-4 text-right">
                      {isSuspended ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-emerald-400 hover:text-emerald-300 border-emerald-800/60 hover:bg-emerald-950/40"
                          onClick={() => handleOpenConfirm(org, 'active')}
                          data-testid={`reinstate-btn-${org.slug}`}
                        >
                          Reinstate
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/30"
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

