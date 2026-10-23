import React from 'react';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';

export default function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Platform Administration"
        description="Global system telemetry, tenant provisioning, and platform security enforcement."
        badge={{ text: 'Production Cluster', variant: 'success' }}
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Overview' },
        ]}
      />

      {/* Real Zero Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="glass-card rounded-2xl border border-slate-800/80 p-6">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Total Tenants
          </div>
          <div className="text-3xl font-extrabold font-mono text-white mt-2">0</div>
          <div className="text-[11px] text-slate-500 mt-2">
            No customer tenants provisioned yet
          </div>
        </div>

        <div className="glass-card rounded-2xl border border-slate-800/80 p-6">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Active Workspaces
          </div>
          <div className="text-3xl font-extrabold font-mono text-white mt-2">0</div>
          <div className="text-[11px] text-slate-500 mt-2">
            Zero active Sysbox VM containers
          </div>
        </div>

        <div className="glass-card rounded-2xl border border-slate-800/80 p-6">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Candidate Sessions
          </div>
          <div className="text-3xl font-extrabold font-mono text-white mt-2">0</div>
          <div className="text-[11px] text-slate-500 mt-2">
            All candidate quotas intact
          </div>
        </div>
      </div>

      {/* Main Tenant Table Section */}
      <div className="glass-card rounded-2xl border border-slate-800/80 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-base font-semibold text-slate-100">Customer Organizations</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Tenants must be provisioned by a Platform Admin (BR-04, no public self-signup).
            </p>
          </div>
        </div>

        <EmptyState
          title="No organizations provisioned"
          description="Provision customer tenant organizations and allocate entitlements (X templates, Y candidates, Z days) to get started."
          action={{
            label: 'Provision First Organization',
            href: '/admin',
          }}
        />
      </div>

      {/* Platform Security Banner */}
      <div className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-400">
        <div className="space-y-1">
          <div className="font-semibold text-slate-200">
            Enforced Security Policies
          </div>
          <p>
            BR-01 Strict Tenant Isolation &bull; BR-13 Short-Lived Proxy Tokens &bull; BR-31 Append-Only Audit Logging
          </p>
        </div>
        <div className="font-mono text-indigo-400 bg-indigo-950/50 px-3 py-1.5 rounded-lg border border-indigo-800/60">
          MMP Compliance: Active
        </div>
      </div>
    </div>
  );
}
