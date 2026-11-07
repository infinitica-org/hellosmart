'use client';

import React, { useState } from 'react';
import { Terminal, ShieldAlert } from 'lucide-react';
import { ToastProvider } from '@hs/ui';
import {
  useGetAdminWorkspacesQuery,
} from '@/store/admin/adminApi';
import type {
  AdminWorkspaceListItemDto,
  AdminWorkspaceQueryDto,
} from '@hs/contracts';
import { WorkspaceMetricsCards } from '@/components/admin/workspaces/workspace-metrics-cards';
import { WorkspaceTable } from '@/components/admin/workspaces/workspace-table';
import { WorkspaceDetailDrawer } from '@/components/admin/workspaces/workspace-detail-drawer';
import { EmergencyDestroyModal } from '@/components/admin/workspaces/emergency-destroy-modal';

export default function AdminWorkspacesPage() {
  const [query, setQuery] = useState<AdminWorkspaceQueryDto>({
    status: 'all',
    mode: 'all',
    page: 1,
    page_size: 25,
  });

  const { data, isLoading, refetch } = useGetAdminWorkspacesQuery(query);

  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [destroyTarget, setDestroyTarget] = useState<AdminWorkspaceListItemDto | null>(null);
  const [isDestroyModalOpen, setIsDestroyModalOpen] = useState(false);

  const handleQueryChange = (updated: Partial<AdminWorkspaceQueryDto>) => {
    setQuery((prev) => ({ ...prev, ...updated }));
  };

  const handleInspect = (ws: AdminWorkspaceListItemDto) => {
    setSelectedWorkspaceId(ws.id);
    setIsDrawerOpen(true);
  };

  const handleDestroyClick = (ws: AdminWorkspaceListItemDto) => {
    setDestroyTarget(ws);
    setIsDestroyModalOpen(true);
  };

  const handleDestroySuccess = () => {
    refetch();
    if (selectedWorkspaceId && destroyTarget?.id === selectedWorkspaceId) {
      setIsDrawerOpen(false);
      setSelectedWorkspaceId(null);
    }
  };

  return (
    <ToastProvider>
      <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex flex-col gap-2 pb-4 border-b border-slate-800">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-100 flex items-center gap-2.5">
              <Terminal className="w-6 h-6 text-indigo-400" />
              Live Workspaces Monitor & Kill-Switch
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Super Admin
            </span>
          </div>
          <p className="text-sm text-slate-400 max-w-3xl">
            Global oversight of candidate workspace compute sessions, activity heartbeats, tenant spend
            context, and emergency destroy controls (AD-018 / AD-019 / BR-22).
          </p>
        </div>

        {/* Aggregate KPI Summary Cards */}
        <WorkspaceMetricsCards metrics={data?.metrics} isLoading={isLoading} />

        {/* Main Workspaces Table */}
        <WorkspaceTable
          workspaces={data?.items || []}
          total={data?.total || 0}
          page={data?.page || 1}
          pageSize={data?.pageSize || 25}
          totalPages={data?.totalPages || 1}
          isLoading={isLoading}
          query={query}
          onQueryChange={handleQueryChange}
          onInspect={handleInspect}
          onDestroy={handleDestroyClick}
          onRefresh={refetch}
        />

        {/* Slide-over Workspace Inspector */}
        <WorkspaceDetailDrawer
          workspaceId={selectedWorkspaceId}
          open={isDrawerOpen}
          onClose={() => {
            setIsDrawerOpen(false);
            setSelectedWorkspaceId(null);
          }}
          onDestroyClick={handleDestroyClick}
        />

        {/* Emergency Kill-Switch Confirmation Modal */}
        <EmergencyDestroyModal
          workspace={destroyTarget}
          open={isDestroyModalOpen}
          onClose={() => {
            setIsDestroyModalOpen(false);
            setDestroyTarget(null);
          }}
          onSuccess={handleDestroySuccess}
        />
      </div>
    </ToastProvider>
  );
}

