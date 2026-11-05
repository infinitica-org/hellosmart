'use client';

import React from 'react';
import { FormLabel, Textarea } from '@hs/ui';
import type { ScoringAnchor } from './types';

export interface ScoringAnchorsEditorProps {
  anchors: ScoringAnchor[];
  onChange: (anchors: ScoringAnchor[]) => void;
  disabled?: boolean;
}

export function ScoringAnchorsEditor({
  anchors,
  onChange,
  disabled = false,
}: ScoringAnchorsEditorProps): React.JSX.Element {
  const handleDescriptionChange = (score: 1 | 3 | 5, description: string) => {
    const updated = anchors.map((a) => (a.score === score ? { ...a, description } : a));
    onChange(updated);
  };

  const getAnchor = (score: 1 | 3 | 5) => {
    return anchors.find((a) => a.score === score) || {
      score,
      label: score === 1 ? 'Inadequate' : score === 3 ? 'Competent' : 'Exemplary',
      description: '',
    };
  };

  const levels: Array<{ score: 1 | 3 | 5; badgeColor: string; title: string }> = [
    { score: 1, badgeColor: 'bg-danger-muted text-danger-foreground border-danger-border', title: '1 – Inadequate' },
    { score: 3, badgeColor: 'bg-amber-100 text-amber-800 border-amber-200', title: '3 – Competent' },
    { score: 5, badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200', title: '5 – Exemplary' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <FormLabel>Scoring Level Anchors (1, 3, 5 Standard)</FormLabel>
        <span className="text-[11px] text-neutral-400 font-mono">AI Evaluation Guide</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {levels.map(({ score, badgeColor, title }) => {
          const anchor = getAnchor(score);

          return (
            <div
              key={score}
              className="p-3.5 rounded-xl border border-neutral-200/90 bg-neutral-50/50 space-y-2 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${badgeColor}`}>
                  {title}
                </span>
              </div>

              <Textarea
                rows={3}
                value={anchor.description}
                disabled={disabled}
                onChange={(e) => handleDescriptionChange(score, e.target.value)}
                placeholder={`What constitutes a score of ${score} in this dimension?`}
                data-testid={`anchor-description-input-${score}`}
                className="text-xs rounded-lg p-2.5 bg-white border-neutral-200 focus:border-primary leading-relaxed resize-none"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

