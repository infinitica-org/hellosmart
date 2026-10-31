'use client';

import React, { useState } from 'react';
import {
  Dialog,
  Button,
  Alert,
  Spinner,
  Trash2,
} from '@hs/ui';
import type { CandidateDto } from './types';
import { ApiError } from '@/lib/api-client';
import { ALERT_MESSAGES, UI_LABELS } from '@/constants';

export interface DeleteCandidateDialogProps {
  candidate: CandidateDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (candidateId: string) => Promise<void>;
  isDeleting?: boolean;
}

export function DeleteCandidateDialog({
  candidate,
  open,
  onOpenChange,
  onConfirm,
  isDeleting = false,
}: DeleteCandidateDialogProps) {
  const [apiError, setApiError] = useState<string | null>(null);

  if (!candidate) return null;

  const handleClose = () => {
    if (isDeleting) return;
    setApiError(null);
    onOpenChange(false);
  };

  const handleConfirm = async () => {
    setApiError(null);
    try {
      await onConfirm(candidate.id);
      handleClose();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setApiError(err.message);
      } else if (err instanceof Error) {
        setApiError(err.message);
      } else {
        setApiError(ALERT_MESSAGES.CANDIDATES.DELETE_FAILED);
      }
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          handleClose();
        } else {
          onOpenChange(true);
        }
      }}
      title={ALERT_MESSAGES.CANDIDATES.DELETE_CONFIRM_TITLE}
      description="Soft-delete candidate account and terminate active workspace sessions."
      size="md"
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isDeleting}
          >
            {UI_LABELS.BUTTONS.CANCEL}
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white"
          >
            {isDeleting && <Spinner size="sm" />}
            <Trash2 className="h-4 w-4" />
            <span>{isDeleting ? 'Deleting...' : UI_LABELS.BUTTONS.DELETE}</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {apiError && (
          <Alert variant="error" title="Deletion Error">
            {apiError}
          </Alert>
        )}

        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {candidate.name}
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            {candidate.email}
          </div>
        </div>

        <Alert variant="warning" title="Candidate Deletion & Retention (BR-31, CO-016)">
          This action will mark the candidate record as deleted, revoke pending invitations, and terminate
          any active workspace sessions. An audit log record will be permanently retained.
        </Alert>
      </div>
    </Dialog>
  );
}

