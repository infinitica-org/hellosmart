'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Alert } from '@hs/ui';
import { WizardProgress } from './wizard-progress';
import { TemplateDetailsStep } from './steps/template-details-step';
import { CandidateInstructionsStep } from './steps/candidate-instructions-step';
import { AssessmentConfigurationStep } from './steps/assessment-configuration-step';
import { ConfirmAssessmentDialog } from './confirm-assessment-dialog';
import { useCreateAssessment } from '@/hooks/company/use-create-assessment';
import {
  Step1TemplateDetailsSchema,
  Step2InstructionsSchema,
  Step3TimingSchema,
  type AssessmentFormValues,
} from './types';
import type { RoleTemplateDetail, RoleTemplateSummary } from '@/components/company/templates/types';

export interface CreationWizardProps {
  template: RoleTemplateDetail | RoleTemplateSummary;
}

export function CreationWizard({ template }: CreationWizardProps): React.JSX.Element {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const storageKey = `hs_wizard_form_${template.id}_${template.versionId}`;

  // Initialize form values from template defaults or sessionStorage cache
  const [values, setValues] = useState<AssessmentFormValues>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem(storageKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.templateId === template.id && parsed.templateVersionId === template.versionId) {
            return parsed;
          }
        }
      } catch {
        // ignore sessionStorage error
      }
    }

    const initialBrief =
      'candidateBrief' in template && template.candidateBrief
        ? template.candidateBrief
        : template.description;

    return {
      templateId: template.id,
      templateVersionId: template.versionId,
      name: `${template.name} Assessment`,
      requisitionId: '',
      candidateInstructions: initialBrief,
      deliverables: [
        'Complete solution passing all automated test suites',
        'Clean, documented architecture and commit history',
      ],
      timing: {
        type: 'duration',
        durationMinutes: template.durationMinutes || 90,
        tz: 'UTC',
        pauseTimerOnDisconnect: false,
      },
    };
  });

  // Persist draft to sessionStorage on change
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(values));
    } catch {
      // ignore
    }
  }, [values, storageKey]);

  const updateValues = (updates: Partial<AssessmentFormValues>) => {
    setValues((prev) => ({ ...prev, ...updates }));
    setErrors({});
    setSubmitError(null);
  };

  // Step Validation Barrier
  const validateCurrentStep = (): boolean => {
    setErrors({});
    setSubmitError(null);

    if (currentStep === 1) {
      const res = Step1TemplateDetailsSchema.safeParse({
        templateId: values.templateId,
        templateVersionId: values.templateVersionId,
        name: values.name,
        requisitionId: values.requisitionId,
      });

      if (!res.success) {
        const formatted: Record<string, string> = {};
        res.error.issues.forEach((issue) => {
          const field = issue.path[0];
          if (field) formatted[field.toString()] = issue.message;
        });
        setErrors(formatted);
        return false;
      }
    } else if (currentStep === 2) {
      const res = Step2InstructionsSchema.safeParse({
        candidateInstructions: values.candidateInstructions,
        deliverables: values.deliverables,
      });

      if (!res.success) {
        const formatted: Record<string, string> = {};
        res.error.issues.forEach((issue) => {
          const field = issue.path[0];
          if (field) formatted[field.toString()] = issue.message;
        });
        setErrors(formatted);
        return false;
      }
    } else if (currentStep === 3) {
      const res = Step3TimingSchema.safeParse(values.timing);

      if (!res.success) {
        const formatted: Record<string, string> = {};
        res.error.issues.forEach((issue) => {
          const field = issue.path.join('.');
          formatted[field] = issue.message;
        });
        setErrors(formatted);
        return false;
      }
    }

    return true;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      setCurrentStep((prev) => Math.min(prev + 1, 3));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    setErrors({});
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Mutation Hook
  const { mutate: create, isPending } = useCreateAssessment();

  const handleConfirmSubmit = () => {
    setSubmitError(null);

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const validTemplateVersionId =
      values.templateVersionId && UUID_REGEX.test(values.templateVersionId)
        ? values.templateVersionId
        : undefined;

    const cleanedTiming = {
      ...values.timing,
      windowStartUtc:
        values.timing.windowStartUtc && values.timing.windowStartUtc.trim() !== ''
          ? new Date(values.timing.windowStartUtc).toISOString()
          : undefined,
      windowEndUtc:
        values.timing.windowEndUtc && values.timing.windowEndUtc.trim() !== ''
          ? new Date(values.timing.windowEndUtc).toISOString()
          : undefined,
    };

    const payload: any = {
      templateId: values.templateId,
      ...(validTemplateVersionId ? { templateVersionId: validTemplateVersionId } : {}),
      name: values.name,
      requisitionId: values.requisitionId || undefined,
      workspaceMode: (template as any).workspaceMode || 'cloud',
      candidateInstructions: values.candidateInstructions,
      deliverables: values.deliverables,
      briefOverrides: {
        instructions: values.candidateInstructions,
        deliverables: values.deliverables,
      },
      timing: cleanedTiming,
    };

    create(
      payload,
      {
        onSuccess: (data) => {
          // Clear session draft
          try {
            sessionStorage.removeItem(storageKey);
          } catch {
            // ignore
          }

          setShowConfirm(false);
          // Navigate to candidates tab filtered by newly created assessment, or assessments list
          router.push(`/company/assessments?createdId=${encodeURIComponent(data.id)}`);
        },
        onError: (err) => {
          setShowConfirm(false);
          setSubmitError(
            err.message || 'Failed to create assessment. The backend endpoint may be in development.'
          );
        },
      }
    );
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto" data-testid="assessment-creation-wizard">
      {/* ─── Wizard Step Progress ─── */}
      <WizardProgress currentStep={currentStep} onStepClick={(step) => setCurrentStep(step)} />

      {/* ─── Global Submit Error Notice ─── */}
      {submitError && (
        <Alert variant="error" className="text-sm">
          <div className="font-semibold">Creation Error</div>
          <p>{submitError}</p>
        </Alert>
      )}

      {/* ─── Active Step Form Component ─── */}
      {currentStep === 1 && (
        <TemplateDetailsStep
          template={template}
          values={values}
          errors={errors}
          onChange={updateValues}
        />
      )}

      {currentStep === 2 && (
        <CandidateInstructionsStep
          values={values}
          errors={errors}
          onChange={updateValues}
        />
      )}

      {currentStep === 3 && (
        <AssessmentConfigurationStep
          template={template}
          values={values}
          errors={errors}
          onChange={updateValues}
        />
      )}

      {/* ─── Wizard Sticky Navigation Controls ─── */}
      <div className="pt-6 border-t border-neutral-200 flex items-center justify-between gap-4">
        <div>
          {currentStep > 1 && (
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={handleBack}
              data-testid="wizard-back-btn"
              className="rounded-xl px-5 border-neutral-200 text-neutral-700 hover:bg-neutral-50"
            >
              ← Back
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {currentStep < 3 ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleNext}
              data-testid="wizard-next-btn"
              className="rounded-xl px-6 shadow-sm"
            >
              Continue to Step {currentStep + 1} →
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => {
                if (validateCurrentStep()) {
                  setShowConfirm(true);
                }
              }}
              data-testid="wizard-submit-btn"
              className="rounded-xl px-6 shadow-sm"
            >
              Review &amp; Create Assessment →
            </Button>
          )}
        </div>
      </div>

      {/* ─── Confirmation Modal ─── */}
      <ConfirmAssessmentDialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleConfirmSubmit}
        isSubmitting={isPending}
        values={values}
        templateName={template.name}
      />
    </div>
  );
}

