'use client';

import React from 'react';
import { Card, Badge, Button } from '@hs/ui';
import {
  Clock,
  ArrowRight,
  Code2,
  Server,
  Database,
  ShieldCheck,
  Sparkles,
  Terminal,
  Bot,
} from 'lucide-react';
import type { RoleTemplateSummary } from './types';
import { DIFFICULTY_BADGE_CONFIG, WORKSPACE_MODE_CONFIG } from '@/constants/template-categories';

export interface TemplateCardProps {
  template: RoleTemplateSummary;
  isSelected?: boolean;
  onPreview: (templateId: string) => void;
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'Full Stack': Code2,
  Backend: Server,
  Data: Database,
  QA: ShieldCheck,
  Product: Sparkles,
};

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

  const CategoryIcon = CATEGORY_ICONS[template.category] || Code2;

  return (
    <Card
      data-testid={`template-card-${template.id}`}
      className={`group relative flex flex-col justify-between rounded-2xl p-5 sm:p-6 transition-all duration-200 border bg-white cursor-pointer hover:shadow-md hover:border-neutral-300 ${
        isSelected
          ? 'border-primary ring-2 ring-primary/20 shadow-md'
          : 'border-neutral-200/80 shadow-2xs'
      }`}
      onClick={() => onPreview(template.id)}
    >
      <div>
        {/* Top Header: Category with Icon & Status Badges */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase text-neutral-500">
            <CategoryIcon className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            <span>{template.category}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {modeCfg && (
              <Badge variant={modeCfg.badgeVariant} size="sm">
                <span className="inline-flex items-center gap-1">
                  {template.workspaceMode === 'cloud' ? (
                    <Terminal className="w-3 h-3" />
                  ) : (
                    <Bot className="w-3 h-3" />
                  )}
                  <span>{modeCfg.label}</span>
                </span>
              </Badge>
            )}
            {difficultyCfg && (
              <Badge variant={difficultyCfg.variant} size="sm" dot>
                {difficultyCfg.label}
              </Badge>
            )}
          </div>
        </div>

        {/* Template Title (Readable 2-line wrap instead of aggressive ellipsis truncation) */}
        <h3 className="text-base sm:text-lg font-medium text-neutral-900 group-hover:text-primary transition-colors line-clamp-2 min-h-[3rem] leading-snug">
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
                className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md bg-neutral-50 text-neutral-600 border border-neutral-200/70"
              >
                {tag}
              </span>
            ))}
            {template.tags.length > 4 && (
              <span className="text-xs text-neutral-400 self-center">
                +{template.tags.length - 4}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer: Duration & Preview Action */}
      <div className="mt-6 pt-4 border-t border-neutral-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs text-neutral-500 font-medium">
          <Clock className="w-4 h-4 text-neutral-400 shrink-0" />
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
          rightIcon={
            <ArrowRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-700 transition-transform group-hover:translate-x-0.5 shrink-0" />
          }
          className="text-xs h-8 px-3 rounded-lg border-neutral-200 group-hover:border-neutral-300 group-hover:bg-neutral-50 whitespace-nowrap shrink-0 inline-flex items-center"
        >
          Preview
        </Button>
      </div>
    </Card>
  );
}
