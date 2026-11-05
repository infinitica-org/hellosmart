'use client';

import React, { useState } from 'react';
import { Button, Input, FormField, FormLabel, FormDescription } from '@hs/ui';

export interface RedFlagsEditorProps {
  redFlags: string[];
  onChange: (redFlags: string[]) => void;
  disabled?: boolean;
}

export function RedFlagsEditor({
  redFlags,
  onChange,
  disabled = false,
}: RedFlagsEditorProps): React.JSX.Element {
  const [newFlag, setNewFlag] = useState('');

  const handleAdd = () => {
    const trimmed = newFlag.trim();
    if (!trimmed || redFlags.includes(trimmed)) return;
    onChange([...redFlags, trimmed]);
    setNewFlag('');
  };

  const handleRemove = (index: number) => {
    onChange(redFlags.filter((_, i) => i !== index));
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
        <FormLabel>Red-Flag Conditions (Critical Warnings)</FormLabel>
        <span className="text-[11px] font-mono text-neutral-400">
          {redFlags.length} flag{redFlags.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="flex gap-2">
        <Input
          value={newFlag}
          onChange={(e) => setNewFlag(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="e.g. Hardcoded secrets, unhandled fatal exceptions"
          data-testid="new-red-flag-input"
          className="h-9 text-xs rounded-lg border-neutral-200 focus:border-danger"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          disabled={disabled || !newFlag.trim()}
          data-testid="add-red-flag-btn"
          className="shrink-0 h-9 px-3 text-xs rounded-lg border-neutral-200 hover:border-danger-border hover:text-danger"
        >
          + Add
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5 pt-1">
        {redFlags.map((flag, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1.5 text-xs py-1 px-2.5 rounded-lg bg-danger-muted text-danger-foreground border border-danger-border"
          >
            <span>🚩 {flag}</span>
            {!disabled && (
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                className="text-danger hover:text-danger-foreground p-0.5"
                aria-label={`Remove red flag ${flag}`}
              >
                ✕
              </button>
            )}
          </span>
        ))}
        {redFlags.length === 0 && (
          <span className="text-xs text-neutral-400 italic">No red flags configured.</span>
        )}
      </div>

      <FormDescription>
        Negative indicators flagged for human evaluators. Candidates are never auto-rejected (BR-20).
      </FormDescription>
    </FormField>
  );
}

