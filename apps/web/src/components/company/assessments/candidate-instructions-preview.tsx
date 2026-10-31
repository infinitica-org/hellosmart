'use client';

import React from 'react';
import { Card, Badge, Alert } from '@hs/ui';

export interface CandidateInstructionsPreviewProps {
  assessmentName: string;
  instructions: string;
  deliverables: string[];
}

export function CandidateInstructionsPreview({
  assessmentName,
  instructions,
  deliverables,
}: CandidateInstructionsPreviewProps): React.JSX.Element {
  return (
    <Card
      data-testid="candidate-instructions-preview"
      className="p-5 sm:p-6 rounded-2xl border border-card-border bg-white shadow-xs space-y-6"
    >
      <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700 font-mono">
            Candidate View Live Preview
          </h4>
        </div>
        <Badge variant="info" size="sm">
          Simulation Workspace
        </Badge>
      </div>

      <Alert variant="info" className="text-xs">
        This preview reflects the exact instruction brief displayed to candidates when launching their test.
      </Alert>

      {/* Assessment Header */}
      <div>
        <h2 className="text-lg font-bold text-neutral-900">{assessmentName || 'Untitled Assessment'}</h2>
        <span className="text-xs text-neutral-500 font-mono">Evaluation Brief</span>
      </div>

      {/* Formatted Instructions */}
      <div className="space-y-2">
        <h5 className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-mono">
          Task Description
        </h5>
        <div className="text-sm text-neutral-800 leading-relaxed whitespace-pre-line p-4 rounded-xl bg-neutral-50 border border-neutral-100">
          {instructions || <span className="text-neutral-400 italic">No instructions provided yet.</span>}
        </div>
      </div>

      {/* Deliverables Checklist Preview */}
      <div className="space-y-2">
        <h5 className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-mono">
          Required Deliverables ({deliverables.length})
        </h5>
        {deliverables.length > 0 ? (
          <ul className="space-y-2">
            {deliverables.map((item, idx) => (
              <li
                key={idx}
                className="flex items-center gap-3 p-3 rounded-xl border border-neutral-200 bg-white text-xs sm:text-sm text-neutral-700"
              >
                <input
                  type="checkbox"
                  disabled
                  readOnly
                  checked={false}
                  className="rounded text-primary border-neutral-300 pointer-events-none"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-xs text-neutral-400 italic">No deliverables added yet.</div>
        )}
      </div>
    </Card>
  );
}

