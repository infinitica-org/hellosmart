'use client';

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button, Alert, Card } from '@hs/ui';
import { WeightBalanceBar } from './weight-balance-bar';
import { RubricDimensionCard } from './rubric-dimension-card';
import { RubricDimensionForm } from './rubric-dimension-form';
import { DeleteRubricDimensionDialog } from './delete-rubric-dimension-dialog';
import { useUpdateAssessmentRubric } from '@/hooks/company/use-assessment-rubric';
import { UI_LABELS, ALERT_MESSAGES, RUBRIC_WEIGHT_TOTAL } from '@/constants';
import {
  calculateWeightBalance,
  type RubricDimension,
  type AssessmentRubric,
} from './types';

export interface RubricEditorProps {
  assessmentId: string;
  templateId: string;
  templateVersionId: string;
  initialDimensions: RubricDimension[];
  onSaveSuccess?: () => void;
  className?: string;
}

export function RubricEditor({
  assessmentId,
  templateId,
  templateVersionId,
  initialDimensions,
  onSaveSuccess,
  className = '',
}: RubricEditorProps): React.JSX.Element {
  const [dimensions, setDimensions] = useState<RubricDimension[]>(initialDimensions);
  const [editingDimension, setEditingDimension] = useState<RubricDimension | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [dimensionToDelete, setDimensionToDelete] = useState<RubricDimension | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Weight Balance Calculation (Integer precision)
  const balance = calculateWeightBalance(dimensions);

  // Mutation to persist assessment-specific rubric
  const { mutate: saveRubric, isPending: isSaving } = useUpdateAssessmentRubric(assessmentId);

  // Handle Dimension Add / Update
  const handleSaveDimension = (dim: RubricDimension) => {
    setSaveError(null);
    setSaveSuccessMessage(null);

    const exists = dimensions.some((d) => d.id === dim.id);
    if (exists) {
      setDimensions(dimensions.map((d) => (d.id === dim.id ? dim : d)));
    } else {
      setDimensions([...dimensions, dim]);
    }
  };

  // Handle Quick Weight Change directly from Card input
  const handleWeightChange = (id: string, newWeight: number) => {
    setSaveError(null);
    setSaveSuccessMessage(null);
    const clamped = Math.max(0, Math.min(100, newWeight));
    setDimensions(dimensions.map((d) => (d.id === id ? { ...d, weight: clamped } : d)));
  };

  // Handle Dimension Delete
  const handleConfirmDelete = () => {
    if (!dimensionToDelete) return;
    setSaveError(null);
    setSaveSuccessMessage(null);
    setDimensions(dimensions.filter((d) => d.id !== dimensionToDelete.id));
    setDimensionToDelete(null);
  };

  // Save Rubric Configuration (Enforces 100% Invariant)
  const handleSaveRubric = () => {
    if (!balance.isBalanced) {
      setSaveError(`Cannot save rubric: total weight is ${balance.totalWeight}%. ${ALERT_MESSAGES.RUBRIC.TOTAL_WEIGHT_MUST_EQUAL_100}.`);
      return;
    }

    setSaveError(null);
    setSaveSuccessMessage(null);

    const payload: AssessmentRubric = {
      assessmentId,
      templateId,
      templateVersionId,
      dimensions,
    };

    saveRubric(payload, {
      onSuccess: () => {
        setSaveSuccessMessage('Rubric configuration successfully saved and applied to assessment.');
        onSaveSuccess?.();
      },
      onError: (err) => {
        setSaveError(err.message || 'Failed to save rubric configuration to server.');
      },
    });
  };

  return (
    <div className={`space-y-6 max-w-5xl mx-auto ${className}`} data-testid="rubric-editor">
      {/* ─── Real-Time Weight Balance Bar ─── */}
      <WeightBalanceBar dimensions={dimensions} />

      {/* ─── Save / Error Notification ─── */}
      {saveError && (
        <Alert variant="error" className="text-xs">
          <div className="font-semibold">Validation Er
            ror</div>
          <p>{saveError}</p>
        </Alert>
      )}

      {saveSuccessMessage && (
        <Alert variant="success" className="text-xs">
          <div className="font-semibold">Success</div>
          <p>{saveSuccessMessage}</p>
        </Alert>
      )}

      {/* ─── Dimensions List Header & Add Button ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div>
          <h3 className="text-base font-bold text-neutral-900">
            Scoring Dimensions ({dimensions.length})
          </h3>
          <p className="text-xs text-neutral-500">
            Configure independent reviewer agent dimensions, scoring anchors, and red-flag conditions.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setEditingDimension(null);
            setIsFormOpen(true);
          }}
          data-testid="add-dimension-btn"
          className="h-10 px-4 rounded-xl border-neutral-300 text-neutral-800 hover:border-primary hover:text-primary self-start sm:self-auto"
        >
          + Add Dimension
        </Button>
      </div>

      {/* ─── Dimension Cards ─── */}
      {dimensions.length > 0 ? (
        <div className="space-y-4" data-testid="rubric-dimensions-list">
          {dimensions.map((dim) => (
            <RubricDimensionCard
              key={dim.id}
              dimension={dim}
              isOnlyDimension={dimensions.length === 1}
              onEdit={() => {
                setEditingDimension(dim);
                setIsFormOpen(true);
              }}
              onDelete={() => setDimensionToDelete(dim)}
              onWeightChange={(w) => handleWeightChange(dim.id, w)}
            />
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center rounded-2xl border-dashed border-neutral-300">
          <p className="text-sm text-neutral-500">No scoring dimensions in this rubric.</p>
        </Card>
      )}

      {/* ─── Sticky Bottom Action Bar ─── */}
      <div className="p-4 sm:p-5 rounded-2xl border border-neutral-200 bg-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky bottom-4 z-10">
        <div className="flex items-center gap-2">
          {balance.isBalanced ? (
            <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Rubric is 100% balanced and ready to save.
            </span>
          ) : (
            <span className="text-xs font-medium text-danger flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-danger animate-pulse" />
              {balance.message}. Total must be 100% to save.
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={!balance.isBalanced || isSaving}
            onClick={handleSaveRubric}
            data-testid="save-rubric-btn"
            className="rounded-xl px-6 shadow-sm disabled:opacity-40"
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving Rubric…
              </span>
            ) : (
              UI_LABELS.BUTTONS.SAVE_CHANGES
            )}
          </Button>
        </div>
      </div>

      {/* ─── Add/Edit Dialog ─── */}
      <RubricDimensionForm
        open={isFormOpen}
        initialValue={editingDimension}
        onClose={() => {
          setIsFormOpen(false);
          setEditingDimension(null);
        }}
        onSave={handleSaveDimension}
      />

      {/* ─── Delete Confirmation Dialog ─── */}
      {dimensionToDelete && (
        <DeleteRubricDimensionDialog
          open={Boolean(dimensionToDelete)}
          dimensionName={dimensionToDelete.name}
          weight={dimensionToDelete.weight}
          onClose={() => setDimensionToDelete(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}

