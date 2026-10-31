'use client';

import React from 'react';
import type { TemplateCategory, TemplateDifficulty } from './types';
import { TEMPLATE_CATEGORIES, TEMPLATE_DIFFICULTIES } from '@/constants/template-categories';

export interface TemplateFiltersProps {
  selectedCategory: TemplateCategory | 'All';
  selectedDifficulty: TemplateDifficulty | 'All';
  onCategoryChange: (category: TemplateCategory | 'All') => void;
  onDifficultyChange: (difficulty: TemplateDifficulty | 'All') => void;
  categoryCounts?: Record<string, number>;
  className?: string;
}

export function TemplateFilters({
  selectedCategory,
  selectedDifficulty,
  onCategoryChange,
  onDifficultyChange,
  categoryCounts = {},
  className = '',
}: TemplateFiltersProps): React.JSX.Element {
  return (
    <div className={`space-y-3 ${className}`}>
      {/* Category Pills */}
      <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Role categories">
        {TEMPLATE_CATEGORIES.map((category) => {
          const isActive = selectedCategory === category;
          const count = categoryCounts[category];

          return (
            <button
              key={category}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-testid={`filter-category-${category.toLowerCase().replace(/\s+/g, '-')}`}
              onClick={() => onCategoryChange(category)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                isActive
                  ? 'bg-neutral-900 text-white shadow-sm'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200/80 hover:text-neutral-900'
              }`}
            >
              <span>{category}</span>
              {count !== undefined && count > 0 && (
                <span
                  className={`ml-1.5 text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-700'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Difficulty Filter Chips */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-neutral-100/80">
        <span className="text-xs font-medium text-neutral-500 mr-1">Difficulty:</span>
        {TEMPLATE_DIFFICULTIES.map((diff) => {
          const isActive = selectedDifficulty === diff;

          return (
            <button
              key={diff}
              type="button"
              data-testid={`filter-difficulty-${diff.toLowerCase()}`}
              onClick={() => onDifficultyChange(diff)}
              className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary font-semibold border border-primary/30'
                  : 'text-neutral-600 hover:text-neutral-900 border border-transparent'
              }`}
            >
              {diff}
            </button>
          );
        })}
      </div>
    </div>
  );
}

