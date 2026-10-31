'use client';

import React from 'react';
import { Input, Button, TextureButton, Search, Plus, Upload } from '@hs/ui';
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
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Search and Status Filters */}
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Input
            type="search"
            placeholder={PLACEHOLDERS.SEARCH.CANDIDATES}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            disabled={disabled}
            className="pl-9 text-sm"
          />
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-400">
            <Search className="h-4 w-4" />
          </div>
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-1 dark:border-neutral-800 dark:bg-neutral-900">
          {statusOptions.map((opt) => {
            const isActive = status === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onStatusChange(opt.value)}
                disabled={disabled}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-100'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <TextureButton
          variant="secondary"
          size="sm"
          onClick={onOpenBulkUpload}
          disabled={disabled}
          className="flex items-center gap-2 text-xs"
        >
          <Upload className="h-3.5 w-3.5" />
          <span>{UI_LABELS.BUTTONS.BULK_UPLOAD}</span>
        </TextureButton>

        <Button
          variant="primary"
          size="sm"
          onClick={onOpenInvite}
          disabled={disabled}
          className="flex items-center gap-2 text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{UI_LABELS.BUTTONS.INVITE_CANDIDATE}</span>
        </Button>
      </div>
    </div>
  );
}
