'use client';

import React, { useState } from 'react';
import { Dialog, Button, Input, Textarea, FormField, FormLabel, FormError, FormDescription } from '@hs/ui';
import { EvaluationSignalsEditor } from './evaluation-signals-editor';
import { RedFlagsEditor } from './red-flags-editor';
import { ScoringAnchorsEditor } from './scoring-anchors-editor';
import {
  RubricDimensionSchema,
  DEFAULT_SCORING_ANCHORS,
  type RubricDimension,
} from './types';

export interface RubricDimensionFormProps {
  open: boolean;
  initialValue?: RubricDimension | null;
  onClose: () => void;
  onSave: (dimension: RubricDimension) => void;
}

export function RubricDimensionForm({
  open,
  initialValue,
  onClose,
  onSave,
}: RubricDimensionFormProps): React.JSX.Element {
  const isEditing = Boolean(initialValue);

  const [formState, setFormState] = useState<RubricDimension>(() => {
    if (initialValue) return initialValue;
    return {
      id: `dim_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: '',
      description: '',
      weight: 20,
      signals: [],
      redFlags: [],
      scoringAnchors: [...DEFAULT_SCORING_ANCHORS],
    };
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when dialog opens with new initialValue
  React.useEffect(() => {
    if (open) {
      if (initialValue) {
        setFormState(initialValue);
      } else {
        setFormState({
          id: `dim_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: '',
          description: '',
          weight: 20,
          signals: [],
          redFlags: [],
          scoringAnchors: [...DEFAULT_SCORING_ANCHORS],
        });
      }
      setErrors({});
    }
  }, [open, initialValue]);

  const handleValidateAndSave = () => {
    setErrors({});
    const result = RubricDimensionSchema.safeParse(formState);

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const key = issue.path[0]?.toString() || 'global';
        fieldErrors[key] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    onSave(result.data);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEditing ? 'Edit Scoring Dimension' : 'Add New Scoring Dimension'}
      description="Configure dimension evaluation criteria, signals, red flags, and scoring levels for AI reviewer agents."
      className="max-w-3xl p-6 sm:p-8 rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto"
    >
      <div className="space-y-6 my-4">
        {/* Name & Weight Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <FormField>
              <FormLabel htmlFor="dimension-name" required>
                Dimension Title
              </FormLabel>
              <Input
                id="dimension-name"
                value={formState.name}
                onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                placeholder="e.g. Code Quality & Modularity"
                data-testid="dimension-name-input"
                className="h-10 text-sm rounded-xl border-neutral-200 focus:border-primary"
              />
              {errors.name && <FormError>{errors.name}</FormError>}
            </FormField>
          </div>

          <div>
            <FormField>
              <FormLabel htmlFor="dimension-weight" required>
                Allocated Weight (%)
              </FormLabel>
              <Input
                id="dimension-weight"
                type="number"
                min={1}
                max={100}
                value={formState.weight}
                onChange={(e) => setFormState({ ...formState, weight: Number(e.target.value) || 0 })}
                data-testid="dimension-weight-input"
                className="h-10 text-sm font-mono rounded-xl border-neutral-200 focus:border-primary"
              />
              {errors.weight && <FormError>{errors.weight}</FormError>}
            </FormField>
          </div>
        </div>

        {/* Evaluation Goal / Description */}
        <FormField>
          <FormLabel htmlFor="dimension-description" required>
            Evaluation Goal &amp; Scope
          </FormLabel>
          <Textarea
            id="dimension-description"
            rows={3}
            value={formState.description}
            onChange={(e) => setFormState({ ...formState, description: e.target.value })}
            placeholder="Explain what the AI reviewer agent should evaluate in candidate submissions for this dimension..."
            data-testid="dimension-description-input"
            className="text-xs sm:text-sm rounded-xl p-3 border-neutral-200 focus:border-primary"
          />
          <FormDescription>
            Clear guidelines ensure consistent and objective scoring by reviewer agents.
          </FormDescription>
          {errors.description && <FormError>{errors.description}</FormError>}
        </FormField>

        {/* Evaluation Signals */}
        <div className="p-4 rounded-xl border border-neutral-200/90 bg-neutral-50/50">
          <EvaluationSignalsEditor
            signals={formState.signals}
            onChange={(signals) => setFormState({ ...formState, signals })}
          />
        </div>

        {/* Red Flags */}
        <div className="p-4 rounded-xl border border-neutral-200/90 bg-neutral-50/50">
          <RedFlagsEditor
            redFlags={formState.redFlags}
            onChange={(redFlags) => setFormState({ ...formState, redFlags })}
          />
        </div>

        {/* Scoring Anchors */}
        <div className="p-4 rounded-xl border border-neutral-200/90 bg-neutral-50/50">
          <ScoringAnchorsEditor
            anchors={formState.scoringAnchors}
            onChange={(scoringAnchors) => setFormState({ ...formState, scoringAnchors })}
          />
        </div>
      </div>

      {/* Footer Controls */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-100">
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
          onClick={handleValidateAndSave}
          data-testid="save-dimension-btn"
          className="rounded-xl px-5 shadow-sm"
        >
          {isEditing ? 'Update Dimension' : 'Add Dimension'}
        </Button>
      </div>
    </Dialog>
  );
}

