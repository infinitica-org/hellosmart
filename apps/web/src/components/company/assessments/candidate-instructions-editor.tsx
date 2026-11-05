'use client';

import React from 'react';
import { Textarea, FormField, FormLabel, FormError, FormDescription } from '@hs/ui';

export interface CandidateInstructionsEditorProps {
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
}

export function CandidateInstructionsEditor({
  value,
  onChange,
  error,
}: CandidateInstructionsEditorProps): React.JSX.Element {
  return (
    <FormField>
      <div className="flex items-center justify-between mb-1.5">
        <FormLabel htmlFor="candidate-instructions" required>
          Candidate Instructions (Markdown Supported)
        </FormLabel>
        <span className="text-[11px] font-mono text-neutral-400">
          {value.length} characters
        </span>
      </div>

      <Textarea
        id="candidate-instructions"
        rows={8}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Provide clear technical problem context, architectural requirements, and constraints for the candidate..."
        data-testid="candidate-instructions-editor"
        className="rounded-xl text-sm font-mono p-4 border-neutral-200 focus:border-primary focus:ring-1 focus:ring-primary/20 leading-relaxed bg-white"
      />

      <FormDescription>
        Candidates will review these instructions before launching their simulation workspace.
      </FormDescription>
      {error && <FormError>{error}</FormError>}
    </FormField>
  );
}

