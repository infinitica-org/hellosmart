'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  PageHeader,
  Button,
  Card,
  Input,
  StatCard,
  Badge,
  EmptyState,
} from '@hs/ui';
import { TenantTable } from '@/components/admin/tenant-table';
import { ProvisionModal } from '@/components/admin/provision-modal';
import type { Organization, OrganizationStatus, CreateOrganizationInput } from '@/types/organization';

export function AdminCompaniesView({
  organizations,
  isLoading,
  onRefresh,
}: {
  organizations: Organization[];
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OrganizationStatus>('all');
  const [isProvisionOpen, setIsProvisionOpen] = useState(false);

  const filtered = organizations.filter((org) => {
    const matchesSearch =
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (org.adminEmail && org.adminEmail.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || org.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalCompanies = organizations.length;
  const activeCount = organizations.filter((o) => o.status === 'active').length;
  const trialCount = organizations.filter((o) => o.status === 'trial').length;
  const totalCandidates = organizations.reduce((sum, o) => sum + (o.candidatesCount || 0), 0);

  return (
    <div className="space-y-6" data-testid="admin-companies-page">
      <PageHeader
        title="Companies & Tenants"
        description="Provision, configure, and inspect customer organization workspaces, entitlements, and caps."
        badge={{ text: 'Multi-Tenant Scoped', variant: 'default' }}
        data-testid="admin-companies-header"
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
              data-testid="refresh-companies-btn"
            >
              {isLoading ? 'Refreshing…' : '↻ Refresh'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsProvisionOpen(true)}
              data-testid="provision-company-btn"
            >
              + Provision Company
            </Button>
          </div>
        }
      />

      {/* Tenancy Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          label="Total Tenants"
          value={String(totalCompanies)}
          description="Provisioned customer orgs"
          data-testid="stat-total-companies"
        />
        <StatCard
          label="Active Accounts"
          value={String(activeCount)}
          description="Paid active subscriptions"
          data-testid="stat-active-companies"
        />
        <StatCard
          label="Active Trials"
          value={String(trialCount)}
          description="14-day trial evaluation"
          data-testid="stat-trial-companies"
        />
        <StatCard
          label="Total Candidates"
          value={String(totalCandidates)}
          description="Across all tenants (BR-06)"
          data-testid="stat-total-candidates"
        />
      </div>

      {/* Filters and Search Bar */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
          <div className="w-full sm:w-72">
            <Input
              placeholder="Search by company name, slug, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs"
              data-testid="companies-search-input"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {(['all', 'active', 'trial', 'suspended'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                  statusFilter === filter
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
                data-testid={`filter-${filter}`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Primary Organizations Table */}
      {filtered.length === 0 && !isLoading ? (
        <Card className="p-8">
          <EmptyState
            title="No organizations found"
            description={
              searchQuery
                ? `No tenants match query "${searchQuery}".`
                : 'No customer organizations matching the selected filter.'
            }
          />
        </Card>
      ) : (
        <TenantTable
          organizations={filtered}
          isLoading={isLoading}
          onRefresh={onRefresh}
          data-testid="admin-companies-table"
        />
      )}

      {/* Provisioning Modal */}
      <ProvisionModal
        open={isProvisionOpen}
        onClose={() => setIsProvisionOpen(false)}
        onSuccess={() => {
          setIsProvisionOpen(false);
          onRefresh();
        }}
      />
    </div>
  );
}

export default function AdminCompaniesPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOrganizations = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/organizations', {
        headers: { 'Cache-Control': 'no-cache' },
      });
      const data = await res.json();
      if (res.ok && data?.organizations) {
        setOrganizations(data.organizations);
      }
    } catch (err) {
      console.error('Failed to fetch organizations:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOrganizations();
  }, [fetchOrganizations]);

  return (
    <AdminCompaniesView
      organizations={organizations}
      isLoading={isLoading}
      onRefresh={fetchOrganizations}
    />
  );
}
