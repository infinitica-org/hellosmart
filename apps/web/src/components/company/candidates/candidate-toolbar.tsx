'use client';

import React, { useEffect } from 'react';
import {
  SearchInput,
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@hs/ui';
import { Plus, Upload, Users, ChevronDown, Check } from 'lucide-react';
import { PLACEHOLDERS, UI_LABELS } from '@/constants';
import type { CandidateStatus } from './types';

export interface CandidateToolbarProps {
  search: string;
  onSearchChange: (val: string) => void;
  status: CandidateStatus | 'all';
  onStatusChange: (status: CandidateStatus | 'all') => void;
  onOpenInvite: () => void;
  onOpenBulkUpload: () => void;
  disabled?: boolean;
}

const statusOptions: Array<{ value: CandidateStatus | 'all'; label: string }> = [
  { value: 'all', label: UI_LABELS.STATUS.ALL_CANDIDATES },
  { value: 'invited', label: UI_LABELS.STATUS.INVITED },
  { value: 'active', label: UI_LABELS.STATUS.ACTIVE },
];

export function CandidateToolbar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  onOpenInvite,
  onOpenBulkUpload,
  disabled = false,
}: CandidateToolbarProps) {
  const [localSearch, setLocalSearch] = React.useState(search);

  // Sync external search prop if reset externally
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  // Debounce search update to parent
  useEffect(() => {
    if (localSearch === search) return;
    const timer = setTimeout(() => {
      onSearchChange(localSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, onSearchChange, search]);

  const currentLabel =
    statusOptions.find((opt) => opt.value === status)?.label || UI_LABELS.STATUS.ALL_CANDIDATES;

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
      {/* Search Input with Cmd+K */}
      <div className="w-full sm:w-72">
        <SearchInput
          placeholder={PLACEHOLDERS.SEARCH.CANDIDATES}
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          onClear={() => {
            setLocalSearch('');
            onSearchChange('');
          }}
          disabled={disabled}
          size="md"
          rounded="md"
          aria-label="Search candidates"
          data-testid="candidate-search-input"
        />
      </div>

      {/* Filter Dropdown & Action Buttons */}
      <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
        {/* Status Dropdown Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={disabled}
            className={`h-10 px-4 text-xs sm:text-sm font-medium rounded-md border transition-all inline-flex items-center gap-2 shadow-2xs select-none shrink-0 ${
              status !== 'all'
                ? 'border-neutral-900 bg-neutral-900 text-white'
                : 'border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700'
            }`}
            aria-label="Filter by candidate status"
          >
            <Users
              className={`w-4 h-4 shrink-0 ${status !== 'all' ? 'text-white' : 'text-neutral-400'}`}
            />
            <span className="whitespace-nowrap">{currentLabel}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 shrink-0 ${status !== 'all' ? 'text-white/80' : 'text-neutral-400'}`}
            />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="right" className="w-48 p-1.5 shadow-xl rounded-xl border border-neutral-200 bg-white">
            <DropdownMenuLabel className="px-2.5 py-1 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
              Status Filter
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="my-1" />

            {statusOptions.map((opt) => {
              const isSelected = status === opt.value;

              return (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => onStatusChange(opt.value)}
                  rightSlot={isSelected ? <Check className="w-4 h-4 text-neutral-900 shrink-0" /> : undefined}
                  className={`text-xs py-2 px-2.5 rounded-lg cursor-pointer ${
                    isSelected ? 'font-semibold text-neutral-900 bg-neutral-100' : 'text-neutral-700'
                  }`}
                >
                  {opt.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Bulk Upload Button */}
        <Button
          variant="secondary"
          size="md"
          leftIcon={<Upload className="w-4 h-4 shrink-0" />}
          onClick={onOpenBulkUpload}
          disabled={disabled}
          className="h-10 px-4 text-xs sm:text-sm font-medium rounded-md whitespace-nowrap shrink-0 shadow-2xs"
        >
          Bulk Upload
        </Button>

        {/* Invite Candidate Button */}
        <Button
          variant="primary"
          size="md"
          leftIcon={<Plus className="w-4 h-4 shrink-0" />}
          onClick={onOpenInvite}
          disabled={disabled}
          className="h-10 px-4 text-xs sm:text-sm font-medium rounded-md whitespace-nowrap shrink-0 shadow-2xs"
        >
          Invite Candidate
        </Button>
      </div>
    </div>
  );
}
