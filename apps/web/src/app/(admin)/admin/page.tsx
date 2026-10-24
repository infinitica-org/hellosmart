'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  PageHeader,
  StatCard,
  Button,
  EmptyState,
  ToastProvider,
} from '@hs/ui';
import { TenantTable } from '../../../components/admin/tenant-table';
import { ProvisionModal } from '../../../components/admin/provision-modal';
import { Organization, AdminMetrics, OrganizationStatus } from '../../../lib/types/organization';

function AdminDashboardContent() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [metrics, setMetrics] = useState<AdminMetrics>({
    totalCompanies: 0,
    activeTrials: 0,
    totalCandidates: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isProvisionModalOpen, setIsProvisionModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OrganizationStatus>('all');

  const fetchOrganizations = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/organizations', {
        headers: { 'Cache-Control': 'no-cache' },
      });
      const data = await res.json();

      if (res.ok && data?.organizations) {
        setOrganizations(data.organizations);
        if (data.metrics) {
          setMetrics(data.metrics);
        } else {
          // Fallback calculation
          setMetrics({
            totalCompanies: data.organizations.length,
            activeTrials: data.organizations.filter((o: Organization) => o.status === 'trial').length,
            totalCandidates: data.organizations.reduce((sum: number, o: Organization) => sum + (o.candidatesCount || 0), 0),
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  // Filter organizations by search query and status
  const filteredOrganizations = organizations.filter((org) => {
    const matchesSearch =
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (org.adminEmail && org.adminEmail.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || org.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Platform Administration"
          description="Global tenant provisioning, entitlement enforcement, and platform telemetry."
          badge={{ text: 'Super Admin', variant: 'info' }}
          data-testid="admin-page-header"
          breadcrumbs={[
            { label: 'Admin', href: '/admin' },
            { label: 'Overview' },
          ]}
        />

        <div className="flex-shrink-0 self-start sm:self-center">
          <Button
            variant="primary"
            onClick={() => setIsProvisionModalOpen(true)}
            data-testid="provision-company-btn"
            leftIcon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            Provision New Company
          </Button>
        </div>
      </div>

      {/* Top Metrics Header (Total Companies, Active Trials, Total Candidates) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard
          label="Total Companies"
          value={metrics.totalCompanies.toString()}
          description="Provisioned customer organizations (BR-04)"
          data-testid="metric-total-companies"
        />
        <StatCard
          label="Active Trials"
          value={metrics.activeTrials.toString()}
          description="Organizations evaluating platform blueprints"
          data-testid="metric-active-trials"
        />
        <StatCard
          label="Total Candidates"
          value={metrics.totalCandidates.toString()}
          description="Simulations run across active workspaces"
          data-testid="metric-total-candidates"
        />
      </div>

      {/* Customer Companies Table Section */}
      <div className="glass-card rounded-2xl border border-slate-800/80 p-6 sm:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <span>Customer Companies</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60">
                {filteredOrganizations.length}
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Tenants must be provisioned by a Platform Admin (BR-04, no public self-signup in MMP).
            </p>
          </div>
          

          {/* Search & Filter Bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search name, slug, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48 sm:w-64"
                data-testid="tenant-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                >
                  &times;
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-medium">
              {(['all', 'trial', 'active', 'suspended'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`px-2.5 py-1 rounded-lg capitalize transition-colors ${
                    statusFilter === status
                      ? 'bg-indigo-600 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  data-testid={`filter-${status}`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table or Empty State */}
        {organizations.length === 0 && !isLoading ? (
          <EmptyState
            title="No organizations provisioned"
            description="Provision customer tenant organizations and allocate entitlements (X templates, Y candidates, Z days) to get started."
            data-testid="admin-empty-state"
            action={{
              label: 'Provision First Organization',
              onClick: () => setIsProvisionModalOpen(true),
            }}
          />
        ) : (
          <TenantTable
            organizations={filteredOrganizations}
            isLoading={isLoading}
            onRefresh={fetchOrganizations}
            data-testid="tenant-table"
          />
        )}
      </div>

      {/* Provision New Company Modal */}
      <ProvisionModal
        open={isProvisionModalOpen}
        onClose={() => setIsProvisionModalOpen(false)}
        onSuccess={fetchOrganizations}
        data-testid="provision-modal"
      />

      {/* Platform Security Banner */}
      <div className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-400">
        <div className="space-y-1">
          <div className="font-semibold text-slate-200">
            Enforced Platform Governance & Tenancy Rules
          </div>
          <p>
            BR-01 Strict Tenant Isolation &bull; BR-04 Manual Org Provisioning Only &bull; BR-05 Server-Enforced Entitlements &bull; BR-31 Append-Only Audit Logging
          </p>
        </div>
        <div className="font-mono text-indigo-400 bg-indigo-950/50 px-3 py-1.5 rounded-lg border border-indigo-800/60 shrink-0">
          Super Admin Console &bull; MMP
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <ToastProvider>
      <AdminDashboardContent />
    </ToastProvider>
  );
}
