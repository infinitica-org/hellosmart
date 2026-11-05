'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Database,
  Search,
  ChevronDown,
  Check,
  Filter,
  FileText,
} from 'lucide-react';
import {
  PageHeader,
  StatCard,
  Card,
  SearchInput,
  Badge,
  Alert,
  EmptyState,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@hs/ui';

interface AuditLogEntry {
  id: string;
  action: string;
  category: 'security' | 'tenancy' | 'governance';
  actorRole: string;
  actorEmail: string;
  entity: string;
  ip: string;
  timestamp: string;
  relativeTime: string;
}

const mockAuditLogs: AuditLogEntry[] = [
  {
    id: 'aud_001',
    action: 'org.provisioned',
    category: 'tenancy',
    actorRole: 'platform_admin',
    actorEmail: 'admin@hellosmart.ai',
    entity: 'org_acme_innovations',
    ip: '127.0.0.1',
    timestamp: '2026-11-04T15:20:00Z',
    relativeTime: '8 mins ago',
  },
  {
    id: 'aud_002',
    action: 'auth.mfa_verified',
    category: 'security',
    actorRole: 'platform_admin',
    actorEmail: 'admin@hellosmart.ai',
    entity: 'session_auth',
    ip: '127.0.0.1',
    timestamp: '2026-11-04T15:15:30Z',
    relativeTime: '13 mins ago',
  },
  {
    id: 'aud_003',
    action: 'org.status_changed',
    category: 'tenancy',
    actorRole: 'platform_admin',
    actorEmail: 'admin@hellosmart.ai',
    entity: 'org_globex_corp (trial -> active)',
    ip: '198.51.100.14',
    timestamp: '2026-11-04T14:45:00Z',
    relativeTime: '43 mins ago',
  },
  {
    id: 'aud_004',
    action: 'entitlement.updated',
    category: 'governance',
    actorRole: 'platform_admin',
    actorEmail: 'admin@hellosmart.ai',
    entity: 'org_initech (candidates: 25 -> 50)',
    ip: '198.51.100.14',
    timestamp: '2026-11-04T13:30:15Z',
    relativeTime: '2 hours ago',
  },
  {
    id: 'aud_005',
    action: 'workspace.snapshot_destroyed',
    category: 'security',
    actorRole: 'system_scheduler',
    actorEmail: 'cron@platform.internal',
    entity: 'ws_expired_orphan_cleanup',
    ip: '10.0.0.4',
    timestamp: '2026-11-04T12:00:00Z',
    relativeTime: '3 hours ago',
  },
];

export default function AdminAuditPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'security' | 'tenancy' | 'governance'>('all');

  const filteredLogs = mockAuditLogs.filter((entry) => {
    const matchesCategory = categoryFilter === 'all' || entry.category === categoryFilter;
    const matchesSearch =
      entry.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.entity.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.actorEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.ip.includes(searchQuery);

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Platform Audit Trail"
        description="Immutable, append-only security and operational audit trail across all platform organizations (BR-31)."
        badge={{ text: 'Append-Only', variant: 'default' }}
        data-testid="admin-audit-header"
      />

      {/* Top Audit Telemetry Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="TOTAL AUDIT ENTRIES"
          value="1,248"
          description="Immutable recorded events (BR-31)"
          icon={<Database className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />}
          data-testid="stat-audit-total"
        />
        <StatCard
          label="SECURITY INCIDENTS"
          value="0 Detected"
          description="100% RBAC & tenant isolation verified"
          icon={<ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
          data-testid="stat-security-incidents"
        />
        <StatCard
          label="RETENTION POLICY"
          value="90 Days"
          description="Default org retention window enforced"
          icon={<Lock className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
          data-testid="stat-audit-retention"
        />
      </div>

      {/* Table Card */}
      <Card className="rounded-xl border border-neutral-200/80 bg-white p-4 sm:p-6 shadow-2xs space-y-4">
        {/* Table Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="w-full sm:w-80 md:w-96">
            <SearchInput
              size="sm"
              placeholder="Search audit trail by action, entity, actor, or IP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              shortcutKey={false}
              autoShortcut={false}
              data-testid="audit-search-input"
            />
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                className="h-10 px-3.5 text-xs sm:text-sm font-medium rounded-md border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 transition-all flex items-center gap-2 shadow-2xs select-none"
                aria-label="Filter audit category"
              >
                <Filter className="w-4 h-4 text-neutral-400" />
                <span className="capitalize">{categoryFilter === 'all' ? 'All Categories' : categoryFilter}</span>
                <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
              </DropdownMenuTrigger>

              <DropdownMenuContent align="right" className="w-44 p-1.5 shadow-xl rounded-xl border border-neutral-200 bg-white dark:bg-neutral-900">
                <DropdownMenuLabel className="px-2.5 py-1 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                  Category
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="my-1" />
                {(['all', 'security', 'tenancy', 'governance'] as const).map((cat) => (
                  <DropdownMenuItem
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className="text-xs py-2 px-2.5 rounded-lg cursor-pointer capitalize flex items-center justify-between"
                  >
                    <span>{cat === 'all' ? 'All Categories' : cat}</span>
                    {categoryFilter === cat && <Check className="w-4 h-4 text-neutral-900" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Audit Log Table */}
        {filteredLogs.length === 0 ? (
          <EmptyState
            title="No Matching Audit Events"
            description={`No audit record matches "${searchQuery}".`}
            action={{
              label: 'Reset Filters',
              onClick: () => {
                setSearchQuery('');
                setCategoryFilter('all');
              },
            }}
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-200/80">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/70 text-neutral-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Client IP</th>
                  <th className="py-3 px-4 text-right">Integrity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-neutral-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-neutral-600">
                      <div>{log.relativeTime}</div>
                      <div className="text-[10px] text-neutral-400">{log.timestamp}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-medium text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200/60">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-neutral-700 font-medium">
                      {log.entity}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-neutral-900 font-medium">{log.actorEmail}</div>
                      <div className="text-[10px] text-neutral-500 font-mono">{log.actorRole}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-neutral-500 text-[11px]">
                      {log.ip}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Badge variant="success" size="sm">
                        Recorded
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Invariant Alert */}
      <Alert variant="info" className="text-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full">
          <div className="space-y-1">
            <div className="font-semibold text-neutral-900">
              BR-31 Invariant: Append-Only Cryptographic Audit Log
            </div>
            <p className="text-neutral-600">
              Platform audit entries are strictly immutable. Administrative actions, tenant state changes, and authentication
              events are permanently recorded and cannot be deleted or altered by any actor.
            </p>
          </div>
          <div className="font-mono text-primary bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/25 shrink-0 font-medium">
            Immutable Audit Trail
          </div>
        </div>
      </Alert>
    </div>
  );
}
