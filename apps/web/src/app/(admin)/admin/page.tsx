'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search } from 'lucide-react';
import {
  PageHeader,
  StatCard,
  Button,
  Card,
  Input,
  Badge,
  Alert,
  EmptyState,
  ToastProvider,
} from '@hs/ui';
import { TenantTable } from '../../../components/admin/tenant-table';
import { ProvisionModal } from '../../../components/admin/provision-modal';
import { Organization, AdminMetrics, OrganizationStatus } from '@/types/organization';

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
      {/* Page Header with integrated action button */}
      <PageHeader
        title="Platform Administration"
        description="Global tenant provisioning, entitlement enforcement, and platform telemetry."
        badge={{ text: 'Super Admin', variant: 'info' }}
        data-testid="admin-page-header"
        actions={
          <Button
            variant="primary"
            onClick={() => setIsProvisionModalOpen(true)}
            data-testid="provision-company-btn"
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Provision New Company
          </Button>
        }
      />

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
      <Card className="p-6 sm:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-neutral-900 flex items-center gap-2">
              <span>Customer Companies</span>
              <Badge variant="default" size="sm" className="font-mono">
                {filteredOrganizations.length}
              </Badge>
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Tenants must be provisioned by a Platform Admin (BR-04, no public self-signup in MMP).
            </p>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-48 sm:w-64">
              <Input
                size="sm"
                placeholder="Search name, slug, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClear={searchQuery ? () => setSearchQuery('') : undefined}
                data-testid="tenant-search-input"
                leftIcon={<Search className="w-3.5 h-3.5" />}
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl border border-neutral-200 text-xs font-medium">
              {(['all', 'trial', 'active', 'suspended'] as const).map((status) => (
                <Button
                  key={status}
                  type="button"
                  variant={statusFilter === status ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setStatusFilter(status)}
                  className={`capitalize px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    statusFilter === status
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60'
                  }`}
                  data-testid={`filter-${status}`}
                >
                  {status}
                </Button>
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
      </Card>

      {/* Provision New Company Modal */}
      <ProvisionModal
        open={isProvisionModalOpen}
        onClose={() => setIsProvisionModalOpen(false)}
        onSuccess={fetchOrganizations}
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
              BR-01 Strict Tenant Isolation &bull; BR-04 Manual Org Provisioning Only &bull; BR-05 Server-Enforced Entitlements &bull; BR-31 Append-Only Audit Logging
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

export default function AdminDashboardPage() {
  return (
    <ToastProvider>
      <AdminDashboardContent />
    </ToastProvider>
  );
}
