'use client';

import React from 'react';
import { Card, Badge, Alert } from '@hs/ui';
import type { AssessmentFormValues } from './types';
import type { RoleTemplateDetail, RoleTemplateSummary } from '@/components/company/templates/types';

export interface AssessmentSummaryProps {
  template: RoleTemplateDetail | RoleTemplateSummary;
  values: AssessmentFormValues;
}

export function AssessmentSummary({
  template,
  values,
}: AssessmentSummaryProps): React.JSX.Element {
  const isDetail = (t: RoleTemplateDetail | RoleTemplateSummary): t is RoleTemplateDetail => {
    return 'rubric' in t;
  };

  return (
    <Card
      data-testid="assessment-summary-card"
      className="p-6 rounded-2xl border border-card-border bg-white shadow-xs space-y-6"
    >
      <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
        <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-600 font-mono">
          Final Assessment Configuration Summary
        </h4>
        <Badge variant="primary" size="sm">
          Status: Draft
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        {/* Template & Version */}
        <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-100">
          <span className="text-neutral-500 block mb-1">Blueprint &amp; Version</span>
          <div className="font-semibold text-neutral-900">{template.name}</div>
          <div className="text-[11px] font-mono text-neutral-500 mt-0.5">
            Version: v{template.versionId} (Pinned BR-03)
          </div>
        </div>

        {/* Assessment Name & Requisition */}
        <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-100">
          <span className="text-neutral-500 block mb-1">Assessment Cohort</span>
          <div className="font-semibold text-neutral-900">{values.name}</div>
          <div className="text-[11px] font-mono text-neutral-500 mt-0.5">
            Req ID: {values.requisitionId || 'None specified'}
          </div>
        </div>

        {/* Timing Window */}
        <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-100">
          <span className="text-neutral-500 block mb-1">Timing &amp; Duration</span>
          <div className="font-semibold text-neutral-900">
            {values.timing.durationMinutes} Minutes Allocation
          </div>
          <div className="text-[11px] text-neutral-500 mt-0.5">
            Type: {values.timing.type.toUpperCase()} • Pause on disconnect:{' '}
            {values.timing.pauseTimerOnDisconnect ? 'Yes' : 'No (Default BR-09)'}
          </div>
        </div>

        {/* Deliverables Count */}
        <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-100">
          <span className="text-neutral-500 block mb-1">Required Deliverables</span>
          <div className="font-semibold text-neutral-900">
            {values.deliverables.length} Deliverable Item{values.deliverables.length === 1 ? '' : 's'}
          </div>
          <div className="text-[11px] text-neutral-500 mt-0.5">
            Candidate Checklist Enforced
          </div>
        </div>
      </div>

      {/* Inherited Rubric & AI Defaults from Blueprint */}
      {isDetail(template) && template.rubric && template.rubric.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-neutral-100">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-neutral-500 font-semibold uppercase">
              Inherited Rubric Dimensions (AI Reviewers)
            </span>
            <span className="text-primary font-semibold">
              Total Weight: {template.rubric.reduce((sum, r) => sum + r.weight, 0)}%
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {template.rubric.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-50 border border-neutral-200/80 text-xs"
              >
                <span className="font-medium text-neutral-800 truncate pr-2">{r.name}</span>
                <span className="font-mono text-neutral-500 shrink-0">{r.weight}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Alert variant="info" className="text-xs">
        Assessments are saved as Drafts. Once finalized, you can test a candidate dry-run and publish invitations.
      </Alert>
    </Card>
  );
}

