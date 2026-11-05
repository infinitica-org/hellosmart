'use client';

import React, { use } from 'react';
import Link from 'next/link';
import {
  PageHeader,
  Card,
  Button,
  Badge,
  Skeleton,
  AssessmentStatusBadge,
  Alert,
} from '@hs/ui';
import {
  ArrowLeft,
  Sliders,
  Clock,
  Laptop,
  MessageSquare,
  Users,
  CheckCircle2,
  Cpu,
  FileText,
  Shield,
  Layers,
} from 'lucide-react';
import { ROUTES } from '@/constants';
import { useGetAssessmentByIdQuery } from '@/store/company/companyApi';

interface AssessmentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function CompanyAssessmentDetailPage({ params }: AssessmentDetailPageProps) {
  const { id } = use(params);
  const { data: assessment, isLoading, isError, error, refetch } = useGetAssessmentByIdQuery(id);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  if (isError || !assessment) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <Link
          href={ROUTES.COMPANY.ASSESSMENTS}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Assessments</span>
        </Link>
        <Card className="p-8 text-center space-y-4">
          <Alert variant="error" title="Assessment Not Found">
            Failed to load assessment. {error && 'data' in error ? String((error as any).data?.detail || '') : 'It may not exist or does not belong to your organization.'}
          </Alert>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  const isCloud = assessment.workspaceMode === 'cloud';
  const duration = assessment.timing?.durationMinutes || 90;
  const deliverables = assessment.effectiveBrief?.deliverables || [];
  const instructions = assessment.effectiveBrief?.instructions || assessment.briefOverrides?.instructions || 'Standard assessment task requirements.';

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Back link */}
      <div>
        <Link
          href={ROUTES.COMPANY.ASSESSMENTS}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Assessments</span>
        </Link>
      </div>

      {/* Page Header */}
      <PageHeader
        title={assessment.name}
        description={`Role blueprint pinned to template version v${assessment.templateVersion} (BR-03).`}
        badge={{ text: isCloud ? 'Cloud VM' : 'Chat Workspace', variant: 'default' }}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/company/assessments/${encodeURIComponent(assessment.id)}/rubric?templateId=${encodeURIComponent(assessment.templateId)}&versionId=${encodeURIComponent(assessment.templateVersionId)}`}
            >
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Sliders className="w-4 h-4 text-neutral-500" />}
                className="text-xs sm:text-sm font-medium"
              >
                Customize Rubric
              </Button>
            </Link>
            <Link href={ROUTES.COMPANY.CANDIDATES}>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Users className="w-4 h-4" />}
                className="text-xs sm:text-sm font-medium"
              >
                Manage Candidates
              </Button>
            </Link>
          </div>
        }
      />

      {/* ─── Metric / Configuration Cards ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        {/* Workspace & Status Card */}
        <Card className="p-5 space-y-3.5 rounded-2xl border border-neutral-200/80 bg-white shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-neutral-400" />
              Environment
            </span>
            <AssessmentStatusBadge status={assessment.status} size="sm" />
          </div>

          <div className="space-y-2 pt-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-neutral-500 text-xs">Workspace Mode:</span>
              <span className="font-medium text-neutral-900 inline-flex items-center gap-1 text-xs">
                {isCloud ? <Laptop className="w-3.5 h-3.5 text-neutral-500" /> : <MessageSquare className="w-3.5 h-3.5 text-neutral-500" />}
                {isCloud ? 'Cloud VM (Browser IDE)' : 'Chat Workspace'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-500 text-xs">Template Pinned:</span>
              <span className="font-mono text-xs text-neutral-800 bg-neutral-100 px-2 py-0.5 rounded">
                {assessment.templateId} @ v{assessment.templateVersion}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-500 text-xs">Candidates Count:</span>
              <span className="font-medium text-xs text-neutral-900">
                {assessment.candidateCount ?? 0} assigned
              </span>
            </div>
          </div>
        </Card>

        {/* Timing Configuration Card */}
        <Card className="p-5 space-y-3.5 rounded-2xl border border-neutral-200/80 bg-white shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-neutral-400" />
              Timing & Policy (BR-08, BR-09)
            </span>
            <Badge variant="default" size="sm">
              {assessment.timing?.type || 'duration'}
            </Badge>
          </div>

          <div className="space-y-2 pt-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-neutral-500 text-xs">Duration Limit:</span>
              <span className="font-medium text-neutral-900 text-xs">{duration} minutes</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-500 text-xs">Disconnect Pause:</span>
              <span className="text-xs font-medium text-neutral-800">
                {assessment.timing?.pauseTimerOnDisconnect ? 'Paused' : 'Timer continues (Default)'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-500 text-xs">Timezone:</span>
              <span className="font-mono text-xs text-neutral-800">
                {assessment.timing?.tz || 'UTC'}
              </span>
            </div>
          </div>
        </Card>

        {/* AI Policy Card */}
        <Card className="p-5 space-y-3.5 rounded-2xl border border-neutral-200/80 bg-white shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-neutral-400" />
              AI Assistant Policy (BR-13)
            </span>
            <Badge variant={assessment.aiPolicy?.enabled !== false ? 'success' : 'default'} size="sm" dot>
              {assessment.aiPolicy?.enabled !== false ? 'AI Enabled' : 'AI Disabled'}
            </Badge>
          </div>

          <div className="space-y-2 pt-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-neutral-500 text-xs">Allowed Models:</span>
              <span className="font-mono text-[11px] text-neutral-800 truncate max-w-[150px]">
                {assessment.aiPolicy?.allowedModels?.join(', ') || 'gpt-4o'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-500 text-xs">Candidate Token Cap:</span>
              <span className="font-medium text-neutral-900 text-xs">
                {assessment.aiPolicy?.capPerCandidate?.value?.toLocaleString() || '50,000'} tokens
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-500 text-xs">Rate Limit:</span>
              <span className="font-medium text-neutral-900 text-xs">
                {assessment.aiPolicy?.rpm || 20} RPM
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* ─── Task Instructions & Deliverables ─── */}
      <Card className="p-6 sm:p-8 rounded-2xl border border-neutral-200/80 bg-white shadow-2xs space-y-6">
        <div className="border-b border-neutral-100 pb-4">
          <h3 className="text-base font-semibold text-neutral-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-neutral-500" />
            Task Brief & Instructions
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            Instructions provided to candidate workspaces during assessment execution.
          </p>
        </div>

        <div className="space-y-4">
          <div className="bg-neutral-50/70 p-4 rounded-xl border border-neutral-200/60">
            <p className="text-xs sm:text-sm text-neutral-800 whitespace-pre-wrap leading-relaxed">
              {instructions}
            </p>
          </div>

          {deliverables.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                Required Deliverables
              </h4>
              <ul className="space-y-1.5">
                {deliverables.map((deliv, index) => (
                  <li key={index} className="flex items-start gap-2 text-xs sm:text-sm text-neutral-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{deliv}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
