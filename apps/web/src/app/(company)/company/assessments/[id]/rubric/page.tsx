'use client';

import React, { use, Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PageHeader, Alert, Skeleton, Card, Button } from '@hs/ui';
import { useAssessmentRubric } from '@/hooks/company/use-assessment-rubric';
import { useTemplateDetail } from '@/hooks/company/use-assigned-templates';
import { useGetAssessmentByIdQuery } from '@/store/company/companyApi';
import { RubricEditor, DEFAULT_SCORING_ANCHORS, type RubricDimension } from '@/components/company/rubric';

interface RubricPageProps {
  params: Promise<{ id: string }>;
}

function RubricCustomizerContent({ id }: { id: string }): React.JSX.Element {
  const searchParams = useSearchParams();
  const routeTemplateId = searchParams.get('templateId');
  const routeVersionId = searchParams.get('versionId');

  // Query assessment to resolve pinned template and version if not present in search params
  const { data: assessment } = useGetAssessmentByIdQuery(id);
  const templateId = routeTemplateId || assessment?.templateId || null;
  const versionId = routeVersionId || assessment?.templateVersionId || null;

  // 1. Fetch assessment-specific rubric
  const {
    data: assessmentRubric,
    isLoading: isRubricLoading,
    isError: isRubricError,
  } = useAssessmentRubric(id);

  // 2. Fetch template specification as default fallback if rubric not yet customized
  const {
    data: templateDetail,
    isLoading: isTemplateLoading,
  } = useTemplateDetail(assessmentRubric?.dimensions?.length ? null : templateId);

  // Convert template rubric dimensions to RubricDimension format if fallback needed
  const initialDimensions: RubricDimension[] = useMemo(() => {
    if (assessmentRubric?.dimensions && assessmentRubric.dimensions.length > 0) {
      return assessmentRubric.dimensions;
    }

    if (templateDetail?.rubric && templateDetail.rubric.length > 0) {
      return templateDetail.rubric.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.goal,
        weight: r.weight,
        signals: r.signals || [],
        redFlags: [],
        scoringAnchors: [...DEFAULT_SCORING_ANCHORS],
      }));
    }

    // Default to empty array if no rubric defined yet (no hardcoded mock dimensions)
    return [];
  }, [assessmentRubric, templateDetail]);

  const isLoading = isRubricLoading || (!assessmentRubric && isTemplateLoading);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto" data-testid="rubric-page-loading">
        <PageHeader
          title="Assessment Rubric Customizer"
          description="Loading scoring dimensions and AI evaluator criteria…"
        />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Customize Assessment Rubric"
          description="Configure scoring dimensions, adjust weights, and define red flags for independent AI reviewer agents (BR-18)."
          badge={{ text: '100% Weight Invariant', variant: 'info' }}
          data-testid="rubric-page-header"
        />

        <Link href={`/company/assessments`}>
          <Button variant="outline" size="sm" className="rounded-xl border-neutral-300">
            ← Back to Assessments
          </Button>
        </Link>
      </div>

      {isRubricError && (
        <Alert variant="info" className="text-xs">
          Notice: No customized rubric found for this assessment yet. Loaded default dimensions from template blueprint v{versionId}.
        </Alert>
      )}

      {/* Main Rubric Editor Component */}
      <RubricEditor
        assessmentId={id}
        templateId={templateId || ''}
        templateVersionId={versionId || ''}
        initialDimensions={initialDimensions}
      />
    </div>
  );
}

export default function AssessmentRubricPage({ params }: RubricPageProps): React.JSX.Element {
  const resolvedParams = use(params);

  return (
    <Suspense fallback={<div className="p-8 text-sm text-neutral-500">Loading rubric…</div>}>
      <RubricCustomizerContent id={resolvedParams.id} />
    </Suspense>
  );
}

