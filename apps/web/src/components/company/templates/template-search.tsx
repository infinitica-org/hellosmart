'use client';

import React from 'react';
import { Input } from '@hs/ui';

export interface TemplateSearchProps {
  value: string;
  onChange: (query: string) => void;
  className?: string;
}

export function TemplateSearch({
  value,
  onChange,
  className = '',
}: TemplateSearchProps): React.JSX.Element {
  return (
    <div className={`relative w-full max-w-md ${className}`}>
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>

      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search templates by role, title, or skill..."
        aria-label="Search role simulation templates"
        data-testid="template-search-input"
        className="pl-9 pr-8 h-10 w-full text-sm rounded-xl border-neutral-200 focus:border-primary focus:ring-1 focus:ring-primary/20 bg-white"
      />

      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-700 transition-colors"
          aria-label="Clear search input"
          data-testid="template-search-clear-btn"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}

