'use client';

import React from 'react';
import { SearchInput } from '@hs/ui';
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
  return (
    <div className={`w-full sm:w-72 ${className}`}>
      <SearchInput
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClear={() => onChange('')}
        placeholder={placeholder}
        size="md"
        rounded="md"
        aria-label="Search templates"
        data-testid="template-search-input"
      />
    </div>
  );
}
