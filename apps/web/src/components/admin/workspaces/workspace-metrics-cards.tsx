'use client';

import React from 'react';
import { Terminal, Activity, Wifi, WifiOff, AlertOctagon, Building2 } from 'lucide-react';
import { StatCard } from '@hs/ui';
import type { AdminWorkspacesMetrics } from '@hs/contracts';

interface WorkspaceMetricsCardsProps {
  metrics?: AdminWorkspacesMetrics | undefined;
  isLoading?: boolean;
}

export function WorkspaceMetricsCards({ metrics, isLoading }: WorkspaceMetricsCardsProps) {
  const totalWorkspaces = metrics?.totalWorkspaces ?? 0;
  const activeWorkspaces = metrics?.activeWorkspaces ?? 0;
  const connectedCount = metrics?.connectedCount ?? 0;
  const disconnectedCount = metrics?.disconnectedCount ?? 0;
  const destroyedCount = metrics?.destroyedCount ?? 0;
  const trackedTenantsCount = metrics?.trackedTenantsCount ?? 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
      <StatCard
        label="Total Workspaces"
        value={isLoading ? '...' : totalWorkspaces.toString()}
        description="Across all tenants"
        icon={<Terminal className="w-5 h-5 text-indigo-400" />}
      />
      <StatCard
        label="Active Sessions"
        value={isLoading ? '...' : activeWorkspaces.toString()}
        description="Provisioned or connected"
        icon={<Activity className="w-5 h-5 text-blue-400" />}
      />
      <StatCard
        label="Connected Now"
        value={isLoading ? '...' : connectedCount.toString()}
        description="Active candidate links"
        icon={<Wifi className="w-5 h-5 text-emerald-400" />}
      />
      <StatCard
        label="Disconnected"
        value={isLoading ? '...' : disconnectedCount.toString()}
        description="Resumable sessions"
        icon={<WifiOff className="w-5 h-5 text-amber-400" />}
      />
      <StatCard
        label="Destroyed / Killed"
        value={isLoading ? '...' : destroyedCount.toString()}
        description="Emergency kill-switch"
        icon={<AlertOctagon className="w-5 h-5 text-rose-400" />}
      />
      <StatCard
        label="Tracked Tenants"
        value={isLoading ? '...' : trackedTenantsCount.toString()}
        description="Active tenant orgs"
        icon={<Building2 className="w-5 h-5 text-purple-400" />}
      />
    </div>
  );
}

