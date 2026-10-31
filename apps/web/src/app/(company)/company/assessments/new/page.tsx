'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PageHeader, Alert, Button, Skeleton, Card } from '@hs/ui';
import { useTemplateDetail } from '@/hooks/company/use-assigned-templates';
import { CreationWizard } from '@/components/company/assessments';

function NewAssessmentContent(): React.JSX.Element {
  const searchParams = useSearchParams();
  const templateId = searchParams.get('templateId');
  const versionId = searchParams.get('versionId');

  // Query full template specification
  const { data: template, isLoading, isError, error } = useTemplateDetail(templateId);

  // Missing Template / Version ID
  if (!templateId || !versionId) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto" data-testid="wizard-missing-template">
        <PageHeader
          title="Create New Assessment"
          description="Assessments are created by selecting an assigned role simulation blueprint (BR-02, BR-03)."
        />

        <Card className="p-8 sm:p-12 text-center rounded-2xl border border-neutral-200/80 bg-white space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <h3 className="text-lg font-bold text-neutral-900">No Blueprint Selected</h3>
          <p className="text-sm text-neutral-600 max-w-md mx-auto">
            To create an assessment, please select an approved engineering role template from your organization&apos;s catalog.
          </p>

          <div className="pt-2">
            <Link href="/company/templates">
              <Button variant="primary" size="md" className="rounded-xl px-5">
                Browse Template Catalog →
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  // Loading State
  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto" data-testid="wizard-loading-skeleton">
        <PageHeader
          title="Create New Assessment"
          description="Loading template blueprint and rubric specifications…"
        />
        <div className="space-y-4">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  // Error / Unauthorized / 404 State
  if (isError || !template) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto" data-testid="wizard-error-state">
        <PageHeader
          title="Create New Assessment"
          description="Configure your assessment blueprint."
        />

        <Alert variant="error" className="text-sm">
          <div className="space-y-2">
            <div className="font-semibold text-neutral-900">Blueprint Unavailable</div>
            <p className="text-neutral-600">
              {error?.message ||
                'The selected template is not assigned to your organization or the version was archived (BR-02).'}
            </p>
            <div className="pt-2">
              <Link href="/company/templates">
                <Button variant="outline" size="sm" className="rounded-xl border-neutral-300">
                  ← Return to Template Catalog
                </Button>
              </Link>
            </div>
          </div>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Assessment Blueprint"
        description="Configure candidates instructions, deliverables, and timing window based on your assigned template."
        badge={{ text: `Version v${versionId} Pinned`, variant: 'info' }}
        data-testid="wizard-header"
      />

      {/* Version Discrepancy Warning if Detail differs from URL */}
      {template.versionId !== versionId && (
        <Alert variant="warning" className="text-xs">
          Notice: Pinned version is <span className="font-mono font-semibold">{versionId}</span>, but the latest blueprint specification returned is <span className="font-mono font-semibold">{template.versionId}</span>. Preserving {versionId} for evaluation consistency.
        </Alert>
      )}

      {/* 3-Step Wizard Container */}
      <CreationWizard template={template} />
    </div>
  );
}

export default function NewAssessmentPage(): React.JSX.Element {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-neutral-500">Loading wizard…</div>}>
      <NewAssessmentContent />
    </Suspense>
  );
}

