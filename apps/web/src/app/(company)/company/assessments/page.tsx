'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  PageHeader,
  EmptyState,
  Card,
  Button,
  Input,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@hs/ui';
import { Plus, Search, ChevronDown, Check, X, Filter } from 'lucide-react';
import { UI_LABELS, ROUTES } from '@/constants';

const ASSESSMENT_STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'closed', label: 'Closed' },
  { value: 'archived', label: 'Archived' },
];

export default function CompanyAssessmentsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
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

  const currentStatusLabel =
    ASSESSMENT_STATUS_OPTIONS.find((opt) => opt.value === statusFilter)?.label || 'All Statuses';

  const isFiltered = searchQuery.trim().length > 0 || statusFilter !== 'all';

  return (
    <div className="space-y-6">
      {/* Page Header with Create Assessment Action (Never wrapping) */}
      <PageHeader
        title={UI_LABELS.PAGE_HEADERS.ASSESSMENT_HUB_TITLE}
        description={UI_LABELS.PAGE_HEADERS.ASSESSMENT_HUB_DESCRIPTION}
        badge={{ text: 'Templates & Rubrics', variant: 'info' }}
        actions={
          <Link href={ROUTES.COMPANY.TEMPLATES} className="shrink-0">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4 shrink-0" />}
              className="rounded-xl px-4 text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 shadow-sm inline-flex items-center"
              data-testid="create-assessment-header-btn"
            >
              Create Assessment
            </Button>
          </Link>
        }
      />

      {/* ─── Sleek Toolbar: Search (Left) + Status Filter (Right) ─── */}
      <div className="bg-white p-3.5 sm:px-4 sm:py-3 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Left: Search with Cmd+K */}
          <div className="relative w-full sm:w-72">
            <Input
              ref={inputRef}
              type="search"
              placeholder="Search assessments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-12 h-9 w-full text-xs sm:text-sm rounded-md border-neutral-200 bg-white placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900/10 transition-colors shadow-2xs"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400 z-10">
              <Search className="w-4 h-4 text-neutral-400" />
            </div>
            <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center z-10">
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    inputRef.current?.focus();
                  }}
                  className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                  aria-label="Clear search"
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

          {/* Right: Status Filter Dropdown */}
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                className={`h-9 px-3 text-xs sm:text-sm font-medium rounded-md border transition-all flex items-center gap-2 shadow-2xs select-none ${
                  statusFilter !== 'all'
                    ? 'border-neutral-900 bg-neutral-900 text-white'
                    : 'border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700'
                }`}
                aria-label="Filter by assessment status"
              >
                <Filter
                  className={`w-4 h-4 shrink-0 ${statusFilter !== 'all' ? 'text-white' : 'text-neutral-400'}`}
                />
                <span>{currentStatusLabel}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 shrink-0 ${statusFilter !== 'all' ? 'text-white/80' : 'text-neutral-400'}`}
                />
              </DropdownMenuTrigger>

              <DropdownMenuContent align="right" className="w-48 p-1.5 shadow-xl rounded-xl border border-neutral-200 bg-white">
                <DropdownMenuLabel className="px-2.5 py-1 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                  Assessment Status
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="my-1" />

                {ASSESSMENT_STATUS_OPTIONS.map((opt) => {
                  const isSelected = statusFilter === opt.value;

                  return (
                    <DropdownMenuItem
                      key={opt.value}
                      onClick={() => setStatusFilter(opt.value)}
                      className={`py-1.5 px-2.5 text-xs sm:text-sm rounded-lg cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-neutral-100 font-semibold text-neutral-900'
                          : 'text-neutral-700 hover:bg-neutral-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <span className="w-4 h-4 flex items-center justify-center shrink-0">
                          {isSelected && <Check className="w-3.5 h-3.5 text-neutral-900" />}
                        </span>
                        <span>{opt.label}</span>
                      </div>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Active Filters Display */}
        {isFiltered && (
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-neutral-100 text-xs text-neutral-500">
            <span className="font-medium">Active:</span>

            {statusFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-700 hover:bg-neutral-200/80 transition-colors font-medium"
              >
                <span>Status: {currentStatusLabel}</span>
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
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
              }}
              className="text-neutral-500 hover:text-neutral-900 underline font-medium ml-1 text-xs"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Main Assessment List Card with Card Header Title */}
      <Card className="p-6 sm:p-8 rounded-2xl border border-neutral-200/80 bg-white shadow-2xs">
        {/* Card Header Title */}
        <div className="pb-4 mb-6 border-b border-neutral-100">
          <h2 className="text-base sm:text-lg font-semibold text-neutral-900">
            Active Assessments
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Manage published role simulations, rubrics, and candidate evaluations.
          </p>
        </div>

        {/* Empty State */}
        <EmptyState
          title="No assessments published"
          description="Create and publish your first assessment from an assigned role template to start evaluating candidates in realistic work simulations."
          action={{
            label: 'Create Assessment',
            href: ROUTES.COMPANY.TEMPLATES,
          }}
        />
      </Card>
    </div>
  );
}
