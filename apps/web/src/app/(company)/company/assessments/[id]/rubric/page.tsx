'use client';

import React, { use, Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PageHeader, Alert, Skeleton, Card, Button } from '@hs/ui';
import { useAssessmentRubric } from '@/hooks/company/use-assessment-rubric';
import { useTemplateDetail } from '@/hooks/company/use-assigned-templates';
import { RubricEditor, DEFAULT_SCORING_ANCHORS, type RubricDimension } from '@/components/company/rubric';

interface RubricPageProps {
  params: Promise<{ id: string }>;
}

function RubricCustomizerContent({ id }: { id: string }): React.JSX.Element {
  const searchParams = useSearchParams();
  const templateId = searchParams.get('templateId') || 'tpl_default';
  const versionId = searchParams.get('versionId') || '1.0.0';

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
  } = useTemplateDetail(assessmentRubric ? null : templateId);

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

    // Standard fallback default dimensions totaling 100%
    return [
      {
        id: 'dim_tech_arch',
        name: 'Architecture & Technical Design',
        description: 'Evaluates architectural decisions, modularity, data modeling, and separation of concerns.',
        weight: 40,
        signals: ['Follows domain-driven boundaries', 'Avoids tight coupling', 'Clean interfaces'],
        redFlags: ['Spaghetti code', 'Hardcoded credentials', 'Lack of structure'],
        scoringAnchors: [...DEFAULT_SCORING_ANCHORS],
      },
      {
        id: 'dim_code_quality',
        name: 'Code Quality & Maintainability',
        description: 'Assesses readability, test coverage, static typing, and adherence to language idioms.',
        weight: 35,
        signals: ['Strong typing', 'Meaningful naming', 'Unit test coverage'],
        redFlags: ['Unhandled errors', 'Ignored lint warnings', 'Missing error boundaries'],
        scoringAnchors: [...DEFAULT_SCORING_ANCHORS],
      },
      {
        id: 'dim_problem_solving',
        name: 'Problem Solving & Edge-Case Handling',
        description: 'Analyzes analytical rigor, handling of unexpected inputs, and algorithmic efficiency.',
        weight: 25,
        signals: ['Handles empty states and boundaries', 'Efficient algorithms', 'Documented trade-offs'],
        redFlags: ['Infinite loops', 'Race conditions', 'Fragile logic'],
        scoringAnchors: [...DEFAULT_SCORING_ANCHORS],
      },
    ];
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
        templateId={templateId}
        templateVersionId={versionId}
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

