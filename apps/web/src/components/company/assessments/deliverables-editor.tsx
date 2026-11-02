'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button, Input, FormField, FormLabel, FormError, FormDescription } from '@hs/ui';

export interface DeliverablesEditorProps {
  items: string[];
  onChange: (items: string[]) => void;
  error?: string | undefined;
}

export function DeliverablesEditor({
  items,
  onChange,
  error,
}: DeliverablesEditorProps): React.JSX.Element {
  const [newItemText, setNewItemText] = useState('');

  const handleAdd = () => {
    const trimmed = newItemText.trim();
    if (!trimmed) return;

    onChange([...items, trimmed]);
    setNewItemText('');
  };

  const handleRemove = (index: number) => {
    const next = items.filter((_, i) => i !== index);
    onChange(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <FormField>
      <div className="flex items-center justify-between mb-1.5">
        <FormLabel required>Required Deliverables Checklist</FormLabel>
        <span className="text-[11px] font-mono text-neutral-400">
          {items.length} item{items.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Add New Deliverable Input */}
      <div className="flex gap-2 mb-3">
        <Input
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. Working PostgreSQL migration with indexes"
          data-testid="new-deliverable-input"
          className="h-10 text-sm rounded-xl border-neutral-200 focus:border-primary focus:ring-1 focus:ring-primary/20"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          disabled={!newItemText.trim()}
          data-testid="add-deliverable-btn"
          className="shrink-0 h-10 px-4 rounded-xl border-neutral-200 hover:border-primary hover:text-primary"
        >
          + Add Item
        </Button>
      </div>

      {/* Checklist Display */}
      {items.length > 0 ? (
        <ul className="space-y-2" data-testid="deliverables-checklist">
          {items.map((item, idx) => (
            <li
              key={idx}
              className="flex items-center justify-between p-3 rounded-xl border border-neutral-200/90 bg-neutral-50/50 text-xs sm:text-sm text-neutral-800"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-5 h-5 rounded-md bg-white border border-neutral-300 flex items-center justify-center text-[10px] font-mono text-neutral-500 shrink-0">
                  {idx + 1}
                </span>
                <span className="truncate">{item}</span>
              </div>

              <button
                type="button"
                onClick={() => handleRemove(idx)}
                className="text-neutral-400 hover:text-red-500 transition-colors p-1"
                aria-label={`Remove deliverable ${idx + 1}`}
                data-testid={`remove-deliverable-${idx}`}
              >
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="p-4 rounded-xl border border-dashed border-neutral-200 text-center text-xs text-neutral-400">
          No deliverables added yet. At least one deliverable is required.
        </div>
      )}

      <FormDescription>
        Candidates must mark each deliverable as completed before submitting their assessment work.
      </FormDescription>
      {error && <FormError>{error}</FormError>}
    </FormField>
  );
}

