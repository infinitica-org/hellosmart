'use client';

import React, { useState } from 'react';
import { CandidateInstructionsEditor } from '../candidate-instructions-editor';
import { DeliverablesEditor } from '../deliverables-editor';
import { CandidateInstructionsPreview } from '../candidate-instructions-preview';
import type { AssessmentFormValues } from '../types';

export interface CandidateInstructionsStepProps {
  values: AssessmentFormValues;
  errors: Record<string, string>;
  onChange: (updates: Partial<AssessmentFormValues>) => void;
}

export function CandidateInstructionsStep({
  values,
  errors,
  onChange,
}: CandidateInstructionsStepProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');

  return (
    <div className="space-y-6" data-testid="wizard-step-2">
      {/* Mobile / Tablet View Switcher */}
      <div className="flex xl:hidden items-center p-1 rounded-xl bg-neutral-100 max-w-xs">
        <button
          type="button"
          onClick={() => setActiveTab('editor')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'editor' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500'
          }`}
        >
          Editor
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'preview' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500'
          }`}
        >
          Candidate Preview
        </button>
      </div>

      {/* Main Grid: 2 Columns on Desktop, Tabbed on Small Viewports */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
        {/* Left Column: Editors */}
        <div className={`space-y-6 ${activeTab === 'preview' ? 'hidden xl:block' : 'block'}`}>
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-card-border shadow-xs space-y-6">
            <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-500 font-mono">
              Task Brief &amp; Checklist
            </h4>

            <CandidateInstructionsEditor
              value={values.candidateInstructions}
              onChange={(val) => onChange({ candidateInstructions: val })}
              error={errors.candidateInstructions}
            />

            <DeliverablesEditor
              items={values.deliverables}
              onChange={(items) => onChange({ deliverables: items })}
              error={errors.deliverables}
            />
          </div>
        </div>

        {/* Right Column: Live Candidate Preview */}
        <div className={`${activeTab === 'editor' ? 'hidden xl:block' : 'block'}`}>
          <CandidateInstructionsPreview
            assessmentName={values.name}
            instructions={values.candidateInstructions}
            deliverables={values.deliverables}
          />
        </div>
      </div>
    </div>
  );
}

