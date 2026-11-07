'use client';

import React from 'react';
import {
  X,
  Terminal,
  Activity,
  User,
  Building2,
  Calendar,
  Clock,
  AlertOctagon,
  CreditCard,
  AlertTriangle,
  Radio,
  FileCode,
} from 'lucide-react';
import { Badge, Button, Spinner } from '@hs/ui';
import { useGetAdminWorkspaceByIdQuery } from '@/store/admin/adminApi';
import type { AdminWorkspaceListItemDto } from '@hs/contracts';

interface WorkspaceDetailDrawerProps {
  workspaceId: string | null;
  open: boolean;
  onClose: () => void;
  onDestroyClick: (ws: AdminWorkspaceListItemDto) => void;
}

export function WorkspaceDetailDrawer({
  workspaceId,
  open,
  onClose,
  onDestroyClick,
}: WorkspaceDetailDrawerProps) {
  const { data: workspace, isLoading } = useGetAdminWorkspaceByIdQuery(workspaceId || '', {
    skip: !open || !workspaceId,
  });

  if (!open || !workspaceId) return null;

  const formatDollars = (cents: number | null | undefined) => {
    if (cents == null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(cents / 100);
  };

  const isTerminal = workspace?.status === 'ended' || workspace?.status === 'destroyed';

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-slate-950/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-slate-100">Workspace Inspector</h2>
                {workspace?.isOnline && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Online
                  </span>
                )}
              </div>
              <p className="text-xs font-mono text-slate-400 mt-0.5">{workspaceId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading || !workspace ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
              <Spinner className="w-8 h-8 text-indigo-400" />
              <p className="text-sm">Loading workspace state...</p>
            </div>
          ) : (
            <>
              {/* Top Overview Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-xs text-slate-400 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    Candidate
                  </span>
                  <p className="font-semibold text-slate-100">{workspace.candidateName}</p>
                  <p className="text-xs text-slate-400 truncate">{workspace.candidateEmail}</p>
                </div>

                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    Tenant Organization
                  </span>
                  <p className="font-semibold text-slate-100">{workspace.orgName}</p>
                  <p className="text-xs text-slate-400 font-mono">slug: {workspace.orgSlug}</p>
                </div>
              </div>

              {/* Lifecycle & Status Details */}
              <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Lifecycle & Compute Runtime
                </h3>
                <div className="grid grid-cols-2 gap-y-2.5 text-xs">
                  <div>
                    <span className="text-slate-500">Lifecycle Status:</span>
                    <div className="mt-1">
                      <Badge
                        variant={
                          workspace.status === 'connected'
                            ? 'success'
                            : workspace.status === 'disconnected'
                              ? 'warning'
                              : workspace.status === 'destroyed'
                                ? 'danger'
                                : 'default'
                        }
                      >
                        {workspace.status}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Workspace Mode:</span>
                    <p className="mt-1 font-medium text-slate-200 capitalize">
                      {workspace.mode === 'cloud' ? 'Cloud VM Container' : 'AI Chat Interface'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Started At:</span>
                    <p className="text-slate-200 font-mono mt-0.5">
                      {new Date(workspace.startedAt).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Last Activity / Heartbeat:</span>
                    <p className="text-slate-200 font-mono mt-0.5">
                      {new Date(workspace.lastActivityAt).toLocaleString()} ({workspace.idleMinutes}m idle)
                    </p>
                  </div>
                  {workspace.deadlineAt && (
                    <div>
                      <span className="text-slate-500">Session Deadline:</span>
                      <p className="text-slate-200 font-mono mt-0.5">
                        {new Date(workspace.deadlineAt).toLocaleString()}
                      </p>
                    </div>
                  )}
                  {workspace.runtimeRef && (
                    <div>
                      <span className="text-slate-500">Runtime Container Ref:</span>
                      <p className="text-slate-200 font-mono text-[11px] truncate mt-0.5">
                        {workspace.runtimeRef}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Spend & Tenant Credit Allocation Context */}
              <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-indigo-400" />
                    Tenant Spend & Allocation Context
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300">
                    AD-024 / T05-2
                  </span>
                </div>

                {workspace.tenantCreditAllocation ? (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                      <span className="text-[11px] text-slate-400">Tenant Allocated</span>
                      <p className="text-sm font-semibold text-slate-100 mt-0.5">
                        {formatDollars(workspace.tenantCreditAllocation.allocatedAmountCents)}
                      </p>
                    </div>
                    <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                      <span className="text-[11px] text-slate-400">Active Balance</span>
                      <p className="text-sm font-semibold text-emerald-400 mt-0.5">
                        {formatDollars(workspace.tenantCreditAllocation.balanceCents)}
                      </p>
                    </div>
                    <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                      <span className="text-[11px] text-slate-400">Markup Applied</span>
                      <p className="text-sm font-semibold text-slate-100 mt-0.5">
                        {workspace.tenantCreditAllocation.markupPercentage}%
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    No active platform credit allocation assigned to this tenant.
                  </p>
                )}

                {/* Honest Metering Disclaimer */}
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 flex gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-amber-100">AI Proxy Runtime Status: </span>
                    <span>
                      Workspace-level token metering is currently unconnected in MMP. Individual
                      workspace cost burn is not recorded; actual platform charges flow through the tenant
                      allocation ledger once connected.
                    </span>
                  </div>
                </div>
              </div>

              {/* Activity Timeline */}
              <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-blue-400" />
                  Recent Activity Signals ({workspace.recentEvents?.length ?? 0})
                </h3>

                {(!workspace.recentEvents || workspace.recentEvents.length === 0) ? (
                  <p className="text-xs text-slate-500 italic py-2">No activity events recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {workspace.recentEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className="flex items-start justify-between p-2.5 rounded-lg bg-slate-900/70 border border-slate-800/80 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                                ev.type === 'connect'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : ev.type === 'disconnect'
                                    ? 'bg-rose-500/20 text-rose-400'
                                    : ev.type === 'resume'
                                      ? 'bg-blue-500/20 text-blue-400'
                                      : 'bg-slate-700 text-slate-300'
                              }`}
                            >
                              {ev.type}
                            </span>
                            {ev.ip && (
                              <span className="text-slate-400 font-mono text-[11px]">IP: {ev.ip}</span>
                            )}
                          </div>
                          {ev.payload && Object.keys(ev.payload).length > 0 && (
                            <pre className="text-[11px] font-mono text-slate-400 bg-slate-950/60 p-1.5 rounded max-w-md overflow-x-auto">
                              {JSON.stringify(ev.payload, null, 2)}
                            </pre>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500 shrink-0 font-mono">
                          {new Date(ev.at).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        {workspace && (
          <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {isTerminal
                ? `Session is in terminal state (${workspace.status})`
                : 'Session is active and cancellable by Super Admin'}
            </span>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
                Close
              </Button>
              {!isTerminal && (
                <Button
                  size="sm"
                  onClick={() => onDestroyClick(workspace)}
                  className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold gap-1.5 border-0 shadow-lg shadow-rose-900/30"
                >
                  <AlertOctagon className="w-4 h-4" />
                  <span>Emergency Kill</span>
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

