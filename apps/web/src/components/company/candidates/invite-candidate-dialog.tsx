'use client';

import React, { useState } from 'react';
import { z } from 'zod';
import {
  Dialog,
  Button,
  Input,
  Label,
  Alert,
  Spinner,
  User,
  Mail,
} from '@hs/ui';
import { CreateCandidateDtoSchema, type CreateCandidateDto } from '@hs/contracts';
import { useGetAssessmentsQuery } from '@/store/company/companyApi';
import { ApiError } from '@/lib/api-client';
import { PLACEHOLDERS, UI_LABELS } from '@/constants';

export interface InviteCandidateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (dto: CreateCandidateDto) => Promise<void>;
  isSubmitting?: boolean;
}

interface FormErrors {
  name?: string | undefined;
  email?: string | undefined;
}

export function InviteCandidateDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
}: InviteCandidateDialogProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('');
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);

  const { data: rawAssessments } = useGetAssessmentsQuery();
  const assessments = Array.isArray(rawAssessments)
    ? rawAssessments
    : (rawAssessments as { items?: any[] } | undefined)?.items || [];

  const handleClose = () => {
    if (isSubmitting) return;
    setName('');
    setEmail('');
    setSelectedAssessmentId('');
    setFormErrors({});
    setApiError(null);
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);

    const validation = CreateCandidateDtoSchema.safeParse({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      assessment_id: selectedAssessmentId || undefined,
    });

    if (!validation.success) {
      const fieldErrors: FormErrors = {};
      for (const issue of validation.error.issues) {
        if (issue.path[0] === 'name') {
          fieldErrors.name = issue.message;
        } else if (issue.path[0] === 'email') {
          fieldErrors.email = issue.message;
        }
      }
      setFormErrors(fieldErrors);
      return;
    }

    setFormErrors({});

    try {
      await onSubmit(validation.data);
      handleClose();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setApiError(err.message);
      } else if (err instanceof Error) {
        setApiError(err.message);
      } else {
        setApiError('An unexpected error occurred while sending the candidate invitation.');
      }
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          handleClose();
        } else {
          onOpenChange(true);
        }
      }}
      title="Invite Candidate"
      description="Invite an individual candidate to complete technical assessments within your organization."
      size="md"
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            {UI_LABELS.BUTTONS.CANCEL}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2"
          >
            {isSubmitting && <Spinner size="sm" />}
            <span>{isSubmitting ? 'Sending Invitation...' : UI_LABELS.BUTTONS.INVITE_CANDIDATE}</span>
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {apiError && (
          <Alert variant="error" title="Invitation Failed">
            {apiError}
          </Alert>
        )}

        {/* Security & Lifecycle Notice (BR-24) */}
        <Alert variant="info" title="Invitation Security & Onboarding">
          The candidate will receive an email containing a secure, single-use link expiring in 72 hours.
          On initial login, they will be required to set their password.
        </Alert>

        {/* Full Name */}
        <div className="space-y-1.5">
          <Label htmlFor="candidate-name" required>
            Candidate Full Name
          </Label>
          <div className="relative">
            <Input
              id="candidate-name"
              placeholder={PLACEHOLDERS.INPUTS.CANDIDATE_NAME}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (formErrors.name) {
                  setFormErrors((prev) => {
                    const copy = { ...prev };
                    delete copy.name;
                    return copy;
                  });
                }
              }}
              disabled={isSubmitting}
              className={`pl-9 text-sm ${formErrors.name ? 'border-danger focus:border-danger' : ''}`}
            />
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-400">
              <User className="h-4 w-4" />
            </div>
          </div>
          {formErrors.name && (
            <p className="text-xs text-danger">{formErrors.name}</p>
          )}
        </div>

        {/* Email Address */}
        <div className="space-y-1.5">
          <Label htmlFor="candidate-email" required>
            Work or Personal Email
          </Label>
          <div className="relative">
            <Input
              id="candidate-email"
              type="email"
              placeholder={PLACEHOLDERS.INPUTS.CANDIDATE_EMAIL}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (formErrors.email) {
                  setFormErrors((prev) => {
                    const copy = { ...prev };
                    delete copy.email;
                    return copy;
                  });
                }
              }}
              disabled={isSubmitting}
              className={`pl-9 text-sm ${formErrors.email ? 'border-danger focus:border-danger' : ''}`}
            />
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-400">
              <Mail className="h-4 w-4" />
            </div>
          </div>
          {formErrors.email && (
            <p className="text-xs text-danger">{formErrors.email}</p>
          )}
        </div>

        {/* Assessment Assignment Selector (BR-24, S1-T05-1) */}
        <div className="space-y-1.5">
          <Label htmlFor="candidate-assessment">
            Assign Assessment
          </Label>
          <select
            id="candidate-assessment"
            value={selectedAssessmentId}
            onChange={(e) => setSelectedAssessmentId(e.target.value)}
            disabled={isSubmitting}
            className="w-full h-9 px-3 text-sm rounded-md border border-neutral-200 bg-white text-neutral-800 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900/10 transition-colors shadow-2xs"
          >
            <option value="">No assessment assigned (General onboarding)</option>
            {assessments.map((asm: any) => (
              <option key={asm.id} value={asm.id}>
                {asm.name} ({asm.status})
              </option>
            ))}
          </select>
          <p className="text-[11px] text-neutral-500">
            Assigning an assessment allows the candidate to start their work simulation directly upon login.
          </p>
        </div>
      </form>
    </Dialog>
  );
}
