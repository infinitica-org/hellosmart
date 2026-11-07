'use client';

import React, { useState } from 'react';
import {
  Search,
  Filter,
  Terminal,
  Activity,
  AlertOctagon,
  Eye,
  RefreshCw,
  Building2,
  Calendar,
  Clock,
  Radio,
  ExternalLink,
} from 'lucide-react';
import { Badge, Button, Input, Spinner } from '@hs/ui';
import type { AdminWorkspaceListItemDto, AdminWorkspaceQueryDto } from '@hs/contracts';

interface WorkspaceTableProps {
  workspaces: AdminWorkspaceListItemDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  isLoading: boolean;
  query: AdminWorkspaceQueryDto;
  onQueryChange: (newQuery: Partial<AdminWorkspaceQueryDto>) => void;
  onInspect: (ws: AdminWorkspaceListItemDto) => void;
  onDestroy: (ws: AdminWorkspaceListItemDto) => void;
  onRefresh: () => void;
}

export function WorkspaceTable({
  workspaces,
  total,
  page,
  pageSize,
  totalPages,
  isLoading,
  query,
  onQueryChange,
  onInspect,
  onDestroy,
  onRefresh,
}: WorkspaceTableProps) {
  const [searchInput, setSearchInput] = useState(query.search || '');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onQueryChange({ search: searchInput, page: 1 });
  };

  const formatDollars = (cents: number | null | undefined) => {
    if (cents == null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(cents / 100);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg space-y-4">
      {/* Table Controls Header */}
      <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-slate-950/40">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search candidate, email, organization, or assessment..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <Button type="submit" variant="outline" size="sm" className="text-xs">
            Search
          </Button>
        </form>

        <div className="flex items-center gap-2.5">
          {/* Status filter */}
          <select
            value={query.status || 'all'}
            onChange={(e) => onQueryChange({ status: e.target.value as any, page: 1 })}
            className="text-xs bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="connected">Connected</option>
            <option value="disconnected">Disconnected</option>
            <option value="ended">Ended</option>
            <option value="destroyed">Destroyed</option>
          </select>

          {/* Mode filter */}
          <select
            value={query.mode || 'all'}
            onChange={(e) => onQueryChange({ mode: e.target.value as any, page: 1 })}
            className="text-xs bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Modes</option>
            <option value="cloud">Cloud VM</option>
            <option value="chat">AI Chat</option>
          </select>

          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="text-xs gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Table Element */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3">Candidate / Tenant</th>
              <th className="px-4 py-3">Assessment / Mode</th>
              <th className="px-4 py-3">Status & Signal</th>
              <th className="px-4 py-3">Last Active / Idle</th>
              <th className="px-4 py-3">Tenant Allocation</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Spinner className="w-6 h-6 text-indigo-400" />
                    <span>Loading workspace sessions...</span>
                  </div>
                </td>
              </tr>
            ) : workspaces.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <Terminal className="w-6 h-6 text-slate-600 mb-1" />
                    <p className="font-medium text-slate-300">No workspaces match your query</p>
                    <p className="text-xs text-slate-500">
                      Try adjusting your status or search keyword filters.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              workspaces.map((ws) => {
                const isTerminal = ws.status === 'ended' || ws.status === 'destroyed';

                return (
                  <tr
                    key={ws.id}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                    onClick={() => onInspect(ws)}
                  >
                    {/* Candidate & Tenant */}
                    <td className="px-4 py-3.5">
                      <div className="space-y-0.5">
                        <div className="font-medium text-slate-100 flex items-center gap-2">
                          <span>{ws.candidateName}</span>
                          {ws.isOnline && (
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[180px]">
                          {ws.candidateEmail}
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-slate-500" />
                          <span>{ws.orgName}</span>
                        </div>
                      </div>
                    </td>

                    {/* Assessment & Mode */}
                    <td className="px-4 py-3.5">
                      <div className="space-y-1">
                        <div className="font-medium text-slate-200 truncate max-w-[200px]">
                          {ws.assessmentName}
                        </div>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                          {ws.mode === 'cloud' ? 'Cloud VM' : 'AI Chat'}
                        </span>
                      </div>
                    </td>

                    {/* Status & Signal */}
                    <td className="px-4 py-3.5">
                      <div className="space-y-1">
                        <Badge
                          variant={
                            ws.status === 'connected'
                              ? 'success'
                              : ws.status === 'disconnected'
                                ? 'warning'
                                : ws.status === 'destroyed'
                                  ? 'danger'
                                  : 'default'
                          }
                        >
                          {ws.status}
                        </Badge>
                        {ws.isOnline ? (
                          <div className="text-[10px] text-emerald-400 font-mono">Live Link Active</div>
                        ) : (
                          <div className="text-[10px] text-slate-500 font-mono">
                            {ws.idleMinutes}m idle
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Last Active */}
                    <td className="px-4 py-3.5">
                      <div className="space-y-0.5 text-[11px] font-mono">
                        <div className="text-slate-300">
                          {new Date(ws.lastActivityAt).toLocaleTimeString()}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Started: {new Date(ws.startedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </td>

                    {/* Spend / Tenant Allocation Context */}
                    <td className="px-4 py-3.5">
                      <div className="space-y-0.5 text-xs">
                        <div className="font-medium text-slate-200">
                          Bal: {formatDollars(ws.spendInfo.balanceCents)}
                        </div>
                        <div className="text-[10px] text-amber-400/90 font-mono">
                          Unconnected (MMP)
                        </div>
                      </div>
                    </td>

                    {/* Action Buttons */}
                    <td className="px-4 py-3.5 text-right">
                      <div
                        className="flex items-center justify-end gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onInspect(ws)}
                          className="h-7 text-xs px-2 text-slate-300 hover:text-white"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Inspect
                        </Button>
                        {!isTerminal && (
                          <Button
                            size="sm"
                            onClick={() => onDestroy(ws)}
                            className="h-7 text-xs px-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20"
                          >
                            <AlertOctagon className="w-3.5 h-3.5 mr-1" />
                            Kill
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-slate-950/40">
        <div>
          Showing {workspaces.length} of {total} total workspaces (Page {page} of{' '}
          {Math.max(1, totalPages)})
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || isLoading}
            onClick={() => onQueryChange({ page: page - 1 })}
            className="text-xs"
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || isLoading}
            onClick={() => onQueryChange({ page: page + 1 })}
            className="text-xs"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

