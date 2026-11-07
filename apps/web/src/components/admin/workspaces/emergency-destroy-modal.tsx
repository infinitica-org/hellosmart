'use client';

import React, { useState } from 'react';
import { AlertOctagon, AlertTriangle, ShieldAlert, X } from 'lucide-react';
import { Button, Spinner, useToast } from '@hs/ui';
import { useEmergencyDestroyWorkspaceMutation } from '@/store/admin/adminApi';
import type { AdminWorkspaceListItemDto, AdminWorkspaceDetailDto } from '@hs/contracts';

interface EmergencyDestroyModalProps {
  workspace: AdminWorkspaceListItemDto | AdminWorkspaceDetailDto | null;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function EmergencyDestroyModal({
  workspace,
  open,
  onClose,
  onSuccess,
}: EmergencyDestroyModalProps) {
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [destroyWorkspace, { isLoading }] = useEmergencyDestroyWorkspaceMutation();
  const { toast } = useToast();

  if (!open || !workspace) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmed = reason.trim();
    if (trimmed.length < 5) {
      setErrorMsg('Reason must be at least 5 characters explaining the emergency termination.');
      return;
    }

    try {
      const res = await destroyWorkspace({
        id: workspace.id,
        reason: trimmed,
      }).unwrap();

      toast({
        title: 'Workspace Destroyed',
        description: `Workspace for ${workspace.candidateName} was permanently destroyed and write access revoked.`,
        variant: 'destructive',
      });

      setReason('');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      const detail = err?.data?.detail || err?.message || 'Failed to execute emergency destroy';
      setErrorMsg(detail);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="destroy-modal-title"
    >
      <div className="w-full max-w-lg bg-slate-900 border border-rose-500/40 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-rose-950/30 border-b border-rose-500/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <h2 id="destroy-modal-title" className="text-lg font-semibold text-rose-100">
                Emergency Destroy Workspace
              </h2>
              <p className="text-xs text-rose-300/80">Platform Admin Kill-Switch (AD-019 / BR-22)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Critical Warning Callout */}
          <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 flex gap-3 text-xs text-rose-200">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-100">Destructive & Irreversible Action</p>
              <p className="mt-0.5 text-rose-200/90">
                This will immediately invalidate the candidate&apos;s workspace write tokens and revoke
                assignment access. Candidates will be blocked from reconnecting or submitting.
              </p>
            </div>
          </div>

          {/* Target Identity Metadata */}
          <div className="bg-slate-950/60 rounded-lg p-3.5 border border-slate-800 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Workspace ID:</span>
              <span className="font-mono text-slate-200">{workspace.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Candidate:</span>
              <span className="font-medium text-slate-200">
                {workspace.candidateName} ({workspace.candidateEmail})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Organization:</span>
              <span className="text-slate-200">{workspace.orgName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Assessment:</span>
              <span className="text-slate-200">{workspace.assessmentName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Current Status:</span>
              <span className="capitalize font-medium text-amber-400">{workspace.status}</span>
            </div>
          </div>

          {/* Mandatory Reason Input */}
          <div className="space-y-1.5">
            <label htmlFor="destroy-reason" className="block text-xs font-medium text-slate-300">
              Reason for Emergency Destruction <span className="text-rose-400">*</span>
            </label>
            <textarea
              id="destroy-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isLoading}
              placeholder="e.g., Security egress anomaly detected, or candidate requested early termination..."
              className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 transition-colors"
            />
            <p className="text-[11px] text-slate-400">
              Required (min 5 characters). This reason is permanently recorded in the immutable
              SHA-256 hash-chained platform audit log.
            </p>
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
              {errorMsg}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || reason.trim().length < 5}
              className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold gap-2 border-0 shadow-lg shadow-rose-900/30"
            >
              {isLoading ? (
                <>
                  <Spinner className="w-3.5 h-3.5" />
                  <span>Destroying...</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-4 h-4" />
                  <span>Confirm Emergency Destroy</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

