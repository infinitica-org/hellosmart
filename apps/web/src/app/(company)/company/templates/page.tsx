'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { PageHeader, Alert, EmptyState, Button } from '@hs/ui';
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
        badge={{ text: 'Private Templates (BR-02)', variant: 'info' }}
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
            description="Role simulation blueprints are assigned privately to your organization by HelloSmart (BR-02). Request blueprints for custom hiring scenarios."
            data-testid="org-templates-empty-state"
            action={{
              label: 'Request Custom Blueprints',
              href: 'mailto:support@hellosmart.ai?subject=Template%20Assignment%20Request',
            }}
          />
        </div>
      )}

      {/* Search & Filters Toolbar */}
      {(isLoading || templates.length > 0) && (
        <div className="space-y-4 bg-white p-5 sm:p-6 rounded-2xl border border-card-border shadow-xs">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <TemplateSearch value={searchQuery} onChange={setSearchQuery} />
            <div className="text-xs text-neutral-500 font-medium self-end sm:self-center">
              Showing <span className="font-semibold text-neutral-900">{filteredTemplates.length}</span>{' '}
              of {templates.length} blueprints
            </div>
          </div>

          <TemplateFilters
            selectedCategory={selectedCategory}
            selectedDifficulty={selectedDifficulty}
            onCategoryChange={handleCategoryChange}
            onDifficultyChange={setSelectedDifficulty}
            categoryCounts={categoryCounts}
          />
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
