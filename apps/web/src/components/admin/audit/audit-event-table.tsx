'use client';

import React from 'react';
import { type AuditEventDto } from '@hs/contracts';
import { Badge, Button, EmptyState, Pagination, Skeleton } from '@hs/ui';
import { ShieldCheck, Eye, Hash } from 'lucide-react';

export interface AuditEventTableProps {
  events: AuditEventDto[];
  isLoading: boolean;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onSelectEvent: (event: AuditEventDto) => void;
  onResetFilters?: () => void;
}

export function AuditEventTable({
  events,
  isLoading,
  total,
  page,
  pageSize,
  totalPages,
  onPageChange,
  onSelectEvent,
  onResetFilters,
}: AuditEventTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3 p-4" data-testid="audit-table-loading">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-14 w-full rounded-lg" />
        <Skeleton className="h-14 w-full rounded-lg" />
        <Skeleton className="h-14 w-full rounded-lg" />
        <Skeleton className="h-14 w-full rounded-lg" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <EmptyState
        title="No Audit Records Found"
        description="No events match the specified search or filter criteria."
        action={
          onResetFilters
            ? {
                label: 'Reset Filters',
                onClick: onResetFilters,
              }
            : undefined
        }
        data-testid="audit-empty-state"
      />
    );
  }

  return (
    <div className="space-y-4" data-testid="audit-event-table">
      <div className="overflow-x-auto rounded-lg border border-neutral-200/80 bg-white shadow-2xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50/80 text-neutral-600 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-3 px-4">Event ID / Time</th>
              <th className="py-3 px-4">Action</th>
              <th className="py-3 px-4">Entity</th>
              <th className="py-3 px-4">Actor</th>
              <th className="py-3 px-4">Organization</th>
              <th className="py-3 px-4">Client IP</th>
              <th className="py-3 px-4">Block Hash</th>
              <th className="py-3 px-4 text-right">Inspect</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {events.map((event) => (
              <tr
                key={event.id}
                className="hover:bg-neutral-50/70 transition-colors group cursor-pointer"
                onClick={() => onSelectEvent(event)}
              >
                <td className="py-3.5 px-4 font-mono text-neutral-600">
                  <div className="font-semibold text-neutral-900">#{event.id}</div>
                  <div className="text-[10px] text-neutral-400">
                    {new Date(event.at).toLocaleString()}
                  </div>
                </td>
                <td className="py-3.5 px-4">
                  <span className="font-mono font-medium text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200/60 inline-block">
                    {event.action}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-neutral-700">
                  <div className="font-medium text-neutral-900">{event.entity}</div>
                  {event.entity_id && (
                    <div className="font-mono text-[10px] text-neutral-400 truncate max-w-36">
                      {event.entity_id}
                    </div>
                  )}
                </td>
                <td className="py-3.5 px-4">
                  <div className="font-medium text-neutral-900">
                    <Badge variant="default" size="sm">
                      {event.actor_role}
                    </Badge>
                  </div>
                  {event.actor_id && (
                    <div className="text-[10px] text-neutral-400 font-mono truncate max-w-32 mt-0.5">
                      {event.actor_id}
                    </div>
                  )}
                </td>
                <td className="py-3.5 px-4 text-neutral-600 font-mono text-[11px]">
                  {event.org_id ? (
                    <span className="text-neutral-700 truncate max-w-28 block">
                      {event.org_id}
                    </span>
                  ) : (
                    <span className="text-neutral-400 italic">Platform</span>
                  )}
                </td>
                <td className="py-3.5 px-4 font-mono text-neutral-500 text-[11px]">
                  {event.ip || '—'}
                </td>
                <td className="py-3.5 px-4 font-mono text-[10px] text-neutral-500">
                  <span className="inline-flex items-center gap-1 rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-600 border border-neutral-200/60">
                    <Hash className="w-2.5 h-2.5" />
                    <span>{event.hash ? `${event.hash.slice(0, 8)}...` : '—'}</span>
                  </span>
                </td>
                <td className="py-3.5 px-4 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectEvent(event);
                    }}
                    className="h-8 px-2.5 text-neutral-600 hover:text-neutral-900"
                    aria-label={`Inspect event ${event.id}`}
                  >
                    <Eye className="w-3.5 h-3.5 mr-1" />
                    <span>Inspect</span>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-500 px-1">
        <div>
          Showing <span className="font-semibold text-neutral-900">{events.length}</span> of{' '}
          <span className="font-semibold text-neutral-900">{total}</span> total audit events
        </div>
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
          data-testid="audit-pagination"
        />
      </div>
    </div>
  );
}
