'use client';

import React from 'react';
import { Dialog, Button } from '@hs/ui';

export interface DeleteRubricDimensionDialogProps {
  open: boolean;
  dimensionName: string;
  weight: number;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteRubricDimensionDialog({
  open,
  dimensionName,
  weight,
  onClose,
  onConfirm,
}: DeleteRubricDimensionDialogProps): React.JSX.Element {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Delete Rubric Dimension"
      description="Are you sure you want to delete this scoring dimension from the assessment rubric?"
      className="max-w-md p-6 rounded-2xl bg-white shadow-2xl"
    >
      <div className="my-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1.5">
        <div className="font-semibold text-rose-950">
          Removing: {dimensionName} ({weight}% weight)
        </div>
        <p>
          Deleting this dimension will reduce the total rubric weight by {weight}%. You will need to reallocate the remaining weight so the rubric sums to exactly 100%.
        </p>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          variant="outline"
          size="md"
          onClick={onClose}
          className="rounded-xl border-neutral-200 text-neutral-700"
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={() => {
            onConfirm();
            onClose();
          }}
          data-testid="confirm-delete-dimension-btn"
          className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-sm border-none"
        >
          Delete Dimension
        </Button>
      </div>
    </Dialog>
  );
}

