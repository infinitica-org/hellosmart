'use client';

import React from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  IconButton,
  EmptyState,
  Spinner,
  Pagination,
  Mail,
  Edit,
  Trash2,
} from '@hs/ui';
import type { CandidateDto, CandidateFilters } from './types';
import { UI_LABELS } from '@/constants';

export interface CandidateTableProps {
  candidates: CandidateDto[];
  total: number;
  filters: CandidateFilters;
  onPageChange: (newPage: number) => void;
  isLoading: boolean;
  onEdit: (candidate: CandidateDto) => void;
  onDelete: (candidate: CandidateDto) => void;
  onResendInvite: (candidate: CandidateDto) => void;
  onResetFilters: () => void;
  onOpenInvite: () => void;
  isResendingId?: string | null;
}

export function CandidateTable({
  candidates,
  total,
  filters,
  onPageChange,
  isLoading,
  onEdit,
  onDelete,
  onResendInvite,
  onResetFilters,
  onOpenInvite,
  isResendingId,
}: CandidateTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / filters.limit));

  if (isLoading && candidates.length === 0) {
    return (
      <div className="flex min-h-[300px] items-center justify-center rounded-lg border border-neutral-200 bg-white p-12 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" className="text-primary-600" />
          <p className="text-sm text-neutral-500">Loading candidates...</p>
        </div>
      </div>
    );
  }

  if (candidates.length === 0) {
    const isFiltered = Boolean(filters.search || (filters.status && filters.status !== 'all'));

    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-8 dark:border-neutral-800 dark:bg-neutral-900">
        <EmptyState
          title={isFiltered ? 'No candidates match your criteria' : 'No candidates invited yet'}
          description={
            isFiltered
              ? 'Try modifying your search keywords or resetting status filters to view more candidates.'
              : 'Add candidate invitations individually or in bulk with single-use expiring links (BR-24).'
          }
          action={
            isFiltered
              ? {
                  label: 'Clear Filters',
                  onClick: onResetFilters,
                }
              : {
                  label: 'Invite First Candidate',
                  onClick: onOpenInvite,
                }
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30%]">{UI_LABELS.TABLE_COLUMNS.CANDIDATE}</TableHead>
              <TableHead className="w-[20%]">{UI_LABELS.TABLE_COLUMNS.STATUS}</TableHead>
              <TableHead className="w-[20%]">Cap Allocation</TableHead>
              <TableHead className="w-[15%]">{UI_LABELS.TABLE_COLUMNS.DATE_ADDED}</TableHead>
              <TableHead className="w-[15%] text-right">{UI_LABELS.TABLE_COLUMNS.ACTIONS}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {candidates.map((candidate) => {
              const isInvited = candidate.status === 'invited';
              const isActive = candidate.status === 'active';
              const isDeleted = candidate.status === 'deleted';
              const isResending = isResendingId === candidate.id;

              const badgeVariant = isActive ? 'success' : isInvited ? 'warning' : 'default';

              return (
                <TableRow key={candidate.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50">
                  {/* Candidate Name & Email */}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                        {candidate.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-neutral-900 dark:text-neutral-100">
                          {candidate.name}
                        </div>
                        <div className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                          {candidate.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  {/* Status Badge */}
                  <TableCell>
                    <Badge variant={badgeVariant} dot>
                      {candidate.status}
                    </Badge>
                  </TableCell>

                  {/* Cap Allocation Status (BR-06) */}
                  <TableCell>
                    {candidate.countedAgainstCapAt ? (
                      <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        Counted (Workspace launched)
                      </div>
                    ) : (
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">
                        Pending (2x Cap Pool)
                      </div>
                    )}
                  </TableCell>

                  {/* Created Date */}
                  <TableCell>
                    <span className="text-xs text-neutral-600 dark:text-neutral-400">
                      {new Date(candidate.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </TableCell>

                  {/* Row Actions */}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* Resend Invite (Eligible only if invited) */}
                      {isInvited && !isDeleted && (
                        <IconButton
                          variant="ghost"
                          size="sm"
                          title="Resend invitation email"
                          aria-label="Resend invitation"
                          icon={
                            isResending ? (
                              <Spinner size="sm" className="h-4 w-4" />
                            ) : (
                              <Mail className="h-4 w-4" />
                            )
                          }
                          onClick={() => onResendInvite(candidate)}
                          disabled={isResending}
                          className="text-neutral-600 hover:text-primary-600 dark:text-neutral-400"
                        />
                      )}

                      {/* Edit Candidate */}
                      {!isDeleted && (
                        <IconButton
                          variant="ghost"
                          size="sm"
                          title="Edit candidate"
                          aria-label="Edit candidate"
                          icon={<Edit className="h-4 w-4" />}
                          onClick={() => onEdit(candidate)}
                          className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-400"
                        />
                      )}

                      {/* Delete Candidate */}
                      {!isDeleted && (
                        <IconButton
                          variant="ghost"
                          size="sm"
                          title="Delete candidate"
                          aria-label="Delete candidate"
                          icon={<Trash2 className="h-4 w-4" />}
                          onClick={() => onDelete(candidate)}
                          className="text-neutral-400 hover:text-red-600 dark:hover:text-red-400"
                        />
                      )}
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
          <div className="text-xs text-neutral-500">
            Showing{' '}
            <span className="font-medium text-neutral-900 dark:text-neutral-100">
              {(filters.page - 1) * filters.limit + 1}
            </span>{' '}
            to{' '}
            <span className="font-medium text-neutral-900 dark:text-neutral-100">
              {Math.min(filters.page * filters.limit, total)}
            </span>{' '}
            of{' '}
            <span className="font-medium text-neutral-900 dark:text-neutral-100">{total}</span>{' '}
            candidates
          </div>

          <Pagination
            page={filters.page}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
}
