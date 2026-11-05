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
      <div className="my-4 p-4 rounded-xl bg-danger-muted border border-danger-border text-xs text-danger-foreground space-y-1.5">
        <div className="font-semibold text-danger-foreground">
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
          variant="danger"
          size="md"
          onClick={() => {
            onConfirm();
            onClose();
          }}
          data-testid="confirm-delete-dimension-btn"
          className="rounded-xl shadow-sm"
        >
          Delete Dimension
        </Button>
      </div>
    </Dialog>
  );
}

