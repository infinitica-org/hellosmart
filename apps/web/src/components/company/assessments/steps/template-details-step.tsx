'use client';

import React from 'react';
import Link from 'next/link';
import { Card, Badge, FormField, FormLabel, FormError, FormDescription, Input } from '@hs/ui';
import type { AssessmentFormValues } from '../types';
import type { RoleTemplateDetail, RoleTemplateSummary } from '@/components/company/templates/types';
import { DIFFICULTY_BADGE_CONFIG, WORKSPACE_MODE_CONFIG } from '@/constants/template-categories';

export interface TemplateDetailsStepProps {
  template: RoleTemplateDetail | RoleTemplateSummary;
  values: AssessmentFormValues;
  errors: Record<string, string>;
  onChange: (updates: Partial<AssessmentFormValues>) => void;
}

export function TemplateDetailsStep({
  template,
  values,
  errors,
  onChange,
}: TemplateDetailsStepProps): React.JSX.Element {
  const difficultyCfg = DIFFICULTY_BADGE_CONFIG[template.difficulty] || {
    variant: 'default',
    label: template.difficulty,
  };

  const modeCfg = WORKSPACE_MODE_CONFIG[template.workspaceMode] || {
    label: template.workspaceMode,
    badgeVariant: 'default',
  };

  return (
    <div className="space-y-8" data-testid="wizard-step-1">
      {/* ─── Selected Template Review Card ─── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-mono">
            Selected Blueprint (BR-03 Version Pinned)
          </span>
          <Link
            href="/company/templates"
            className="text-xs text-primary hover:underline font-medium"
          >
            Change Template
          </Link>
        </div>

        <Card className="p-5 sm:p-6 rounded-2xl border border-card-border bg-white shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 font-semibold">
                  {template.category}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 font-medium">
                  v{template.versionId}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-neutral-900">{template.name}</h3>
              <p className="mt-1 text-xs sm:text-sm text-neutral-600 line-clamp-2">
                {template.description}
              </p>
            </div>

            <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0">
              <Badge variant={modeCfg.badgeVariant} size="sm">
                {modeCfg.label}
              </Badge>
              <Badge variant={difficultyCfg.variant} size="sm" dot>
                {difficultyCfg.label}
              </Badge>
              <span className="text-xs text-neutral-500 font-medium font-mono">
                {template.durationMinutes} mins
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* ─── Assessment Metadata Inputs ─── */}
      <div className="space-y-6 bg-white p-6 sm:p-8 rounded-2xl border border-card-border shadow-xs">
        <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-500 font-mono">
          Assessment Information
        </h4>

        {/* Assessment Name */}
        <FormField>
          <FormLabel htmlFor="assessment-name" required>
            Assessment Name
          </FormLabel>
          <Input
            id="assessment-name"
            value={values.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="e.g. Senior Backend Engineer - Q4 Cohort"
            data-testid="assessment-name-input"
            className="h-11 rounded-xl text-sm border-neutral-200 focus:border-primary focus:ring-1 focus:ring-primary/20"
          />
          <FormDescription>
            The title shown to candidates and internal hiring reviewers.
          </FormDescription>
          {errors.name && <FormError>{errors.name}</FormError>}
        </FormField>

        {/* Requisition ID */}
        <FormField>
          <FormLabel htmlFor="requisition-id">Requisition / Job ID</FormLabel>
          <Input
            id="requisition-id"
            value={values.requisitionId || ''}
            onChange={(e) => onChange({ requisitionId: e.target.value })}
            placeholder="e.g. REQ-2026-881"
            data-testid="requisition-id-input"
            className="h-11 rounded-xl text-sm border-neutral-200 focus:border-primary focus:ring-1 focus:ring-primary/20"
          />
          <FormDescription>
            Optional identifier matching your internal ATS or tracking system.
          </FormDescription>
          {errors.requisitionId && <FormError>{errors.requisitionId}</FormError>}
        </FormField>
      </div>
    </div>
  );
}

