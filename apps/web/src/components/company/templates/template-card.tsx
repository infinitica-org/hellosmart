'use client';

import React from 'react';
import { Card, Badge, Button } from '@hs/ui';
import type { RoleTemplateSummary } from './types';
import { DIFFICULTY_BADGE_CONFIG, WORKSPACE_MODE_CONFIG } from '@/constants/template-categories';

export interface TemplateCardProps {
  template: RoleTemplateSummary;
  isSelected?: boolean;
  onPreview: (templateId: string) => void;
}

export function TemplateCard({
  template,
  isSelected = false,
  onPreview,
}: TemplateCardProps): React.JSX.Element {
  const difficultyCfg = DIFFICULTY_BADGE_CONFIG[template.difficulty] || {
    variant: 'default',
    label: template.difficulty,
  };

  const modeCfg = WORKSPACE_MODE_CONFIG[template.workspaceMode] || {
    label: template.workspaceMode,
    badgeVariant: 'default',
  };

  return (
    <Card
      data-testid={`template-card-${template.id}`}
      className={`group relative flex flex-col justify-between rounded-2xl p-5 sm:p-6 transition-all duration-200 border bg-white cursor-pointer ${
        isSelected
          ? 'border-primary ring-2 ring-primary/20 shadow-md'
          : 'border-card-border hover:border-primary/40 hover:shadow-sm'
      }`}
      onClick={() => onPreview(template.id)}
    >
      <div>
        {/* Top Badges: Category, Difficulty, Workspace Mode */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <span className="text-[11px] font-semibold tracking-wider uppercase text-neutral-500 font-mono">
            {template.category}
          </span>
          <div className="flex items-center gap-1.5">
            <Badge variant={modeCfg.badgeVariant} size="sm">
              {modeCfg.label}
            </Badge>
            <Badge variant={difficultyCfg.variant} size="sm" dot>
              {difficultyCfg.label}
            </Badge>
          </div>
        </div>

        {/* Template Title */}
        <h3 className="text-base sm:text-lg font-semibold text-neutral-900 group-hover:text-primary transition-colors line-clamp-1">
          {template.name}
        </h3>

        {/* Scenario / Description */}
        <p className="mt-2 text-xs sm:text-sm text-neutral-600 line-clamp-2 leading-relaxed">
          {template.description}
        </p>

        {/* Skill Tags */}
        {template.tags && template.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {template.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-neutral-100 text-neutral-700"
              >
                {tag}
              </span>
            ))}
            {template.tags.length > 4 && (
              <span className="text-[11px] font-mono text-neutral-400 self-center">
                +{template.tags.length - 4}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer: Duration & Preview Action */}
      <div className="mt-6 pt-4 border-t border-neutral-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs text-neutral-500 font-medium">
          <svg
            className="w-4 h-4 text-neutral-400 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>{template.durationMinutes} mins</span>
        </div>

        <Button
          variant="outline"
          size="sm"
          data-testid={`preview-template-btn-${template.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onPreview(template.id);
          }}
          className="text-xs h-8 px-3 rounded-lg border-neutral-200 hover:border-primary hover:text-primary"
        >
          Preview Template
        </Button>
      </div>
    </Card>
  );
}

