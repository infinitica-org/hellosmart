'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Database,
  Filter,
  ChevronDown,
  Check,
  Download,
  X,
  SlidersHorizontal,
  AlertCircle,
} from 'lucide-react';
import {
  PageHeader,
  StatCard,
  Card,
  SearchInput,
  Input,
  Alert,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Button,
  HashChainStatusBanner,
  type HashChainStatus,
} from '@hs/ui';
import {
  useGetAdminAuditLogsQuery,
  useVerifyAdminAuditChainMutation,
} from '@/store/admin/adminApi';
import { type AuditEventDto, type AuditVerifyResponseDto } from '@hs/contracts';
import { AuditEventTable } from '@/components/admin/audit/audit-event-table';
import { AuditDetailDrawer } from '@/components/admin/audit/audit-detail-drawer';

export default function AdminAuditPage() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  // 8 Dedicated Filters + Search
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'platform_admin' | 'company_admin' | 'candidate'>('all');
  const [actorIdFilter, setActorIdFilter] = useState('');
  const [orgIdFilter, setOrgIdFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [entityIdFilter, setEntityIdFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<AuditEventDto | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [verificationResult, setVerificationResult] = useState<AuditVerifyResponseDto | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Count active filters (excluding search and page)
  const activeFilterCount = [
    roleFilter !== 'all',
    Boolean(actorIdFilter.trim()),
    Boolean(orgIdFilter.trim()),
    Boolean(entityFilter.trim()),
    Boolean(entityIdFilter.trim()),
    Boolean(actionFilter.trim()),
    Boolean(startDateFilter.trim()),
    Boolean(endDateFilter.trim()),
  ].filter(Boolean).length;

  // RTK Query Hook for Audit Events
  const { data, isLoading, isFetching, refetch } = useGetAdminAuditLogsQuery({
    page,
    page_size: pageSize,
    search: searchQuery.trim() || undefined,
    actor_role: roleFilter !== 'all' ? roleFilter : undefined,
    actor_id: actorIdFilter.trim() || undefined,
    org_id: orgIdFilter.trim() || undefined,
    entity: entityFilter.trim() || undefined,
    entity_id: entityIdFilter.trim() || undefined,
    action: actionFilter.trim() || undefined,
    start_date: startDateFilter.trim() || undefined,
    end_date: endDateFilter.trim() || undefined,
  });

  // RTK Query Mutation for Chain Verification
  const [verifyChain, { isLoading: isVerifying }] = useVerifyAdminAuditChainMutation();

  const handleVerify = async () => {
    try {
      const res = await verifyChain().unwrap();
      setVerificationResult(res);
      refetch();
    } catch {
      setVerificationResult({
        status: 'tampered',
        valid: false,
        verified_at: new Date().toISOString(),
        records_checked: 0,
        chain_start: null,
        chain_end: null,
        failure_reason: 'Verification request failed or timed out',
        tamper_type: 'hash_mismatch',
      });
    }
  };

  const handleResetAllFilters = () => {
    setSearchQuery('');
    setRoleFilter('all');
    setActorIdFilter('');
    setOrgIdFilter('');
    setEntityFilter('');
    setEntityIdFilter('');
    setActionFilter('');
    setStartDateFilter('');
    setEndDateFilter('');
    setPage(1);
  };

  const handleSelectEvent = (event: AuditEventDto) => {
    setSelectedEvent(event);
    setDrawerOpen(true);
  };

  const handleExport = () => {
    const items = data?.items || [];
    if (items.length === 0) return;
    setIsExporting(true);
    try {
      const headers = ['id', 'at', 'action', 'entity', 'entity_id', 'actor_role', 'actor_id', 'org_id', 'ip', 'hash'];
      const rows = items.map((l) => [
        l.id,
        l.at,
        l.action,
        `"${l.entity.replace(/"/g, '""')}"`,
        l.entity_id || '',
        l.actor_role,
        l.actor_id || '',
        l.org_id || '',
        l.ip || '',
        l.hash,
      ]);
      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `platform_audit_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback for non-DOM environments
    } finally {
      setIsExporting(false);
    }
  };

  const events = data?.items || [];
  const total = data?.total || 0;
  const totalPages = data?.total_pages || 1;

  // Determine hash banner status
  let bannerStatus: HashChainStatus = 'idle';
  if (isVerifying) {
    bannerStatus = 'verifying';
  } else if (verificationResult) {
    if (verificationResult.status === 'inconclusive') {
      bannerStatus = 'inconclusive';
    } else if (verificationResult.status === 'tampered' || !verificationResult.valid) {
      bannerStatus = 'tampered';
    } else if (verificationResult.status === 'empty' || verificationResult.records_checked === 0) {
      bannerStatus = 'empty';
    } else {
      bannerStatus = 'valid';
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Platform Audit Trail"
        description="Immutable, append-only security and operational audit trail across all platform organizations (BR-31)."
        badge={{ text: 'Append-Only Ledger', variant: 'default' }}
        data-testid="admin-audit-header"
      />

      {/* Cryptographic Hash Chain Verifier Banner */}
      <HashChainStatusBanner
        status={bannerStatus}
        recordsChecked={verificationResult?.records_checked}
        recordsVerifiedBeforeIssue={verificationResult?.records_verified_before_issue}
        verifiedAt={verificationResult?.verified_at}
        chainStart={verificationResult?.chain_start}
        chainEnd={verificationResult?.chain_end}
        failureReason={verificationResult?.failure_reason}
        inconclusiveReason={verificationResult?.inconclusive_reason}
        firstInvalidEventId={verificationResult?.first_invalid_event_id}
        firstInconclusiveEventId={verificationResult?.first_inconclusive_event_id}
        expectedHash={verificationResult?.expected_hash}
        storedHash={verificationResult?.stored_hash}
        expectedPreviousHash={verificationResult?.expected_previous_hash}
        storedPreviousHash={verificationResult?.stored_previous_hash}
        onVerify={handleVerify}
        isLoading={isVerifying}
      />

      {/* Top Audit Telemetry Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="TOTAL AUDIT BLOCKS"
          value={total > 0 ? total.toLocaleString() : '0'}
          description="Recorded append-only ledger entries (BR-31)"
          icon={<Database className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />}
          data-testid="stat-audit-total"
        />
        <StatCard
          label="LEDGER CONTINUITY"
          value={
            verificationResult
              ? verificationResult.status === 'inconclusive'
                ? 'Inconclusive'
                : verificationResult.valid
                  ? 'Continuity Verified'
                  : 'Tamper Detected'
              : 'Unverified'
          }
          description="Internal sequential SHA-256 hash continuity"
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
              placeholder="Search audit trail by action, entity, or actor..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              onClear={() => {
                setSearchQuery('');
                setPage(1);
              }}
              shortcutKey={false}
              autoShortcut={false}
              data-testid="audit-search-input"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Filter Toggle Button */}
            <Button
              variant={filtersOpen || activeFilterCount > 0 ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setFiltersOpen((prev) => !prev)}
              className="h-10 text-xs flex items-center gap-1.5"
              data-testid="audit-filter-toggle"
              aria-label="Toggle audit filters"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="ml-1 rounded-full bg-neutral-900 text-white px-1.5 py-0.2 text-[10px] font-bold">
                  {activeFilterCount}
                </span>
              )}
            </Button>

            {/* Actor Role Filter Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger
                className="h-10 px-3.5 text-xs sm:text-sm font-medium rounded-md border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 transition-all flex items-center gap-2 shadow-2xs select-none"
                aria-label="Filter actor role"
                data-testid="audit-role-filter"
              >
                <Filter className="w-4 h-4 text-neutral-400" />
                <span className="capitalize">{roleFilter === 'all' ? 'All Roles' : roleFilter}</span>
                <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
              </DropdownMenuTrigger>

              <DropdownMenuContent align="right" className="w-44 p-1.5 shadow-xl rounded-xl border border-neutral-200 bg-white dark:bg-neutral-900">
                <DropdownMenuLabel className="px-2.5 py-1 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                  Actor Role
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="my-1" />
                {(['all', 'platform_admin', 'company_admin', 'candidate'] as const).map((r) => (
                  <DropdownMenuItem
                    key={r}
                    onClick={() => {
                      setRoleFilter(r);
                      setPage(1);
                    }}
                    className="text-xs py-2 px-2.5 rounded-lg cursor-pointer capitalize flex items-center justify-between"
                  >
                    <span>{r === 'all' ? 'All Roles' : r}</span>
                    {roleFilter === r && <Check className="w-4 h-4 text-neutral-900" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Export CSV Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isExporting || events.length === 0}
              className="h-10 text-xs"
              data-testid="audit-export-button"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              <span>Export CSV</span>
            </Button>
          </div>
        </div>

        {/* Dedicated 8-Filter Panel (Collapsible / Expandable) */}
        {filtersOpen && (
          <div
            className="rounded-xl border border-neutral-200/90 bg-neutral-50/70 p-4 space-y-3 transition-all"
            data-testid="audit-filter-panel"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                Advanced Audit Filters (8 Dimensions)
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetAllFilters}
                className="text-xs text-neutral-500 hover:text-neutral-900 h-7 px-2"
                data-testid="audit-filter-reset"
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Clear All
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* 1. Org ID Filter */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-neutral-600">Organization UUID</label>
                <Input
                  size="sm"
                  placeholder="e.g. 22222222-2222-..."
                  value={orgIdFilter}
                  onChange={(e) => {
                    setOrgIdFilter(e.target.value);
                    setPage(1);
                  }}
                  data-testid="audit-filter-org-id"
                />
              </div>

              {/* 2. Actor ID Filter */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-neutral-600">Actor UUID</label>
                <Input
                  size="sm"
                  placeholder="e.g. 11111111-1111-..."
                  value={actorIdFilter}
                  onChange={(e) => {
                    setActorIdFilter(e.target.value);
                    setPage(1);
                  }}
                  data-testid="audit-filter-actor-id"
                />
              </div>

              {/* 3. Entity Filter */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-neutral-600">Entity Type</label>
                <Input
                  size="sm"
                  placeholder="e.g. user, organization"
                  value={entityFilter}
                  onChange={(e) => {
                    setEntityFilter(e.target.value);
                    setPage(1);
                  }}
                  data-testid="audit-filter-entity"
                />
              </div>

              {/* 4. Entity ID Filter */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-neutral-600">Entity ID</label>
                <Input
                  size="sm"
                  placeholder="e.g. u-123, org-456"
                  value={entityIdFilter}
                  onChange={(e) => {
                    setEntityIdFilter(e.target.value);
                    setPage(1);
                  }}
                  data-testid="audit-filter-entity-id"
                />
              </div>

              {/* 5. Action Filter */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-neutral-600">Action Name</label>
                <Input
                  size="sm"
                  placeholder="e.g. org.provisioned, user.created"
                  value={actionFilter}
                  onChange={(e) => {
                    setActionFilter(e.target.value);
                    setPage(1);
                  }}
                  data-testid="audit-filter-action"
                />
              </div>

              {/* 6. Start Date Filter */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-neutral-600">Start Date</label>
                <Input
                  size="sm"
                  type="date"
                  value={startDateFilter}
                  onChange={(e) => {
                    setStartDateFilter(e.target.value);
                    setPage(1);
                  }}
                  data-testid="audit-filter-start-date"
                />
              </div>

              {/* 7. End Date Filter */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-neutral-600">End Date</label>
                <Input
                  size="sm"
                  type="date"
                  value={endDateFilter}
                  onChange={(e) => {
                    setEndDateFilter(e.target.value);
                    setPage(1);
                  }}
                  data-testid="audit-filter-end-date"
                />
              </div>

              {/* 8. Actor Role Quick Indicator */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-neutral-600">Actor Role Filter</label>
                <div className="text-xs font-mono py-1.5 px-2 bg-white rounded border border-neutral-200 text-neutral-700 capitalize flex items-center justify-between">
                  <span>{roleFilter === 'all' ? 'All Roles' : roleFilter}</span>
                  {roleFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => {
                        setRoleFilter('all');
                        setPage(1);
                      }}
                      className="text-neutral-400 hover:text-neutral-700"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Audit Event Table */}
        <AuditEventTable
          events={events}
          isLoading={isLoading || isFetching}
          total={total}
          page={page}
          pageSize={pageSize}
          totalPages={totalPages}
          onPageChange={(p) => setPage(p)}
          onSelectEvent={handleSelectEvent}
          onResetFilters={handleResetAllFilters}
        />
      </Card>

      {/* Cryptographic Trust Boundary & Threat Model Notice */}
      <div
        className="rounded-xl border border-blue-200/90 bg-blue-50/80 p-4 sm:p-5 text-blue-950 space-y-3"
        data-testid="audit-trust-boundary-notice"
        role="region"
        aria-label="Cryptographic Trust Boundary Notice"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <h4 className="text-sm font-semibold text-blue-950">
              Cryptographic Trust Boundary & Threat Model Notice
            </h4>
            <div className="text-xs text-blue-900 leading-relaxed space-y-1.5">
              <p>
                <strong>Genesis-Relative Hash Continuity:</strong> Internal verification proves strict SHA-256 link
                continuity relative to the ledger genesis block. It establishes that each recorded block was computed from
                its immediate predecessor.
              </p>
              <p>
                <strong>Head & Tail Deletion Undetectability:</strong> Truncation of newest events (tail deletion) or deletion
                of older historical events (head truncation) cannot be detected purely through internal hash chain traversal
                without an external root anchor (such as an RFC 3161 timestamping authority or independent checkpoint).
              </p>
              <p>
                <strong>Internal Threat Boundary:</strong> A privileged database superuser (<code className="font-mono text-blue-900 bg-blue-100/70 px-1 py-0.5 rounded">postgres</code> or cloud administrator) with direct write access to underlying tables could
                theoretically rewrite the ledger and recompute all hashes internally. True non-repudiation against host
                compromise requires external immutable anchoring.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Detail Drawer */}
      <AuditDetailDrawer
        event={selectedEvent}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedEvent(null);
        }}
      />

      {/* Invariant Alert */}
      <Alert variant="info" className="text-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full">
          <div className="space-y-1">
            <div className="font-semibold text-neutral-900">
              BR-31 Invariant: Append-Only Cryptographic Audit Log
            </div>
            <p className="text-neutral-600">
              Platform audit entries are strictly immutable. Administrative actions, tenant state changes, and authentication
              events are permanently recorded in a SHA-256 hash chain and cannot be altered or purged by any role.
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
