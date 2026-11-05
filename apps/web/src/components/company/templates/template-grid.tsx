'use client';

import React from 'react';
import { Card, Button, Skeleton } from '@hs/ui';
import { Search } from 'lucide-react';
import { TemplateCard } from './template-card';
import type { RoleTemplateSummary } from './types';

export interface TemplateGridProps {
  templates: RoleTemplateSummary[];
  isLoading?: boolean;
  selectedTemplateId?: string | null;
  onPreview: (templateId: string) => void;
  onResetFilters?: () => void;
  isFiltered?: boolean;
}

export function TemplateGrid({
  templates,
  isLoading = false,
  selectedTemplateId,
  onPreview,
  onResetFilters,
  isFiltered = false,
}: TemplateGridProps): React.JSX.Element {
  // Skeleton Loader (6 cards)
  if (isLoading) {
    return (
      <div
        data-testid="template-grid-loading"
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="p-6 rounded-2xl border border-neutral-200/80 space-y-4">
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-20 rounded" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16 rounded" />
                <Skeleton className="h-5 w-16 rounded" />
              </div>
            </div>
            <Skeleton className="h-6 w-3/4 rounded" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-5/6 rounded" />
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-5 w-12 rounded" />
              <Skeleton className="h-5 w-16 rounded" />
              <Skeleton className="h-5 w-14 rounded" />
            </div>
            <div className="pt-4 border-t border-neutral-100 flex justify-between items-center">
              <Skeleton className="h-4 w-16 rounded" />
              <Skeleton className="h-8 w-28 rounded-lg" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  // Empty Filter Results State
  if (templates.length === 0) {
    return (
      <div
        data-testid="template-grid-empty"
        className="flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-white rounded-2xl border border-neutral-200/80 my-4"
      >
        <div className="w-12 h-12 rounded-2xl bg-neutral-100 text-neutral-400 flex items-center justify-center mb-3">
          <Search className="w-6 h-6 text-neutral-400" />
        </div>
        <h4 className="text-base font-semibold text-neutral-900">No matching templates</h4>
        <p className="mt-1 text-xs text-neutral-500 max-w-sm">
          {isFiltered
            ? 'No role simulation blueprints match your search keyword or selected category.'
            : 'No templates have been assigned to your organization yet.'}
        </p>

        {isFiltered && onResetFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={onResetFilters}
            data-testid="template-reset-filters-btn"
            className="mt-4 text-xs h-9 px-4 rounded-xl border-neutral-200 hover:border-primary hover:text-primary"
          >
            Clear All Filters
          </Button>
        )}
      </div>
    );
  }

  // Populated Grid
  return (
    <div
      data-testid="template-grid"
      className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6"
    >
      {templates.map((template) => (
        <TemplateCard
          key={template.id}
          template={template}
          isSelected={selectedTemplateId === template.id}
          onPreview={onPreview}
        />
      ))}
    </div>
  );
}

