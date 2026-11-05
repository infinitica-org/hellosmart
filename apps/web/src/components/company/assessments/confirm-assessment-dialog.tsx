'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, Button, Badge } from '@hs/ui';
import { UI_LABELS } from '@/constants';
import type { AssessmentFormValues } from './types';

export interface ConfirmAssessmentDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting?: boolean;
  values: AssessmentFormValues;
  templateName: string;
}

export function ConfirmAssessmentDialog({
  open,
  onClose,
  onConfirm,
  isSubmitting = false,
  values,
  templateName,
}: ConfirmAssessmentDialogProps): React.JSX.Element {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Create Assessment Blueprint"
      description="Please verify the assessment configuration before saving it to your organization's dashboard."
      className="max-w-lg p-6 rounded-2xl bg-white shadow-2xl"
    >
      <div className="space-y-4 my-4">
        <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200/80 space-y-2.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-neutral-500">Assessment Name:</span>
            <span className="font-semibold text-neutral-900 text-right">{values.name}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-neutral-500">Selected Blueprint:</span>
            <span className="font-semibold text-neutral-900 text-right">{templateName}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-neutral-500">Pinned Version:</span>
            <span className="font-mono text-neutral-700">v{values.templateVersionId}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-neutral-500">Time Allocation:</span>
            <span className="font-semibold text-neutral-900">{values.timing.durationMinutes} Minutes</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-neutral-500">Required Deliverables:</span>
            <span className="font-mono font-semibold text-primary">{values.deliverables.length} Items</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-neutral-500">Disconnect Policy:</span>
            <Badge variant={values.timing.pauseTimerOnDisconnect ? 'warning' : 'default'} size="sm">
              {values.timing.pauseTimerOnDisconnect ? 'Timer Paused' : 'Timer Runs (BR-09)'}
            </Badge>
          </div>
        </div>

        <p className="text-xs text-neutral-500 leading-relaxed">
          The assessment will be created in <strong className="text-neutral-800">Draft</strong> status. You can invite candidates or perform an internal dry run before publishing.
        </p>
      </div>

      <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-100">
        <Button
          variant="outline"
          size="md"
          onClick={onClose}
          disabled={isSubmitting}
          className="rounded-xl border-neutral-200 text-neutral-700 hover:bg-neutral-50"
        >
          {UI_LABELS.BUTTONS.CANCEL}
        </Button>

        <Button
          variant="primary"
          size="md"
          onClick={onConfirm}
          disabled={isSubmitting}
          data-testid="confirm-create-assessment-btn"
          className="rounded-xl px-5 shadow-sm"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating Blueprint…
            </span>
          ) : (
            UI_LABELS.BUTTONS.CREATE_ASSESSMENT
          )}
        </Button>
      </div>
    </Dialog>
  );
}

