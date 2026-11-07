'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, Users, ChevronDown, Check, Building2, Mail } from 'lucide-react';
import {
  PageHeader,
  StatCard,
  Card,
  SearchInput,
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Alert,
  EmptyState,
} from '@hs/ui';
import { TenantTable } from './tenant-table';
import { ProvisionModal } from './provision-modal';
import { Organization, AdminMetrics, OrganizationStatus } from '@/types/organization';
import { useGetOrganizationsQuery } from '@/store/admin/adminApi';

const statusOptions: Array<{ value: 'all' | OrganizationStatus; label: string }> = [
  { value: 'all', label: 'All Companies' },
  { value: 'trial', label: 'Trial' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
];

export interface AdminCompaniesViewProps {
  title?: string;
  description?: string;
  badgeText?: string;
}

export function AdminCompaniesView({
  title = 'Platform Administration',
  description = 'Customer Companies global tenant provisioning, entitlement enforcement, and platform telemetry.',
  badgeText = 'Super Admin',
}: AdminCompaniesViewProps) {
  const { data, isLoading, error, refetch } = useGetOrganizationsQuery();
  const [isProvisionModalOpen, setIsProvisionModalOpen] = useState(false);

  let searchParams: any = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    searchParams = useSearchParams();
  } catch {
    searchParams = null;
  }
  const qParam = searchParams?.get('q') || '';
  const [searchQuery, setSearchQuery] = useState(qParam);
  const [statusFilter, setStatusFilter] = useState<'all' | OrganizationStatus>('all');

  useEffect(() => {
    if (qParam !== searchQuery) {
      setSearchQuery(qParam);
    }
  }, [qParam]);

  const organizations = data?.organizations ?? [];
  const metrics: AdminMetrics = data?.metrics ?? {
    totalCompanies: organizations.length,
    activeTrials: organizations.filter((o: Organization) => o.status === 'trial').length,
    totalCandidates: organizations.reduce((sum: number, o: Organization) => sum + (o.candidatesCount || 0), 0),
  };

  // Filter organizations by search query and status
  const filteredOrganizations = organizations.filter((org) => {
    const matchesSearch =
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (org.adminEmail && org.adminEmail.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || org.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const currentLabel =
    statusOptions.find((opt) => opt.value === statusFilter)?.label || 'All Companies';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={title}
        description={description}
        badge={{ text: badgeText, variant: 'info' }}
        data-testid="admin-page-header"
      />

      {/* Top Metrics Stat Cards (Matches Candidate Hub layout & styling) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="TOTAL COMPANIES"
          value={metrics.totalCompanies.toString()}
          description="Customer Companies provisioned"
          icon={<Building2 className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />}
          data-testid="metric-total-companies"
        />
        <StatCard
          label="ACTIVE TRIALS"
          value={metrics.activeTrials.toString()}
          description="Organizations evaluating blueprints"
          icon={<Mail className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
          data-testid="metric-active-trials"
        />
        <StatCard
          label="ACTIVE CANDIDATES"
          value={metrics.totalCandidates.toString()}
          description="Simulations run across active workspaces"
          icon={<Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
          data-testid="metric-total-candidates"
        />
      </div>

      {/* Error State Banner */}
      {error && (
        <Alert variant="error" className="flex items-center justify-between text-xs" data-testid="admin-error-alert">
          <div className="flex items-center justify-between w-full">
            <span>
              Failed to load organizations from platform backend:{' '}
              {typeof error === 'object' && error !== null && 'data' in error
                ? String((error as any).data?.detail || (error as any).data?.title || 'Unknown backend error')
                : 'Connection failed'}
            </span>
            <button
              onClick={() => void refetch()}
              className="ml-4 font-semibold underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        </Alert>
      )}

      {/* Directory Card with Toolbar & Table (Matches Candidate Table Card) */}
      <Card className="rounded-xl border border-neutral-200/80 bg-white p-4 sm:p-6 shadow-2xs space-y-4">
        {/* Table Toolbar Header */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="w-full sm:w-80 md:w-96">
            <SearchInput
              size="sm"
              placeholder="Search companies by name, slug, admin email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              shortcutKey={false}
              autoShortcut={false}
              data-testid="admin-search-input"
            />
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-nowrap">
            {/* Status Dropdown Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger
                className={`h-10 px-3.5 text-xs sm:text-sm font-medium rounded-md border transition-all flex items-center gap-2 shadow-2xs select-none ${
                  statusFilter !== 'all'
                    ? 'border-neutral-900 bg-neutral-900 text-white'
                    : 'border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700'
                }`}
                aria-label="Filter by company status"
              >
                <Users
                  className={`w-4 h-4 shrink-0 ${statusFilter !== 'all' ? 'text-white' : 'text-neutral-400'}`}
                />
                <span>{currentLabel}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 shrink-0 ${statusFilter !== 'all' ? 'text-white/80' : 'text-neutral-400'}`}
                />
              </DropdownMenuTrigger>

              <DropdownMenuContent align="right" className="w-48 p-1.5 shadow-xl rounded-xl border border-neutral-200 bg-white dark:bg-neutral-900">
                <DropdownMenuLabel className="px-2.5 py-1 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                  Status Filter
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="my-1" />

                {statusOptions.map((opt) => {
                  const isSelected = statusFilter === opt.value;

                  return (
                    <DropdownMenuItem
                      key={opt.value}
                      onClick={() => setStatusFilter(opt.value)}
                      className={`text-xs py-2 px-2.5 rounded-lg cursor-pointer ${
                        isSelected ? 'font-semibold text-neutral-900 bg-neutral-100 dark:bg-neutral-800 dark:text-neutral-100' : 'text-neutral-700 dark:text-neutral-300'
                      }`}
                      data-testid={`filter-${opt.value}`}
                    >
                      <div className="flex items-center justify-between w-full gap-2">
                        <span>{opt.label}</span>
                        {isSelected && <Check className="w-4 h-4 text-neutral-900 dark:text-neutral-100 shrink-0" />}
                      </div>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Provision New Company Button */}
            <Button
              variant="primary"
              size="md"
              onClick={() => setIsProvisionModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
              data-testid="provision-company-btn"
            >
              Provision New Company
            </Button>
          </div>
        </div>

        {/* Organizations Table or Clean Empty State */}
        {organizations.length === 0 && !isLoading && !error ? (
          <EmptyState
            title="No Companies Provisioned Yet"
            description="Provision customer tenant organizations and allocate entitlements (X templates, Y candidates, Z days) to get started."
            data-testid="admin-empty-state"
            action={{
              label: 'Provision New Company',
              onClick: () => setIsProvisionModalOpen(true),
            }}
          />
        ) : (
          <TenantTable
            organizations={filteredOrganizations}
            isLoading={isLoading}
            onRefresh={() => void refetch()}
            data-testid="tenant-table"
            isFiltered={Boolean(searchQuery || statusFilter !== 'all')}
            onResetFilters={() => {
              setSearchQuery('');
              setStatusFilter('all');
            }}
            onOpenProvision={() => setIsProvisionModalOpen(true)}
          />
        )}
      </Card>

      {/* Provision New Company Modal */}
      <ProvisionModal
        open={isProvisionModalOpen}
        onClose={() => setIsProvisionModalOpen(false)}
        onSuccess={() => {
          setIsProvisionModalOpen(false);
          void refetch();
        }}
        data-testid="provision-modal"
      />

      {/* Platform Security Banner */}
      <Alert variant="info" className="text-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full">
          <div className="space-y-1">
            <div className="font-semibold text-neutral-900">
              Enforced Platform Governance &amp; Tenancy Rules
            </div>
            <p className="text-neutral-600">
              Strict Tenant Isolation &bull; Manual Org Provisioning Only &bull; Server-Enforced Entitlements &bull; Append-Only Audit Logging
            </p>
          </div>
          <div className="font-mono text-primary bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/25 shrink-0 font-medium">
            Super Admin Console &bull; MMP
          </div>
        </div>
      </Alert>
    </div>
  );
}
