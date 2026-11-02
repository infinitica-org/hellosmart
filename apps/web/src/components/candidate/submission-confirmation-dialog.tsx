'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
  Button,
  Checkbox,
} from '@hs/ui';
import {
  CheckCircle2,
  AlertTriangle,
  GitBranch,
  FileArchive,
  FileText,
  Send,
} from 'lucide-react';
import type { CandidateDraft } from '@hs/contracts';

export interface SubmissionConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  draft: CandidateDraft;
  onConfirm: () => Promise<void>;
  isSubmitting?: boolean;
}

export function SubmissionConfirmationDialog({
  open,
  onClose,
  draft,
  onConfirm,
  isSubmitting = false,
}: SubmissionConfirmationDialogProps): React.JSX.Element {
  const [hasConfirmed, setHasConfirmed] = useState(false);

  const hasRepo = Boolean(draft.repositoryUrl && draft.repositoryUrl.trim().length > 0);
  const hasBranch = Boolean(draft.branchName && draft.branchName.trim().length > 0);
  const hasNotes = Boolean(draft.architectureNotes && draft.architectureNotes.trim().length >= 10);
  const hasArtifact = Boolean(draft.uploadedArtifact);

  const canSubmit = hasRepo && hasBranch && hasNotes && hasConfirmed && !isSubmitting;

  const handleConfirmClick = async () => {
    if (!canSubmit) return;
    await onConfirm();
  };

  return (
    <Dialog open={open} onClose={isSubmitting ? () => {} : onClose}>
      <DialogHeader>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <DialogTitle>Confirm Assessment Submission</DialogTitle>
            <DialogDescription>
              Review your completed deliverables before final submission lock
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <DialogContent>
        <div className="space-y-4 py-2 text-xs">
          {/* Deliverables Verification Checklist */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 p-4 space-y-3">
            <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center justify-between">
              <span>Deliverables Checklist</span>
              <span className="text-[11px] font-normal text-neutral-500">
                {hasRepo && hasBranch && hasNotes ? '3 / 3 Required Ready' : 'Incomplete deliverables'}
              </span>
            </h4>

            {/* GitHub Repo */}
            <div className="flex items-start justify-between gap-3 pb-2.5 border-b border-neutral-200/60 dark:border-neutral-700/60">
              <div className="flex items-start gap-2.5 min-w-0">
                <GitBranch className="w-4 h-4 text-neutral-600 dark:text-neutral-300 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <span className="font-medium text-neutral-900 dark:text-neutral-100 block truncate">
                    {hasRepo ? draft.repositoryUrl : 'Repository URL missing'}
                  </span>
                  <span className="text-[11px] text-neutral-500 block">
                    Branch: {hasBranch ? draft.branchName : 'main (required)'}
                  </span>
                </div>
              </div>
              {hasRepo && hasBranch ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              )}
            </div>

            {/* Architecture Notes */}
            <div className="flex items-start justify-between gap-3 pb-2.5 border-b border-neutral-200/60 dark:border-neutral-700/60">
              <div className="flex items-start gap-2.5 min-w-0">
                <FileText className="w-4 h-4 text-neutral-600 dark:text-neutral-300 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <span className="font-medium text-neutral-900 dark:text-neutral-100 block">
                    Architecture &amp; Design Notes
                  </span>
                  <span className="text-[11px] text-neutral-500 block">
                    {hasNotes
                      ? `${draft.architectureNotes.trim().length} characters documented`
                      : 'Minimum 10 characters required'}
                  </span>
                </div>
              </div>
              {hasNotes ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              )}
            </div>

            {/* Solution Archive */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <FileArchive className="w-4 h-4 text-neutral-600 dark:text-neutral-300 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <span className="font-medium text-neutral-900 dark:text-neutral-100 block truncate">
                    {hasArtifact ? draft.uploadedArtifact?.originalName : 'Solution Archive (Optional)'}
                  </span>
                  <span className="text-[11px] text-neutral-500 block">
                    {hasArtifact
                      ? `${(draft.uploadedArtifact!.sizeBytes / (1024 * 1024)).toFixed(2)} MB uploaded`
                      : 'Included in GitHub repository or uploaded directly'}
                  </span>
                </div>
              </div>
              {hasArtifact && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            </div>
          </div>

          {/* Missing Deliverables Warning */}
          {(!hasRepo || !hasBranch || !hasNotes) && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Please complete all required deliverables (Repository URL, branch name, and architecture notes) before final submission.
              </span>
            </div>
          )}

          {/* Finality Checkbox */}
          <div className="pt-2">
            <Checkbox
              id="confirm-submission-checkbox"
              checked={hasConfirmed}
              onChange={(e) => setHasConfirmed(e.target.checked)}
              label="I confirm this is my final submission. Once submitted, my session will end and no further edits can be made."
            />
          </div>
        </div>
      </DialogContent>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          size="md"
          className="!rounded-lg px-4 py-2"
          onClick={onClose}
          disabled={isSubmitting}
        >
          Cancel
        </Button>

        <Button
          type="button"
          variant="primary"
          size="md"
          className="!rounded-lg px-5 py-2 font-semibold"
          onClick={handleConfirmClick}
          disabled={!canSubmit}
          isLoading={isSubmitting}
          data-testid="confirm-final-submission-button"
        >
          {isSubmitting ? 'Submitting Assessment...' : 'Finalize & Submit'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
