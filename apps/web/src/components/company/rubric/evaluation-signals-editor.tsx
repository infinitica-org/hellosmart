'use client';

import React, { useState } from 'react';
import { Button, Input, FormField, FormLabel, FormDescription } from '@hs/ui';

export interface EvaluationSignalsEditorProps {
  signals: string[];
  onChange: (signals: string[]) => void;
  disabled?: boolean;
}

export function EvaluationSignalsEditor({
  signals,
  onChange,
  disabled = false,
}: EvaluationSignalsEditorProps): React.JSX.Element {
  const [newSignal, setNewSignal] = useState('');

  const handleAdd = () => {
    const trimmed = newSignal.trim();
    if (!trimmed || signals.includes(trimmed)) return;
    onChange([...signals, trimmed]);
    setNewSignal('');
  };

  const handleRemove = (index: number) => {
    onChange(signals.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <FormField className="space-y-2">
      <div className="flex items-center justify-between">
        <FormLabel>Evaluation Signals (Positive Evidence)</FormLabel>
        <span className="text-[11px] font-mono text-neutral-400">
          {signals.length} signal{signals.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="flex gap-2">
        <Input
          value={newSignal}
          onChange={(e) => setNewSignal(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="e.g. Uses parameterized queries to prevent SQL injection"
          data-testid="new-signal-input"
          className="h-9 text-xs rounded-lg border-neutral-200 focus:border-primary"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          disabled={disabled || !newSignal.trim()}
          data-testid="add-signal-btn"
          className="shrink-0 h-9 px-3 text-xs rounded-lg border-neutral-200"
        >
          + Add
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5 pt-1">
        {signals.map((signal, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1.5 text-xs py-1 px-2.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200"
          >
            <span>{signal}</span>
            {!disabled && (
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                className="text-emerald-600 hover:text-emerald-950 p-0.5"
                aria-label={`Remove signal ${signal}`}
              >
                ✕
              </button>
            )}
          </span>
        ))}
        {signals.length === 0 && (
          <span className="text-xs text-neutral-400 italic">No evaluation signals configured yet.</span>
        )}
      </div>

      <FormDescription>
        Specific observable patterns our AI reviewer agents cite when awarding high marks.
      </FormDescription>
    </FormField>
  );
}

