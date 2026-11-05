'use client';

import React from 'react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@hs/ui';
import {
  Layers,
  SlidersHorizontal,
  ChevronDown,
  Check,
  Code2,
  Server,
  Database,
  ShieldCheck,
  Sparkles,
  Zap,
  Flame,
} from 'lucide-react';
import type { TemplateCategory, TemplateDifficulty } from './types';
import { TEMPLATE_CATEGORIES, TEMPLATE_DIFFICULTIES } from '@/constants/template-categories';

export interface TemplateFiltersProps {
  selectedCategory: TemplateCategory | 'All';
  selectedDifficulty: TemplateDifficulty | 'All';
  onCategoryChange: (category: TemplateCategory | 'All') => void;
  onDifficultyChange: (difficulty: TemplateDifficulty | 'All') => void;
  categoryCounts?: Record<string, number>;
  className?: string;
  totalCount?: number;
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  All: Layers,
  'Full Stack': Code2,
  Backend: Server,
  Data: Database,
  QA: ShieldCheck,
  Product: Sparkles,
};

const DIFFICULTY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  All: SlidersHorizontal,
  Beginner: Sparkles,
  Intermediate: Zap,
  Advanced: Flame,
};

export function TemplateFilters({
  selectedCategory,
  selectedDifficulty,
  onCategoryChange,
  onDifficultyChange,
  categoryCounts = {},
  className = '',
}: TemplateFiltersProps): React.JSX.Element {
  const isDifficultyFiltered = selectedDifficulty !== 'All';
  const isCategoryFiltered = selectedCategory !== 'All';

  const SelectedCategoryIcon = CATEGORY_ICONS[selectedCategory] || Layers;

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      {/* ─── 1. Role Category Dropdown ─── */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className={`h-9 px-3 text-xs sm:text-sm font-medium rounded-md border transition-all flex items-center gap-2 shadow-2xs select-none ${
            isCategoryFiltered
              ? 'border-neutral-900 bg-neutral-900 text-white'
              : 'border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700'
          }`}
          aria-label="Filter by role category"
        >
          <SelectedCategoryIcon className={`w-4 h-4 shrink-0 ${isCategoryFiltered ? 'text-white' : 'text-neutral-400'}`} />
          <span>{selectedCategory === 'All' ? 'All Roles' : selectedCategory}</span>
          {categoryCounts[selectedCategory] !== undefined && (
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded-full font-semibold ${
                isCategoryFiltered
                  ? 'bg-white/20 text-white'
                  : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              {categoryCounts[selectedCategory]}
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 shrink-0 ${isCategoryFiltered ? 'text-white/80' : 'text-neutral-400'}`} />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="right" className="w-56 p-1.5 shadow-xl rounded-xl border border-neutral-200 bg-white">
          <DropdownMenuLabel className="px-2.5 py-1 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
            Role Categories
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="my-1" />

          {TEMPLATE_CATEGORIES.map((category) => {
            const isSelected = selectedCategory === category;
            const count = categoryCounts[category];
            const CatIcon = CATEGORY_ICONS[category] || Layers;

            return (
              <DropdownMenuItem
                key={category}
                data-testid={`filter-category-${category.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={() => onCategoryChange(category)}
                className={`py-1.5 px-2.5 text-xs sm:text-sm rounded-lg cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-neutral-100 font-semibold text-neutral-900'
                    : 'text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                <div className="flex items-center justify-between w-full gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-4 h-4 flex items-center justify-center shrink-0">
                      {isSelected ? (
                        <Check className="w-3.5 h-3.5 text-neutral-900" />
                      ) : (
                        <CatIcon className="w-3.5 h-3.5 text-neutral-400" />
                      )}
                    </span>
                    <span className={`truncate ${isSelected ? 'font-semibold text-neutral-900' : 'text-neutral-700'}`}>
                      {category}
                    </span>
                  </div>
                  {count !== undefined && (
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                        isSelected
                          ? 'bg-neutral-900 text-white'
                          : 'bg-neutral-100 text-neutral-500'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </div>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ─── 2. Difficulty / More Filters Dropdown ─── */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className={`h-9 px-3 text-xs sm:text-sm font-medium rounded-md border transition-all flex items-center gap-2 shadow-2xs select-none ${
            isDifficultyFiltered
              ? 'border-neutral-900 bg-neutral-900 text-white'
              : 'border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700'
          }`}
          aria-label="Filter by difficulty"
        >
          <SlidersHorizontal
            className={`w-4 h-4 shrink-0 ${isDifficultyFiltered ? 'text-white' : 'text-neutral-400'}`}
          />
          <span>{isDifficultyFiltered ? `Difficulty: ${selectedDifficulty}` : 'Filters'}</span>
          {isDifficultyFiltered && (
            <span className="w-4 h-4 rounded-full bg-white text-neutral-900 text-[10px] font-bold flex items-center justify-center">
              1
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 shrink-0 ${isDifficultyFiltered ? 'text-white/80' : 'text-neutral-400'}`}
          />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="right" className="w-52 p-1.5 shadow-xl rounded-xl border border-neutral-200 bg-white">
          <DropdownMenuLabel className="px-2.5 py-1 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
            Difficulty Level
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="my-1" />

          {TEMPLATE_DIFFICULTIES.map((diff) => {
            const isSelected = selectedDifficulty === diff;
            const DiffIcon = DIFFICULTY_ICONS[diff] || SlidersHorizontal;

            return (
              <DropdownMenuItem
                key={diff}
                data-testid={`filter-difficulty-${diff.toLowerCase()}`}
                onClick={() => onDifficultyChange(diff)}
                className={`py-1.5 px-2.5 text-xs sm:text-sm rounded-lg cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-neutral-100 font-semibold text-neutral-900'
                    : 'text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                <div className="flex items-center justify-between w-full gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-4 h-4 flex items-center justify-center shrink-0">
                      {isSelected ? (
                        <Check className="w-3.5 h-3.5 text-neutral-900" />
                      ) : (
                        <DiffIcon className="w-3.5 h-3.5 text-neutral-400" />
                      )}
                    </span>
                    <span className={`truncate ${isSelected ? 'font-semibold text-neutral-900' : 'text-neutral-700'}`}>
                      {diff === 'All' ? 'All Difficulties' : diff}
                    </span>
                  </div>
                </div>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
