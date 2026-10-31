'use client';

import React, { useRef, useEffect } from 'react';
import {
  Input,
  TextureButton,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@hs/ui';
import { Search, Plus, Upload, Users, ChevronDown, Check, X } from 'lucide-react';
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

  const currentLabel =
    statusOptions.find((opt) => opt.value === status)?.label || UI_LABELS.STATUS.ALL_CANDIDATES;

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
      {/* Search Input with Cmd+K */}
      <div className="relative w-full sm:w-72">
        <Input
          ref={inputRef}
          type="search"
          placeholder={PLACEHOLDERS.SEARCH.CANDIDATES}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          disabled={disabled}
          className="pl-9 pr-12 h-9 w-full text-xs sm:text-sm rounded-md border-neutral-200 bg-white placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900/10 transition-colors shadow-2xs"
        />

        {/* Search Icon (Rendered AFTER Input with z-10) */}
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400 z-10">
          <Search className="w-4 h-4 text-neutral-400" />
        </div>

        {/* Cmd+K or Clear Button (z-10) */}
        <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center z-10">
          {search ? (
            <button
              type="button"
              onClick={() => {
                onSearchChange('');
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

      {/* Filter Dropdown & Action Buttons */}
      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
        {/* Status Dropdown Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={disabled}
            className={`h-9 px-3 text-xs sm:text-sm font-medium rounded-md border transition-all flex items-center gap-2 shadow-2xs select-none ${
              status !== 'all'
                ? 'border-neutral-900 bg-neutral-900 text-white'
                : 'border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700'
            }`}
            aria-label="Filter by candidate status"
          >
            <Users
              className={`w-4 h-4 shrink-0 ${status !== 'all' ? 'text-white' : 'text-neutral-400'}`}
            />
            <span>{currentLabel}</span>
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

        {/* Action Buttons */}
        <TextureButton
          variant="secondary"
          size="sm"
          onClick={onOpenBulkUpload}
          disabled={disabled}
          className="flex items-center gap-1.5 text-xs whitespace-nowrap"
        >
          <Upload className="h-3.5 w-3.5 shrink-0" />
          <span>{UI_LABELS.BUTTONS.BULK_UPLOAD}</span>
        </TextureButton>

        <TextureButton
          variant="primary"
          size="sm"
          onClick={onOpenInvite}
          disabled={disabled}
          className="flex items-center gap-1.5 text-xs whitespace-nowrap"
        >
          <Plus className="h-3.5 w-3.5 shrink-0" />
          <span>{UI_LABELS.BUTTONS.INVITE_CANDIDATE}</span>
        </TextureButton>
      </div>
    </div>
  );
}
