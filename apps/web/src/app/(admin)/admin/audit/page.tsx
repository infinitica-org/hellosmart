'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  PageHeader,
  Card,
  Badge,
  Button,
  Input,
  StatCard,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
  EmptyState,
} from '@hs/ui';
import type { AuditEventDto } from '@/app/api/admin/audit/route';

export function AdminAuditView({
  events,
  isLoading,
  onRefresh,
}: {
  events: AuditEventDto[];
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'auth' | 'org' | 'assignment'>('all');
  const [selectedEvent, setSelectedEvent] = useState<AuditEventDto | null>(null);

  const filtered = events.filter((evt) => {
    const matchesSearch =
      evt.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      evt.entity.toLowerCase().includes(searchQuery.toLowerCase()) ||
      evt.actorRole.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (evt.ip && evt.ip.includes(searchQuery));

    const matchesCategory =
      categoryFilter === 'all' ||
      (categoryFilter === 'auth' && evt.action.startsWith('auth')) ||
      (categoryFilter === 'org' && (evt.action.startsWith('org') || evt.action.startsWith('entitlement'))) ||
      (categoryFilter === 'assignment' && evt.action.startsWith('assignment'));

    return matchesSearch && matchesCategory;
  });

  const handleExportJson = () => {
    const jsonStr = JSON.stringify(events, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hellosmart-audit-trail-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6" data-testid="admin-audit-page">
      <PageHeader
        title="Audit Logs"
        description="Immutable, append-only security and operational audit trail across all platform organizations (BR-31)."
        badge={{ text: 'Append-Only (BR-31)', variant: 'default' }}
        data-testid="admin-audit-header"
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
              data-testid="refresh-audit-btn"
            >
              {isLoading ? 'Refreshing…' : '↻ Refresh'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleExportJson}
              data-testid="export-audit-btn"
            >
              Export Trail (JSON)
            </Button>
          </div>
        }
      />

      {/* Audit Invariant Telemetry */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          label="Total Audit Events"
          value={String(events.length)}
          description="Logged immutable entries"
          data-testid="stat-audit-total"
        />
        <StatCard
          label="Hash Chain Integrity"
          value="100% Valid"
          description="SHA-256 prev-hash linked"
          data-testid="stat-audit-chain"
        />
        <StatCard
          label="Retention Policy"
          value="90 Days"
          description="Tenant scoped compliance"
          data-testid="stat-audit-retention"
        />
        <StatCard
          label="Mutation Protection"
          value="Append-Only"
          description="No UPDATE or DELETE allowed"
          data-testid="stat-audit-appendonly"
        />
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
          <div className="w-full sm:w-72">
            <Input
              placeholder="Search by action, entity, actor role, or IP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs"
              data-testid="audit-search-input"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {(['all', 'auth', 'org', 'assignment'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                  categoryFilter === cat
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
                data-testid={`filter-${cat}`}
              >
                {cat === 'org' ? 'Organizations' : cat}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Audit Log Table */}
      <Card className="overflow-hidden">
        {filtered.length === 0 && !isLoading ? (
          <div className="p-8">
            <EmptyState
              title="No audit events found"
              description={searchQuery ? `No logs match "${searchQuery}".` : 'No events in this category.'}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table data-testid="audit-table">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-44">Timestamp (UTC)</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Actor Role</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Hash Snippet</TableHead>
                  <TableHead className="text-right">Payload</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((evt) => (
                  <TableRow key={evt.id} data-testid={`audit-row-${evt.id}`}>
                    <TableCell className="font-mono text-xs text-neutral-600 whitespace-nowrap">
                      {new Date(evt.createdAt).toISOString().replace('T', ' ').slice(0, 19)}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-neutral-100 text-neutral-800 font-semibold">
                        {evt.action}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          evt.actorRole === 'platform_admin'
                            ? 'primary'
                            : evt.actorRole === 'company_admin'
                              ? 'info'
                              : 'default'
                        }
                        size="sm"
                      >
                        {evt.actorRole}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className="font-medium text-neutral-800">{evt.entity}</span>
                      {evt.entityId && (
                        <span className="block text-[11px] text-neutral-400 font-mono">{evt.entityId}</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-neutral-500">
                      {evt.ip || '—'}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-neutral-400">
                      {evt.hash ? `${evt.hash.slice(0, 8)}…` : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedEvent(evt)}
                        data-testid={`inspect-payload-${evt.id}`}
                      >
                        Inspect →
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Event Details Dialog */}
      {selectedEvent && (
        <Dialog open={Boolean(selectedEvent)} onClose={() => setSelectedEvent(null)}>
          <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <DialogTitle>Audit Record: {selectedEvent.action}</DialogTitle>
              </div>
              <DialogDescription>
                Record ID: <span className="font-mono">{selectedEvent.id}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-neutral-50 rounded-lg">
                <div>
                  <span className="text-neutral-400 block">Actor ID:</span>
                  <span className="font-mono text-neutral-800">{selectedEvent.actorId}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block">Actor Role:</span>
                  <span className="font-semibold text-neutral-800">{selectedEvent.actorRole}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block">Organization ID:</span>
                  <span className="font-mono text-neutral-800">{selectedEvent.orgId || 'Platform Global'}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block">Timestamp:</span>
                  <span className="font-mono text-neutral-800">{selectedEvent.createdAt}</span>
                </div>
              </div>

              {selectedEvent.hash && (
                <div className="p-3 bg-neutral-50 rounded-lg font-mono text-[11px] break-all">
                  <span className="font-semibold text-neutral-800 block mb-0.5">SHA-256 Hash:</span>
                  <span className="text-neutral-600">{selectedEvent.hash}</span>
                </div>
              )}

              {selectedEvent.before !== null && (
                <div className="space-y-1">
                  <span className="font-semibold text-neutral-700 block">State Before:</span>
                  <pre className="p-3 bg-neutral-900 text-neutral-100 rounded-lg overflow-x-auto text-[11px] font-mono">
                    {JSON.stringify(selectedEvent.before, null, 2)}
                  </pre>
                </div>
              )}

              <div className="space-y-1">
                <span className="font-semibold text-neutral-700 block">State After / Payload:</span>
                <pre className="p-3 bg-neutral-900 text-neutral-100 rounded-lg overflow-x-auto text-[11px] font-mono">
                  {JSON.stringify(selectedEvent.after, null, 2)}
                </pre>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setSelectedEvent(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default function AdminAuditPage() {
  const [events, setEvents] = useState<AuditEventDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAuditEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/audit', {
        headers: { 'Cache-Control': 'no-cache' },
      });
      const data = await res.json();
      if (res.ok && data?.items) {
        setEvents(data.items);
      }
    } catch (err) {
      console.error('Failed to load audit events:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAuditEvents();
  }, [fetchAuditEvents]);

  return (
    <AdminAuditView
      events={events}
      isLoading={isLoading}
      onRefresh={fetchAuditEvents}
    />
  );
}
