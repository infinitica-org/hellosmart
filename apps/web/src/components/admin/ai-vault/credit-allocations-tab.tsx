'use client';

import React, { useState } from 'react';
import {
  CreditCard,
  Plus,
  RefreshCw,
  Sliders,
  AlertTriangle,
  Building2,
  DollarSign,
  TrendingUp,
  Search,
  CheckCircle2,
} from 'lucide-react';
import {
  Card,
  TextureButton,
  Button,
  Badge,
  Input,
  Alert,
  EmptyState,
  Spinner,
  Progress,
} from '@hs/ui';
import type {
  CreditAllocationDto,
  AllocationStatus,
  AiProvider,
} from '@hs/contracts';
import {
  useGetCreditAllocationsQuery,
  useCreateCreditAllocationMutation,
  useAdjustCreditAllocationMutation,
  useRevokeCreditAllocationMutation,
  useGetPlatformAiKeysQuery,
  useGetOrganizationsQuery,
} from '@/store/admin/adminApi';

export function CreditAllocationsTab() {
  const {
    data: allocations = [],
    isLoading,
    error,
    refetch,
  } = useGetCreditAllocationsQuery();

  const { data: platformKeys = [] } = useGetPlatformAiKeysQuery();
  const { data: orgsData } = useGetOrganizationsQuery();
  const organizations = orgsData?.organizations || [];

  const [createAllocation, { isLoading: isCreating }] = useCreateCreditAllocationMutation();
  const [adjustAllocation, { isLoading: isAdjusting }] = useAdjustCreditAllocationMutation();
  const [revokeAllocation, { isLoading: isRevoking }] = useRevokeCreditAllocationMutation();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals
  const [isNewAllocationOpen, setIsNewAllocationOpen] = useState(false);
  const [selectedForAdjust, setSelectedForAdjust] = useState<CreditAllocationDto | null>(null);
  const [selectedForRevoke, setSelectedForRevoke] = useState<CreditAllocationDto | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Form: Create Allocation
  const [newOrgId, setNewOrgId] = useState('');
  const [newPlatformKeyId, setNewPlatformKeyId] = useState('');
  const [newAllocatedDollars, setNewAllocatedDollars] = useState('100.00');
  const [newMarkupPercentage, setNewMarkupPercentage] = useState('15.0');
  const [newTokenCap, setNewTokenCap] = useState('');
  const [newSpendCapDollars, setNewSpendCapDollars] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Form: Adjust Allocation
  const [adjustmentDollars, setAdjustmentDollars] = useState('50.00');
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'deduct'>('add');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjustMarkup, setAdjustMarkup] = useState('');

  // Form: Revoke Allocation
  const [revokeReason, setRevokeReason] = useState('');

  const activeKeys = platformKeys.filter((k) => k.status === 'active');

  const formatDollars = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(cents / 100);
  };

  const handleOpenCreate = () => {
    setNewOrgId(organizations[0]?.id || '');
    setNewPlatformKeyId(activeKeys[0]?.id || '');
    setNewAllocatedDollars('100.00');
    setNewMarkupPercentage('15.0');
    setNewTokenCap('');
    setNewSpendCapDollars('');
    setNewNotes('');
    setActionError(null);
    setIsNewAllocationOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);

    const allocatedAmountCents = Math.round(parseFloat(newAllocatedDollars || '0') * 100);
    if (isNaN(allocatedAmountCents) || allocatedAmountCents <= 0) {
      setActionError('Allocation amount must be greater than $0.00');
      return;
    }

    const markup = parseFloat(newMarkupPercentage || '0');
    if (isNaN(markup) || markup < 0 || markup > 500) {
      setActionError('Markup percentage must be between 0% and 500%');
      return;
    }

    if (!newOrgId) {
      setActionError('Please select a tenant organization');
      return;
    }

    if (!newPlatformKeyId) {
      setActionError('Please select a platform AI key');
      return;
    }

    try {
      await createAllocation({
        orgId: newOrgId,
        platformKeyId: newPlatformKeyId,
        allocatedAmountCents,
        markupPercentage: markup,
        tokenCap: newTokenCap ? parseInt(newTokenCap, 10) : undefined,
        spendCapCents: newSpendCapDollars ? Math.round(parseFloat(newSpendCapDollars) * 100) : undefined,
        notes: newNotes.trim() || undefined,
      }).unwrap();

      setIsNewAllocationOpen(false);
    } catch (err: any) {
      setActionError(err?.data?.detail || err?.message || 'Failed to create credit allocation');
    }
  };

  const handleOpenAdjust = (alloc: CreditAllocationDto) => {
    setSelectedForAdjust(alloc);
    setAdjustmentDollars('50.00');
    setAdjustmentType('add');
    setAdjustmentReason('');
    setAdjustMarkup(alloc.markupPercentage.toString());
    setActionError(null);
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedForAdjust) return;
    setActionError(null);

    const dollars = parseFloat(adjustmentDollars || '0');
    if (isNaN(dollars) || dollars <= 0) {
      setActionError('Adjustment amount must be greater than $0.00');
      return;
    }

    const deltaCents = Math.round(dollars * 100) * (adjustmentType === 'add' ? 1 : -1);
    const newTotal = selectedForAdjust.allocatedAmountCents + deltaCents;
    const newBalance = newTotal - selectedForAdjust.usedAmountCents;

    if (newBalance < 0) {
      setActionError(
        `Adjustment would result in negative balance (${formatDollars(newBalance)}). Minimum allowed adjustment is ${formatDollars(
          selectedForAdjust.usedAmountCents - selectedForAdjust.allocatedAmountCents,
        )}`,
      );
      return;
    }

    if (!adjustmentReason.trim() || adjustmentReason.trim().length < 3) {
      setActionError('A valid adjustment reason (minimum 3 characters) is required for audit logs');
      return;
    }

    try {
      await adjustAllocation({
        id: selectedForAdjust.id,
        data: {
          adjustmentAmountCents: deltaCents,
          reason: adjustmentReason.trim(),
          markupPercentage: adjustMarkup ? parseFloat(adjustMarkup) : undefined,
        },
      }).unwrap();

      setSelectedForAdjust(null);
    } catch (err: any) {
      setActionError(err?.data?.detail || err?.message || 'Failed to adjust credit allocation');
    }
  };

  const handleOpenRevoke = (alloc: CreditAllocationDto) => {
    setSelectedForRevoke(alloc);
    setRevokeReason('');
    setActionError(null);
  };

  const handleRevokeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedForRevoke) return;
    setActionError(null);

    if (!revokeReason.trim() || revokeReason.trim().length < 3) {
      setActionError('A revocation reason (minimum 3 characters) is required for audit logs');
      return;
    }

    try {
      await revokeAllocation({
        id: selectedForRevoke.id,
        reason: revokeReason.trim(),
      }).unwrap();

      setSelectedForRevoke(null);
    } catch (err: any) {
      setActionError(err?.data?.detail || err?.message || 'Failed to revoke credit allocation');
    }
  };

  const filteredAllocations = allocations.filter((a) => {
    const matchesSearch =
      a.orgName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.platformKeyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.maskedKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.orgId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: AllocationStatus) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'exhausted':
        return <Badge variant="warning">Exhausted</Badge>;
      case 'revoked':
        return <Badge variant="danger">Revoked</Badge>;
      case 'expired':
        return <Badge variant="default">Expired</Badge>;
    }
  };

  const getProviderBadge = (provider: AiProvider) => {
    switch (provider) {
      case 'openai':
        return <Badge variant="default" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10">OpenAI</Badge>;
      case 'anthropic':
        return <Badge variant="default" className="border-amber-500/30 text-amber-400 bg-amber-500/10">Anthropic</Badge>;
      case 'gemini':
        return <Badge variant="default" className="border-blue-500/30 text-blue-400 bg-blue-500/10">Gemini</Badge>;
      case 'deepseek':
        return <Badge variant="default" className="border-indigo-500/30 text-indigo-400 bg-indigo-500/10">DeepSeek</Badge>;
      default:
        return <Badge variant="default">{provider}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-1 flex-wrap gap-3 items-center w-full sm:w-auto">
          <div className="relative min-w-[240px] flex-1 sm:flex-none">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Search allocations by org name, key, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 bg-slate-900/60 border-slate-800 text-sm w-full"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 bg-slate-900/60 border border-slate-800 rounded-md text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="exhausted">Exhausted</option>
            <option value="revoked">Revoked</option>
          </select>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
            className="border-slate-800 text-slate-300 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <TextureButton
            variant="primary"
            size="sm"
            onClick={handleOpenCreate}
            disabled={activeKeys.length === 0}
            className="flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Allocate Tenant Credits
          </TextureButton>
        </div>
      </div>

      {activeKeys.length === 0 && (
        <Alert variant="warning" className="py-2.5">
          <div className="flex items-center gap-2 text-sm text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              No active platform keys available in the vault. You must register an active platform key before allocating credits to tenant organizations.
            </span>
          </div>
        </Alert>
      )}

      {actionError && (
        <Alert variant="error" className="py-2.5">
          <div className="flex items-center justify-between text-sm">
            <span>{actionError}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActionError(null)}
              className="h-6 px-2 text-xs"
            >
              Dismiss
            </Button>
          </div>
        </Alert>
      )}

      {/* Allocations Table */}
      <div className="text-xs text-slate-400 bg-slate-900/40 border border-slate-800/80 rounded-lg p-3">
        <span className="font-medium text-slate-300">Credit Accounting Architecture:</span> Credit allocations establish spending caps and available credit balances for tenant organizations. Runtime usage metering and deductions are tracked as candidate workspace sessions route through the AI proxy.
      </div>

      <Card className="bg-slate-900/60 border-slate-800 overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 space-y-3">
            <Spinner className="w-8 h-8 text-indigo-500" />
            <p className="text-sm text-slate-400">Loading tenant credit allocations...</p>
          </div>
        ) : filteredAllocations.length === 0 ? (
          <EmptyState
            icon={<CreditCard className="w-8 h-8 text-slate-500" />}
            title="No Credit Allocations Found"
            description={
              searchQuery || statusFilter !== 'all'
                ? 'No allocations match the specified filters.'
                : 'No credit allocations have been granted to tenant organizations yet.'
            }
            action={
              !searchQuery && statusFilter === 'all' && activeKeys.length > 0
                ? {
                    label: 'Grant First Allocation',
                    onClick: handleOpenCreate,
                  }
                : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Organization</th>
                  <th className="py-3 px-4">Platform Key</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Allocated / Recorded Usage</th>
                  <th className="py-3 px-4">Remaining Balance</th>
                  <th className="py-3 px-4">Markup</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredAllocations.map((alloc) => {
                  const percentUsed =
                    alloc.allocatedAmountCents > 0
                      ? Math.min(100, Math.round((alloc.usedAmountCents / alloc.allocatedAmountCents) * 100))
                      : 0;

                  return (
                    <tr key={alloc.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-200 flex items-center gap-1.5">
                          <Building2 className="w-4 h-4 text-slate-400" />
                          {alloc.orgName}
                        </div>
                        <div className="text-xs font-mono text-slate-400 truncate max-w-[160px]">
                          {alloc.orgId}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getProviderBadge(alloc.provider)}
                          <span className="font-medium text-slate-200">{alloc.platformKeyName}</span>
                        </div>
                        <div className="text-xs font-mono text-slate-400 mt-0.5">
                          {alloc.maskedKey}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getStatusBadge(alloc.status)}
                      </td>
                      <td className="py-3.5 px-4 min-w-[180px]">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-300 font-medium">
                            {formatDollars(alloc.usedAmountCents)}
                          </span>
                          <span className="text-slate-400">
                            of {formatDollars(alloc.allocatedAmountCents)}
                          </span>
                        </div>
                        <Progress
                          value={percentUsed}
                          className="h-1.5 bg-slate-800"
                        />
                        {alloc.usedAmountCents === 0 && (
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Metering not connected
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-emerald-400">
                          {formatDollars(alloc.balanceCents)}
                        </div>
                        {alloc.spendCapCents && (
                          <div className="text-xs text-slate-400">
                            Cap: {formatDollars(alloc.spendCapCents)}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-300">
                        <span className="inline-flex items-center gap-1 font-mono text-xs">
                          <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                          +{alloc.markupPercentage}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenAdjust(alloc)}
                            disabled={alloc.status === 'revoked'}
                            className="h-8 px-2.5 text-xs text-slate-300 hover:text-white"
                          >
                            <Sliders className="w-3.5 h-3.5 mr-1" />
                            Adjust
                          </Button>
                          {alloc.status !== 'revoked' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenRevoke(alloc)}
                              className="h-8 px-2.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                            >
                              Revoke
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal: New Credit Allocation */}
      {isNewAllocationOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-400" />
                Allocate Managed AI Credits
              </h3>
              <button
                onClick={() => setIsNewAllocationOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Tenant Organization <span className="text-rose-400">*</span>
                </label>
                {organizations.length > 0 ? (
                  <select
                    value={newOrgId}
                    onChange={(e) => setNewOrgId(e.target.value)}
                    className="w-full h-9 px-3 bg-slate-950 border border-slate-800 rounded-md text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                  >
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name} ({org.slug})
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    type="text"
                    placeholder="Enter Organization UUID"
                    value={newOrgId}
                    onChange={(e) => setNewOrgId(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-sm"
                    required
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Platform AI Key <span className="text-rose-400">*</span>
                </label>
                <select
                  value={newPlatformKeyId}
                  onChange={(e) => setNewPlatformKeyId(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-950 border border-slate-800 rounded-md text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                >
                  {activeKeys.map((key) => (
                    <option key={key.id} value={key.id}>
                      {key.name} ({key.provider} — {key.maskedKey})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Allocated Amount ($) <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="1"
                      placeholder="100.00"
                      value={newAllocatedDollars}
                      onChange={(e) => setNewAllocatedDollars(e.target.value)}
                      className="bg-slate-950 border-slate-800 pl-7 text-sm font-mono"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Markup Percentage (%) <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="500"
                      placeholder="15.0"
                      value={newMarkupPercentage}
                      onChange={(e) => setNewMarkupPercentage(e.target.value)}
                      className="bg-slate-950 border-slate-800 pr-7 text-sm font-mono"
                      required
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">%</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Token Cap (Optional)
                  </label>
                  <Input
                    type="number"
                    min="1000"
                    placeholder="e.g. 5000000"
                    value={newTokenCap}
                    onChange={(e) => setNewTokenCap(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Spend Cap ($) (Optional)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="1"
                      placeholder="e.g. 500.00"
                      value={newSpendCapDollars}
                      onChange={(e) => setNewSpendCapDollars(e.target.value)}
                      className="bg-slate-950 border-slate-800 pl-7 text-sm font-mono"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Notes / Contract Reference
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Granted under Custom Enterprise Agreement Q4"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-sm"
                />
              </div>

              {actionError && (
                <div className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded border border-rose-500/20">
                  {actionError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsNewAllocationOpen(false)}
                  disabled={isCreating}
                >
                  Cancel
                </Button>
                <TextureButton
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isCreating}
                  className="flex items-center gap-1.5"
                >
                  {isCreating ? <Spinner className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                  Confirm Allocation
                </TextureButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Adjust Allocation Balance */}
      {selectedForAdjust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-400" />
                Adjust Credit Allocation Balance
              </h3>
              <button
                onClick={() => setSelectedForAdjust(null)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Organization:</span>
                <span className="text-slate-200 font-medium">{selectedForAdjust.orgName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Current Total Allocated:</span>
                <span className="text-slate-200 font-mono">{formatDollars(selectedForAdjust.allocatedAmountCents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Credits Consumed:</span>
                <span className="text-slate-200 font-mono">{formatDollars(selectedForAdjust.usedAmountCents)}</span>
              </div>
              <div className="flex justify-between font-semibold pt-1 border-t border-slate-800">
                <span className="text-slate-300">Remaining Balance:</span>
                <span className="text-emerald-400 font-mono">{formatDollars(selectedForAdjust.balanceCents)}</span>
              </div>
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Action
                  </label>
                  <select
                    value={adjustmentType}
                    onChange={(e) => setAdjustmentType(e.target.value as 'add' | 'deduct')}
                    className="w-full h-9 px-3 bg-slate-950 border border-slate-800 rounded-md text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="add">Add Credits (+)</option>
                    <option value="deduct">Deduct Credits (-)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Amount ($) <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="50.00"
                      value={adjustmentDollars}
                      onChange={(e) => setAdjustmentDollars(e.target.value)}
                      className="bg-slate-950 border-slate-800 pl-7 text-sm font-mono"
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Reason for Adjustment <span className="text-rose-400">*</span>
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Additional quota requested for Q4 campus hiring drive"
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-sm"
                  required
                />
                <p className="text-xs text-slate-400 mt-1">
                  Logged in immutable tamper-evident audit ledger with actor credentials.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Update Markup Percentage (%) (Optional)
                </label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="500"
                  value={adjustMarkup}
                  onChange={(e) => setAdjustMarkup(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-sm font-mono"
                />
              </div>

              {actionError && (
                <div className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded border border-rose-500/20">
                  {actionError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedForAdjust(null)}
                  disabled={isAdjusting}
                >
                  Cancel
                </Button>
                <TextureButton
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isAdjusting}
                  className="flex items-center gap-1.5"
                >
                  {isAdjusting ? <Spinner className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                  Apply Adjustment
                </TextureButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Revoke Allocation */}
      {selectedForRevoke && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-semibold text-slate-100">Revoke Credit Allocation</h3>
            </div>
            <p className="text-sm text-slate-300">
              Are you sure you want to revoke credit allocation for{' '}
              <strong className="text-white">{selectedForRevoke.orgName}</strong>?
            </p>
            <p className="text-xs text-slate-400">
              Current remaining balance of <strong className="text-slate-200">{formatDollars(selectedForRevoke.balanceCents)}</strong> will
              immediately become unavailable. Workspaces under this allocation will cease AI calls.
            </p>

            <form onSubmit={handleRevokeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Revocation Reason <span className="text-rose-400">*</span>
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Account suspended or subscription non-renewal"
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-sm"
                  required
                />
              </div>

              {actionError && (
                <div className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded border border-rose-500/20">
                  {actionError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedForRevoke(null)}
                  disabled={isRevoking}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="danger"
                  size="sm"
                  disabled={isRevoking}
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                >
                  {isRevoking ? <Spinner className="w-4 h-4 mr-1.5" /> : null}
                  Confirm Revocation
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
