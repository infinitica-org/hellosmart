'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { PageHeader, Alert, EmptyState, Button } from '@hs/ui';
import { X } from 'lucide-react';
import { useAssignedTemplates } from '@/hooks/company/use-assigned-templates';
import {
  TemplateSearch,
  TemplateFilters,
  TemplateGrid,
  TemplatePreviewDrawer,
  type TemplateCategory,
  type TemplateDifficulty,
  type RoleTemplateSummary,
} from '@/components/company/templates';

function TemplateCatalogContent(): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // URL-driven state for filter and preview resilience
  const previewParam = searchParams.get('preview');
  const categoryParam = searchParams.get('category') as TemplateCategory | null;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'All'>(
    categoryParam || 'All'
  );
  const [selectedDifficulty, setSelectedDifficulty] = useState<TemplateDifficulty | 'All'>('All');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(previewParam || null);

  // Sync state if URL changes externally
  useEffect(() => {
    if (previewParam !== selectedTemplateId) {
      setSelectedTemplateId(previewParam || null);
    }
  }, [previewParam]);

  // Query templates assigned to caller's org
  const { data: templates = [], isLoading, isError, error, refetch } = useAssignedTemplates();

  // Synchronize preview in URL query params
  const handleSelectTemplate = (id: string | null) => {
    setSelectedTemplateId(id);
    const params = new URLSearchParams(searchParams.toString());

    if (id) {
      params.set('preview', id);
    } else {
      params.delete('preview');
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Synchronize category filter in URL query params
  const handleCategoryChange = (category: TemplateCategory | 'All') => {
    setSelectedCategory(category);
    const params = new URLSearchParams(searchParams.toString());

    if (category !== 'All') {
      params.set('category', category);
    } else {
      params.delete('category');
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Calculate category counts dynamically
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: templates.length };
    templates.forEach((t) => {
      counts[t.category] = (counts[t.category] || 0) + 1;
    });
    return counts;
  }, [templates]);

  // Filter templates by search keyword, category, and difficulty
  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      // Category filter
      if (selectedCategory !== 'All' && template.category !== selectedCategory) {
        return false;
      }

      // Difficulty filter
      if (selectedDifficulty !== 'All' && template.difficulty !== selectedDifficulty) {
        return false;
      }

      // Search query (matches title, description, or tags)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = template.name.toLowerCase().includes(q);
        const matchesCategory = template.category.toLowerCase().includes(q);
        const matchesDesc = template.description?.toLowerCase().includes(q);
        const matchesTags = template.tags?.some((tag) => tag.toLowerCase().includes(q));

        if (!matchesName && !matchesCategory && !matchesDesc && !matchesTags) {
          return false;
        }
      }

      return true;
    });
  }, [templates, selectedCategory, selectedDifficulty, searchQuery]);

  // Selected summary for drawer fallback preview
  const selectedSummary = useMemo(() => {
    return templates.find((t) => t.id === selectedTemplateId) || null;
  }, [templates, selectedTemplateId]);

  const isFiltered =
    selectedCategory !== 'All' || selectedDifficulty !== 'All' || searchQuery.trim().length > 0;

  const handleResetFilters = () => {
    setSearchQuery('');
    handleCategoryChange('All');
    setSelectedDifficulty('All');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Role Template Catalog"
        description="Browse and preview organization-assigned role simulation blueprints to create standardized candidate assessments."
        data-testid="templates-page-header"
      />

      {/* API Failure / Error State */}
      {isError && (
        <Alert variant="error" className="text-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 w-full">
            <div>
              <div className="font-semibold text-neutral-900">Failed to load templates</div>
              <p className="text-neutral-600 mt-0.5">
                {error?.message || 'Could not retrieve blueprints assigned to your organization.'}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="shrink-0 rounded-xl"
              data-testid="templates-error-retry-btn"
            >
              Retry
            </Button>
          </div>
        </Alert>
      )}

      {/* Organization Empty State (0 assigned templates) */}
      {!isLoading && !isError && templates.length === 0 && (
        <div className="bg-white rounded-2xl border border-neutral-200/80 p-8 sm:p-12">
          <EmptyState
            title="No templates assigned yet"
            description="Role simulation blueprints are assigned privately to your organization by HelloSmart. Request blueprints for custom hiring scenarios."
            data-testid="org-templates-empty-state"
            action={{
              label: 'Request Custom Blueprints',
              href: 'mailto:support@hellosmart.ai?subject=Template%20Assignment%20Request',
            }}
          />
        </div>
      )}

      {/* ─── Sleek Toolbar: Search (Left) + Dropdown Filters (Right) ─── */}
      {(isLoading || templates.length > 0) && (
        <div className="bg-white p-3.5 sm:px-4 sm:py-3 border border-neutral-200/80 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Left: Sleek Search Bar with Cmd+K */}
            <TemplateSearch value={searchQuery} onChange={setSearchQuery} />

            {/* Right: Modern Dropdown Buttons (Select Category + Filters) */}
            <TemplateFilters
              selectedCategory={selectedCategory}
              selectedDifficulty={selectedDifficulty}
              onCategoryChange={handleCategoryChange}
              onDifficultyChange={setSelectedDifficulty}
              categoryCounts={categoryCounts}
            />
          </div>

          {/* Active Filter Chips & Counter (Displayed if filtered) */}
          {isFiltered && (
            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-neutral-100 text-xs text-neutral-500">
              <span className="font-medium">Active:</span>

              {selectedCategory !== 'All' && (
                <button
                  type="button"
                  onClick={() => handleCategoryChange('All')}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-700 hover:bg-neutral-200/80 transition-colors font-medium"
                >
                  <span>Role: {selectedCategory}</span>
                  <X className="w-3 h-3 text-neutral-400 hover:text-neutral-700" />
                </button>
              )}

              {selectedDifficulty !== 'All' && (
                <button
                  type="button"
                  onClick={() => setSelectedDifficulty('All')}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-700 hover:bg-neutral-200/80 transition-colors font-medium"
                >
                  <span>Difficulty: {selectedDifficulty}</span>
                  <X className="w-3 h-3 text-neutral-400 hover:text-neutral-700" />
                </button>
              )}

              {searchQuery.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-700 hover:bg-neutral-200/80 transition-colors font-medium"
                >
                  <span>&ldquo;{searchQuery}&rdquo;</span>
                  <X className="w-3 h-3 text-neutral-400 hover:text-neutral-700" />
                </button>
              )}

              <button
                type="button"
                onClick={handleResetFilters}
                className="text-neutral-500 hover:text-neutral-900 underline font-medium ml-1 text-xs"
              >
                Clear all
              </button>

              <span className="ml-auto text-xs text-neutral-400 font-medium hidden sm:inline">
                Showing <span className="font-semibold text-neutral-800">{filteredTemplates.length}</span> of {templates.length} blueprints
              </span>
            </div>
          )}
        </div>
      )}

      {/* Template Cards Grid */}
      {(isLoading || templates.length > 0) && (
        <TemplateGrid
          templates={filteredTemplates}
          isLoading={isLoading}
          selectedTemplateId={selectedTemplateId}
          onPreview={(id) => handleSelectTemplate(id)}
          onResetFilters={handleResetFilters}
          isFiltered={isFiltered}
        />
      )}

      {/* Slide-Out Preview Drawer */}
      <TemplatePreviewDrawer
        templateId={selectedTemplateId}
        summary={selectedSummary}
        onClose={() => handleSelectTemplate(null)}
      />
    </div>
  );
}

export default function TemplatesPage(): React.JSX.Element {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-neutral-500">Loading catalog…</div>}>
      <TemplateCatalogContent />
    </Suspense>
  );
}
