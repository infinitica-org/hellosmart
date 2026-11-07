'use client';

import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Badge,
  Button,
  Input,
  Switch,
  AlertDialog,
  Spinner,
  useToast,
} from '@hs/ui';
import {
  Building2,
  Mail,
  Calendar,
  Layers,
  Users,
  Cpu,
  Globe,
  ShieldAlert,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Save,
  Server,
} from 'lucide-react';
import {
  useGetOrganizationByIdQuery,
  useUpdateOrganizationStatusMutation,
  useUpdateOrganizationEntitlementsMutation,
} from '@/store/admin/adminApi';
import type { UpdateOrgEntitlementsDto } from '@hs/contracts';
import type { OrganizationStatus } from '@/types/organization';

export interface TenantDetailDrawerProps {
  orgId: string | null;
  open: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

export function TenantDetailDrawer({
  orgId,
  open,
  onClose,
  onRefresh,
}: TenantDetailDrawerProps) {
  const { toast } = useToast();

  const {
    data: orgDetail,
    isLoading,
    isFetching,
    refetch,
  } = useGetOrganizationByIdQuery(orgId!, {
    skip: !orgId || !open,
  });

  const [updateStatus, { isLoading: isUpdatingStatus }] =
    useUpdateOrganizationStatusMutation();
  const [updateEntitlements, { isLoading: isSavingEntitlements }] =
    useUpdateOrganizationEntitlementsMutation();

  // Local state for Entitlements modifier form
  const [maxTemplates, setMaxTemplates] = useState<number>(5);
  const [maxCandidates, setMaxCandidates] = useState<number>(25);
  const [pendingInviteMultiplier, setPendingInviteMultiplier] =
    useState<number>(2.0);
  const [trialEndsAt, setTrialEndsAt] = useState<string>('');
  const [flags, setFlags] = useState<{
    cloud: boolean;
    chat: boolean;
    local: boolean;
    browser: boolean;
    white_label: boolean;
    custom_domain: boolean;
    managed_ai_credits: boolean;
    extra_agents: boolean;
  }>({
    cloud: true,
    chat: true,
    local: false,
    browser: false,
    white_label: false,
    custom_domain: false,
    managed_ai_credits: false,
    extra_agents: false,
  });

  // Governance Status Dialog state
  const [statusDialog, setStatusDialog] = useState<{
    open: boolean;
    targetStatus: OrganizationStatus;
  }>({
    open: false,
    targetStatus: 'suspended',
  });

  // Save Confirmation Dialog state
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);

  // Sync server data to form state when data loads or changes
  useEffect(() => {
    if (orgDetail?.entitlements) {
      const ent = orgDetail.entitlements;
      setMaxTemplates(ent.maxTemplates ?? 5);
      setMaxCandidates(ent.maxCandidates ?? 25);
      setPendingInviteMultiplier(ent.pendingInviteMultiplier ?? 2.0);
      setTrialEndsAt(
        (ent.trialEndsAt ? new Date(ent.trialEndsAt).toISOString().split('T')[0] : '') ?? ''
      );
      setFlags({
        cloud: Boolean(ent.flags?.cloud ?? true),
        chat: Boolean(ent.flags?.chat ?? true),
        local: Boolean(ent.flags?.local ?? false),
        browser: Boolean(ent.flags?.browser ?? false),
        white_label: Boolean(ent.flags?.white_label ?? false),
        custom_domain: Boolean(ent.flags?.custom_domain ?? false),
        managed_ai_credits: Boolean(ent.flags?.managed_ai_credits ?? false),
        extra_agents: Boolean(ent.flags?.extra_agents ?? false),
      });
    }
  }, [orgDetail]);

  const handleResetForm = () => {
    if (!orgDetail?.entitlements) return;
    const ent = orgDetail.entitlements;
    setMaxTemplates(ent.maxTemplates ?? 5);
    setMaxCandidates(ent.maxCandidates ?? 25);
    setPendingInviteMultiplier(ent.pendingInviteMultiplier ?? 2.0);
    setTrialEndsAt(
      (ent.trialEndsAt ? new Date(ent.trialEndsAt).toISOString().split('T')[0] : '') ?? ''
    );
    setFlags({
      cloud: Boolean(ent.flags?.cloud ?? true),
      chat: Boolean(ent.flags?.chat ?? true),
      local: Boolean(ent.flags?.local ?? false),
      browser: Boolean(ent.flags?.browser ?? false),
      white_label: Boolean(ent.flags?.white_label ?? false),
      custom_domain: Boolean(ent.flags?.custom_domain ?? false),
      managed_ai_credits: Boolean(ent.flags?.managed_ai_credits ?? false),
      extra_agents: Boolean(ent.flags?.extra_agents ?? false),
    });
    toast({
      title: 'Form Reset',
      description: 'Entitlements fields reset to current server values.',
      variant: 'info',
    });
  };

  const handleSaveEntitlements = async () => {
    if (!orgId) return;

    // Validate bounds
    if (maxTemplates < 1 || maxTemplates > 100) {
      toast({
        title: 'Validation Error',
        description: 'Max templates must be between 1 and 100.',
        variant: 'error',
      });
      return;
    }

    if (maxCandidates < 1 || maxCandidates > 10000) {
      toast({
        title: 'Validation Error',
        description: 'Max candidates must be between 1 and 10,000.',
        variant: 'error',
      });
      return;
    }

    if (pendingInviteMultiplier < 1.0 || pendingInviteMultiplier > 5.0) {
      toast({
        title: 'Validation Error',
        description: 'Pending invite multiplier must be between 1.0 and 5.0.',
        variant: 'error',
      });
      return;
    }

    const payload: UpdateOrgEntitlementsDto = {
      maxTemplates,
      maxCandidates,
      pendingInviteMultiplier,
      trialEndsAt: trialEndsAt ? new Date(trialEndsAt).toISOString() : null,
      flags,
    };

    try {
      await updateEntitlements({ id: orgId, entitlements: payload }).unwrap();
      setConfirmSaveOpen(false);
      toast({
        title: 'Entitlements Updated',
        description: `Successfully modified entitlements and feature flags for ${orgDetail?.name || 'organization'}.`,
        variant: 'success',
      });
      onRefresh?.();
    } catch (err: any) {
      toast({
        title: 'Update Failed',
        description: err?.data?.detail || err?.data?.message || err?.message || 'Failed to update entitlements.',
        variant: 'error',
      });
    }
  };

  const handleConfirmStatusChange = async () => {
    if (!orgId || !orgDetail) return;
    const { targetStatus } = statusDialog;

    try {
      await updateStatus({ id: orgId, status: targetStatus }).unwrap();
      setStatusDialog({ open: false, targetStatus: 'suspended' });
      toast({
        title: targetStatus === 'suspended' ? 'Company Suspended' : 'Company Reinstated',
        description: `"${orgDetail.name}" status updated to ${targetStatus} (BR-07).`,
        variant: targetStatus === 'suspended' ? 'warning' : 'success',
      });
      refetch();
      onRefresh?.();
    } catch (err: any) {
      toast({
        title: 'Status Update Failed',
        description: err?.data?.message || err?.message || 'An unexpected error occurred.',
        variant: 'error',
      });
    }
  };

  const isSuspended =
    orgDetail?.status === 'suspended';
  const isTrial =
    orgDetail?.status === 'trial' || orgDetail?.status === 'trial_active';
  const isActive =
    orgDetail?.status === 'active' || orgDetail?.status === 'paid_active';

  let badgeVariant: 'success' | 'warning' | 'danger' | 'default' = 'default';
  let statusLabel = orgDetail?.status || 'Unknown';

  if (isActive) {
    badgeVariant = 'success';
    statusLabel = 'Active';
  } else if (isTrial) {
    badgeVariant = 'warning';
    statusLabel = 'Trial';
  } else if (isSuspended) {
    badgeVariant = 'danger';
    statusLabel = 'Suspended';
  }

  const targetReinstateStatus: OrganizationStatus =
    orgDetail?.planId === 'plan_pro' ? 'active' : 'trial';

  return (
    <Drawer
      open={open}
      onClose={onClose}
      position="right"
      size="xl"
      title={
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
            {orgDetail?.name?.charAt(0).toUpperCase() || <Building2 className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-semibold text-neutral-900 dark:text-neutral-100">
                {orgDetail?.name || 'Organization Details'}
              </span>
              {orgDetail && (
                <Badge variant={badgeVariant} dot className="uppercase text-[11px]">
                  {statusLabel}
                </Badge>
              )}
            </div>
            <div className="text-xs text-neutral-500 font-mono truncate">
              {orgDetail?.slug} &bull; {orgId}
            </div>
          </div>
        </div>
      }
      description="Inspect tenant governance settings, active usage metrics, and modify runtime entitlements (BR-05)."
      data-testid="tenant-detail-drawer"
    >
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {isLoading && !orgDetail ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
            <Spinner size="lg" className="text-primary-600" />
            <p className="text-sm text-neutral-500">Loading organization details...</p>
          </div>
        ) : !orgDetail ? (
          <div className="p-8 text-center text-sm text-neutral-500">
            Organization not found or unable to load details.
          </div>
        ) : (
          <>
            {/* Top Telemetry & Resource Counters */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
                <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                  <Users className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Candidates</span>
                </div>
                <div className="mt-1 text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  {orgDetail.stats?.candidateCount ?? 0}
                  <span className="text-xs font-normal text-neutral-400 ml-1">
                    / {orgDetail.entitlements?.maxCandidates ?? 25}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
                <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                  <Layers className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Assessments</span>
                </div>
                <div className="mt-1 text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  {orgDetail.stats?.assessmentCount ?? 0}
                  <span className="text-xs font-normal text-neutral-400 ml-1">
                    / {orgDetail.entitlements?.maxTemplates ?? 5}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
                <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                  <Server className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Active Workspaces</span>
                </div>
                <div className="mt-1 text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  {orgDetail.stats?.activeWorkspacesCount ?? 0}
                </div>
              </div>
            </div>

            {/* General Information Card */}
            <div className="rounded-lg border border-neutral-200 bg-white p-4 space-y-3 dark:border-neutral-800 dark:bg-neutral-950">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Tenant Identity & Admin Contact
              </h3>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-neutral-500">Primary Admin:</span>
                  <div className="font-medium text-neutral-900 dark:text-neutral-100 mt-0.5">
                    {orgDetail.primaryAdmin?.name || 'Unassigned'}
                  </div>
                  <div className="text-neutral-500 font-mono">
                    {orgDetail.primaryAdmin?.email || 'N/A'}
                  </div>
                </div>

                <div>
                  <span className="text-neutral-500">Custom Domain:</span>
                  <div className="font-medium text-neutral-900 dark:text-neutral-100 mt-0.5">
                    {orgDetail.customDomain || 'Not configured'}
                  </div>
                  <span className="text-neutral-400 text-[11px]">
                    {orgDetail.whiteLabel ? 'White Label Enabled' : 'Standard Branding'}
                  </span>
                </div>

                <div>
                  <span className="text-neutral-500">Data Retention:</span>
                  <div className="font-medium text-neutral-900 dark:text-neutral-100 mt-0.5">
                    {orgDetail.retentionDays} Days (BR-32)
                  </div>
                </div>

                <div>
                  <span className="text-neutral-500">Provisioned On:</span>
                  <div className="font-medium text-neutral-900 dark:text-neutral-100 mt-0.5">
                    {new Date(orgDetail.createdAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Governance Status Action */}
            <div className="rounded-lg border border-neutral-200 bg-white p-4 space-y-3 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Governance Status Control
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {isSuspended
                      ? 'This organization is currently suspended. Reinstating restores candidate and company admin access.'
                      : 'Suspending halts all new candidate workspace launches and AI proxy requests immediately (BR-07).'}
                  </p>
                </div>
                <div>
                  {isSuspended ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setStatusDialog({ open: true, targetStatus: targetReinstateStatus })
                      }
                      className="text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800"
                      data-testid="drawer-reinstate-btn"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1.5" />
                      Reinstate Company
                    </Button>
                  ) : (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() =>
                        setStatusDialog({ open: true, targetStatus: 'suspended' })
                      }
                      data-testid="drawer-suspend-btn"
                    >
                      <AlertTriangle className="w-4 h-4 mr-1.5" />
                      Suspend Company
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Entitlement Modifier Form */}
            <div className="rounded-lg border border-neutral-200 bg-white p-4 space-y-4 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-neutral-800">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-primary-600" />
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    Enforced Resource Quotas (BR-05)
                  </h3>
                  <Badge variant="success" size="sm" dot>
                    Actively Enforced
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetForm}
                  className="text-xs text-neutral-500 hover:text-neutral-900"
                  data-testid="reset-entitlements-btn"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  Reset
                </Button>
              </div>

              {/* Informational Callout for Enforced Quotas */}
              <p className="text-xs text-neutral-500">
                These 4 resource quotas are strictly enforced on the server for every template assignment, candidate invite, and workspace launch.
              </p>

              {/* Numeric Caps Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="max-templates-input"
                    className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1"
                  >
                    Max Templates (1 - 100)
                  </label>
                  <Input
                    id="max-templates-input"
                    type="number"
                    min={1}
                    max={100}
                    value={maxTemplates}
                    onChange={(e) => setMaxTemplates(parseInt(e.target.value, 10) || 1)}
                    data-testid="max-templates-input"
                  />
                  <span className="text-[11px] text-neutral-400 mt-1 block">
                    Template assignments per tenant.
                  </span>
                </div>

                <div>
                  <label
                    htmlFor="max-candidates-input"
                    className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1"
                  >
                    Max Candidates (1 - 10,000)
                  </label>
                  <Input
                    id="max-candidates-input"
                    type="number"
                    min={1}
                    max={10000}
                    value={maxCandidates}
                    onChange={(e) => setMaxCandidates(parseInt(e.target.value, 10) || 1)}
                    data-testid="max-candidates-input"
                  />
                  <span className="text-[11px] text-neutral-400 mt-1 block">
                    Counts once on first workspace launch (BR-06).
                  </span>
                </div>

                <div>
                  <label
                    htmlFor="pending-multiplier-input"
                    className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1"
                  >
                    Pending Invite Multiplier (1.0 - 5.0x)
                  </label>
                  <Input
                    id="pending-multiplier-input"
                    type="number"
                    step="0.1"
                    min={1.0}
                    max={5.0}
                    value={pendingInviteMultiplier}
                    onChange={(e) =>
                      setPendingInviteMultiplier(parseFloat(e.target.value) || 2.0)
                    }
                    data-testid="pending-multiplier-input"
                  />
                  <span className="text-[11px] text-neutral-400 mt-1 block">
                    Pool = {Math.round(maxCandidates * pendingInviteMultiplier)} unlaunched invites allowed.
                  </span>
                </div>

                <div>
                  <label
                    htmlFor="trial-ends-input"
                    className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1"
                  >
                    Trial Expiry Date (Optional)
                  </label>
                  <Input
                    id="trial-ends-input"
                    type="date"
                    value={trialEndsAt}
                    onChange={(e) => setTrialEndsAt(e.target.value)}
                    data-testid="trial-ends-input"
                  />
                  <span className="text-[11px] text-neutral-400 mt-1 block">
                    Leave blank for unlimited duration.
                  </span>
                </div>
              </div>

              {/* Feature Flags Grid */}
              <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 block">
                      Persisted Configuration Flags (Metadata Only)
                    </span>
                    <Badge variant="warning" size="sm">
                      Not Runtime Enforced
                    </Badge>
                  </div>
                </div>

                <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                  <div className="font-semibold flex items-center gap-1.5 mb-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Configuration Metadata Only — No Runtime Enforcement</span>
                  </div>
                  <p>
                    Unlike the 4 numerical quotas above (which strictly enforce resource limits on the server), the 8 flags below are stored purely as configuration metadata in <code className="font-mono text-[11px]">app.entitlements.flags</code>. Toggling or editing these flags updates stored database settings and audit logs, but has <strong>no runtime enforcement or access gating effect</strong> in the current application.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded border border-neutral-100 p-2.5 dark:border-neutral-800">
                    <Switch
                      checked={flags.cloud}
                      onChange={(checked) => setFlags((prev) => ({ ...prev, cloud: checked }))}
                      label={
                        <span className="flex items-center justify-between gap-1 w-full">
                          <span>Cloud VM Workspace</span>
                          <Badge variant="default" size="sm">Metadata Only</Badge>
                        </span>
                      }
                      description="Stored configuration flag; workspace access is not restricted by this flag."
                      id="flag-cloud"
                    />
                  </div>

                  <div className="rounded border border-neutral-100 p-2.5 dark:border-neutral-800">
                    <Switch
                      checked={flags.chat}
                      onChange={(checked) => setFlags((prev) => ({ ...prev, chat: checked }))}
                      label={
                        <span className="flex items-center justify-between gap-1 w-full">
                          <span>Chat Workspace</span>
                          <Badge variant="default" size="sm">Metadata Only</Badge>
                        </span>
                      }
                      description="Stored configuration flag; chat workspace access is not restricted by this flag."
                      id="flag-chat"
                    />
                  </div>

                  <div className="rounded border border-neutral-100 p-2.5 dark:border-neutral-800">
                    <Switch
                      checked={flags.local}
                      onChange={(checked) => setFlags((prev) => ({ ...prev, local: checked }))}
                      label={
                        <span className="flex items-center justify-between gap-1 w-full">
                          <span>Local Workspace</span>
                          <Badge variant="default" size="sm">Metadata Only</Badge>
                        </span>
                      }
                      description="Stored configuration flag; Local mode is not built in MMP."
                      id="flag-local"
                    />
                  </div>

                  <div className="rounded border border-neutral-100 p-2.5 dark:border-neutral-800">
                    <Switch
                      checked={flags.browser}
                      onChange={(checked) => setFlags((prev) => ({ ...prev, browser: checked }))}
                      label={
                        <span className="flex items-center justify-between gap-1 w-full">
                          <span>Browser Workspace</span>
                          <Badge variant="default" size="sm">Metadata Only</Badge>
                        </span>
                      }
                      description="Stored configuration flag; Browser mode is not built in MMP."
                      id="flag-browser"
                    />
                  </div>

                  <div className="rounded border border-neutral-100 p-2.5 dark:border-neutral-800">
                    <Switch
                      checked={flags.white_label}
                      onChange={(checked) =>
                        setFlags((prev) => ({ ...prev, white_label: checked }))
                      }
                      label={
                        <span className="flex items-center justify-between gap-1 w-full">
                          <span>White Label Branding</span>
                          <Badge variant="default" size="sm">Metadata Only</Badge>
                        </span>
                      }
                      description="Stored configuration flag; white labeling is not currently enforced."
                      id="flag-white-label"
                    />
                  </div>

                  <div className="rounded border border-neutral-100 p-2.5 dark:border-neutral-800">
                    <Switch
                      checked={flags.custom_domain}
                      onChange={(checked) =>
                        setFlags((prev) => ({ ...prev, custom_domain: checked }))
                      }
                      label={
                        <span className="flex items-center justify-between gap-1 w-full">
                          <span>Custom Domain Routing</span>
                          <Badge variant="default" size="sm">Metadata Only</Badge>
                        </span>
                      }
                      description="Stored configuration flag; custom domain routing is not currently enforced."
                      id="flag-custom-domain"
                    />
                  </div>

                  <div className="rounded border border-neutral-100 p-2.5 dark:border-neutral-800">
                    <Switch
                      checked={flags.managed_ai_credits}
                      onChange={(checked) =>
                        setFlags((prev) => ({ ...prev, managed_ai_credits: checked }))
                      }
                      label={
                        <span className="flex items-center justify-between gap-1 w-full">
                          <span>Managed AI Credits</span>
                          <Badge variant="default" size="sm">Metadata Only</Badge>
                        </span>
                      }
                      description="Stored configuration flag; managed AI credit allocation is not currently enforced."
                      id="flag-managed-ai-credits"
                    />
                  </div>

                  <div className="rounded border border-neutral-100 p-2.5 dark:border-neutral-800">
                    <Switch
                      checked={flags.extra_agents}
                      onChange={(checked) =>
                        setFlags((prev) => ({ ...prev, extra_agents: checked }))
                      }
                      label={
                        <span className="flex items-center justify-between gap-1 w-full">
                          <span>Extra Reviewer Agents</span>
                          <Badge variant="default" size="sm">Metadata Only</Badge>
                        </span>
                      }
                      description="Stored configuration flag; reviewer agent count is not currently gated."
                      id="flag-extra-agents"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800 flex justify-end gap-3">
                <Button variant="outline" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setConfirmSaveOpen(true)}
                  disabled={isSavingEntitlements}
                  data-testid="save-entitlements-btn"
                >
                  {isSavingEntitlements ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-1.5" />
                      Save Entitlements
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Confirmation Modal for Entitlement Changes */}
      <AlertDialog
        open={confirmSaveOpen}
        onClose={() => setConfirmSaveOpen(false)}
        onConfirm={handleSaveEntitlements}
        loading={isSavingEntitlements}
        title={`Update Entitlements for "${orgDetail?.name}"?`}
        description="Updating entitlements immediately modifies runtime candidate quotas, invite pool capacity, and enabled workspace modes. This administrative action is recorded in the append-only audit trail."
        confirmLabel="Confirm & Apply Changes"
        cancelLabel="Review Changes"
        variant="primary"
        data-testid="confirm-save-entitlements-dialog"
      />

      {/* Confirmation Modal for Status Changes */}
      <AlertDialog
        open={statusDialog.open}
        onClose={() =>
          setStatusDialog({ open: false, targetStatus: 'suspended' })
        }
        onConfirm={handleConfirmStatusChange}
        loading={isUpdatingStatus}
        title={
          statusDialog.targetStatus === 'suspended'
            ? `Suspend "${orgDetail?.name}"?`
            : `Reinstate "${orgDetail?.name}"?`
        }
        description={
          statusDialog.targetStatus === 'suspended'
            ? 'Suspending this company immediately blocks new candidate workspace launches, assessment publishing, and AI proxy routing (BR-07). Running candidate sessions will complete gracefully.'
            : 'Reinstating this company restores full access to the company portal, candidate workspace launches, and assigned assessment templates.'
        }
        confirmLabel={
          statusDialog.targetStatus === 'suspended' ? 'Suspend Company' : 'Reinstate Company'
        }
        cancelLabel="Cancel"
        variant={statusDialog.targetStatus === 'suspended' ? 'danger' : 'primary'}
        data-testid="confirm-drawer-status-dialog"
      />
    </Drawer>
  );
}
