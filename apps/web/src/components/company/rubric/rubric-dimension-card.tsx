'use client';

import React, { useState } from 'react';
import { Card, Badge, Button, Input } from '@hs/ui';
import type { RubricDimension } from './types';

export interface RubricDimensionCardProps {
  dimension: RubricDimension;
  onEdit: () => void;
  onDelete: () => void;
  onWeightChange: (newWeight: number) => void;
  isOnlyDimension?: boolean;
}

export function RubricDimensionCard({
  dimension,
  onEdit,
  onDelete,
  onWeightChange,
  isOnlyDimension = false,
}: RubricDimensionCardProps): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card
      data-testid={`rubric-dimension-card-${dimension.id}`}
      className="p-5 sm:p-6 rounded-2xl border border-card-border bg-white shadow-xs transition-all hover:border-neutral-300 space-y-4"
    >
      {/* ─── Top Row: Title, Weight & Actions ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-neutral-100 border border-neutral-200 flex items-center justify-center font-mono text-xs font-bold text-neutral-700 shrink-0">
            {dimension.weight}%
          </div>
          <div>
            <h4 className="text-base font-bold text-neutral-900">{dimension.name}</h4>
            <span className="text-[11px] text-neutral-400 font-mono">
              Dimension ID: {dimension.id}
            </span>
          </div>
        </div>

        {/* Quick Weight Adjuster & Action Buttons */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Quick Weight Adjustment Input */}
          <div className="flex items-center gap-1.5 mr-2">
            <span className="text-xs text-neutral-500 font-medium font-mono">Weight:</span>
            <Input
              type="number"
              min={1}
              max={100}
              value={dimension.weight}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (!isNaN(val)) onWeightChange(val);
              }}
              data-testid={`dimension-weight-input-${dimension.id}`}
              className="w-16 h-8 text-xs font-mono font-bold text-center rounded-lg border-neutral-200 focus:border-primary p-1"
            />
            <span className="text-xs font-mono text-neutral-400">%</span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onEdit}
            data-testid={`edit-dimension-btn-${dimension.id}`}
            className="h-8 px-2.5 text-xs rounded-lg border-neutral-200 text-neutral-700 hover:text-primary hover:border-primary"
          >
            Edit
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDelete}
            disabled={isOnlyDimension}
            title={isOnlyDimension ? 'At least one dimension is required' : 'Delete dimension'}
            data-testid={`delete-dimension-btn-${dimension.id}`}
            className="h-8 px-2.5 text-xs rounded-lg border-neutral-200 text-neutral-500 hover:text-danger hover:border-danger-border disabled:opacity-40"
          >
            Delete
          </Button>
        </div>
      </div>

      {/* ─── Dimension Description / Goal ─── */}
      <p className="text-xs sm:text-sm text-neutral-700 leading-relaxed">
        {dimension.description}
      </p>

      {/* ─── Quick Summary Tags (Signals & Red Flags count) ─── */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
        <div className="flex items-center gap-2">
          {dimension.signals.length > 0 && (
            <Badge variant="success" size="sm">
              {dimension.signals.length} Signals
            </Badge>
          )}
          {dimension.redFlags.length > 0 && (
            <Badge variant="danger" size="sm">
              {dimension.redFlags.length} Red Flags
            </Badge>
          )}
          <Badge variant="default" size="sm">
            3 Score Anchors
          </Badge>
        </div>

        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          data-testid={`toggle-expand-btn-${dimension.id}`}
          className="p-0 h-auto text-xs font-semibold"
        >
          {isExpanded ? 'Hide Criteria & Anchors ↑' : 'View Criteria & Anchors ↓'}
        </Button>
      </div>

      {/* ─── Expandable Details Section ─── */}
      {isExpanded && (
        <div className="pt-4 border-t border-neutral-100 space-y-4 animate-fade-in text-xs">
          {/* Evaluation Signals */}
          {dimension.signals.length > 0 && (
            <div className="space-y-1.5">
              <span className="font-semibold text-neutral-700 block">Evaluation Signals (Positive):</span>
              <div className="flex flex-wrap gap-1.5">
                {dimension.signals.map((s, idx) => (
                  <span
                    key={idx}
                    className="py-0.5 px-2 rounded-md bg-success-muted text-success-foreground border border-success-border"
                  >
                    ✓ {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Red Flags */}
          {dimension.redFlags.length > 0 && (
            <div className="space-y-1.5">
              <span className="font-semibold text-neutral-700 block">Red-Flag Conditions (Critical Warnings):</span>
              <div className="flex flex-wrap gap-1.5">
                {dimension.redFlags.map((rf, idx) => (
                  <span
                    key={idx}
                    className="py-0.5 px-2 rounded-md bg-danger-muted text-danger-foreground border border-danger-border"
                  >
                    🚩 {rf}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Scoring Anchors */}
          <div className="space-y-2 pt-1">
            <span className="font-semibold text-neutral-700 block">Scoring Anchors:</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {dimension.scoringAnchors.map((anchor) => (
                <div
                  key={anchor.score}
                  className="p-2.5 rounded-lg border border-neutral-200 bg-neutral-50/60 space-y-1"
                >
                  <div className="font-mono font-bold text-neutral-900">
                    Level {anchor.score}: {anchor.label}
                  </div>
                  <p className="text-[11px] text-neutral-600 leading-relaxed">
                    {anchor.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

