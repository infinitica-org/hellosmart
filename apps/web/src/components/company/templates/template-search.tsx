'use client';

import React, { useRef, useEffect } from 'react';
import { Input } from '@hs/ui';
import { Search, X } from 'lucide-react';
import { PLACEHOLDERS } from '@/constants';

export interface TemplateSearchProps {
  value: string;
  onChange: (query: string) => void;
  className?: string;
  placeholder?: string;
}

export function TemplateSearch({
  value,
  onChange,
  className = '',
  placeholder = PLACEHOLDERS.SEARCH.TEMPLATES || 'Search templates...',
}: TemplateSearchProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: Cmd+K / Ctrl+K to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className={`relative w-full sm:w-72 ${className}`}>
      {/* Search Input */}
      <Input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Search templates"
        data-testid="template-search-input"
        className="pl-9 pr-12 h-9 w-full text-xs sm:text-sm rounded-md border-neutral-200 bg-white placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900/10 transition-colors shadow-2xs"
      />

      {/* Search Icon (Rendered AFTER Input with z-10 so it is always visible on top) */}
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400 z-10">
        <Search className="w-4 h-4 text-neutral-400" />
      </div>

      {/* Right Accessory: Cmd+K or Clear Button (z-10) */}
      <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center z-10">
        {value ? (
          <button
            type="button"
            onClick={() => {
              onChange('');
              inputRef.current?.focus();
            }}
            className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
            aria-label="Clear search input"
            data-testid="template-search-clear-btn"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-sans font-medium text-neutral-400 bg-neutral-100/80 border border-neutral-200/80 rounded pointer-events-none select-none">
            ⌘K
          </kbd>
        )}
      </div>
    </div>
  );
}
