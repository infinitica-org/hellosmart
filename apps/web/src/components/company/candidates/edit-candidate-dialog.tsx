'use client';

import React, { useState, useEffect } from 'react';
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
  Badge,
} from '@hs/ui';
import type { CandidateDto, UpdateCandidateInput } from './types';
import { ApiError } from '@/lib/api-client';
import { UI_LABELS } from '@/constants';

export interface EditCandidateDialogProps {
  candidate: CandidateDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (candidateId: string, input: UpdateCandidateInput) => Promise<void>;
  isSubmitting?: boolean;
}

const nameSchema = z.string().min(1, 'Name is required').max(120, 'Name must be 120 characters or less');
const emailSchema = z.string().email('Invalid email address format').max(254);

interface FormErrors {
  name?: string | undefined;
  email?: string | undefined;
}

export function EditCandidateDialog({
  candidate,
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
}: EditCandidateDialogProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (candidate) {
      setName(candidate.name);
      setEmail(candidate.email);
      setErrors({});
      setApiError(null);
    }
  }, [candidate]);

  if (!candidate) return null;

  const isInvited = candidate.status === 'invited';
  const isEmailEditable = isInvited; // CO-015: Only editable until activation

  const handleClose = () => {
    if (isSubmitting) return;
    setErrors({});
    setApiError(null);
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);

    const newErrors: FormErrors = {};

    const nameCheck = nameSchema.safeParse(name.trim());
    if (!nameCheck.success) {
      const issue = nameCheck.error.issues[0];
      if (issue) newErrors.name = issue.message;
    }

    if (isEmailEditable) {
      const emailCheck = emailSchema.safeParse(email.trim().toLowerCase());
      if (!emailCheck.success) {
        const issue = emailCheck.error.issues[0];
        if (issue) newErrors.email = issue.message;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});

    const input: UpdateCandidateInput = {
      name: name.trim(),
    };

    if (isEmailEditable && email.trim().toLowerCase() !== candidate.email.toLowerCase()) {
      input.email = email.trim().toLowerCase();
    }

    try {
      await onSubmit(candidate.id, input);
      handleClose();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setApiError(err.message);
      } else if (err instanceof Error) {
        setApiError(err.message);
      } else {
        setApiError('Failed to update candidate information.');
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
      title="Edit Candidate"
      description="Update candidate profile information and contact details."
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
            <span>{isSubmitting ? 'Saving Changes...' : UI_LABELS.BUTTONS.SAVE_CHANGES}</span>
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {apiError && (
          <Alert variant="error" title="Update Failed">
            {apiError}
          </Alert>
        )}

        <div className="flex items-center justify-between rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs dark:border-neutral-800 dark:bg-neutral-900">
          <span className="text-neutral-500">Candidate Status</span>
          <Badge variant={candidate.status === 'active' ? 'success' : 'warning'} dot>
            {candidate.status}
          </Badge>
        </div>

        {/* Name input */}
        <div className="space-y-1.5">
          <Label htmlFor="edit-name" required>
            Candidate Full Name
          </Label>
          <div className="relative">
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) {
                  setErrors((prev) => {
                    const copy = { ...prev };
                    delete copy.name;
                    return copy;
                  });
                }
              }}
              disabled={isSubmitting}
              className={`pl-9 text-sm ${errors.name ? 'border-red-500 focus:border-red-500' : ''}`}
            />
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-400">
              <User className="h-4 w-4" />
            </div>
          </div>
          {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
        </div>

        {/* Email input */}
        <div className="space-y-1.5">
          <Label htmlFor="edit-email" required>
            Email Address
          </Label>
          <div className="relative">
            <Input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) {
                  setErrors((prev) => {
                    const copy = { ...prev };
                    delete copy.email;
                    return copy;
                  });
                }
              }}
              disabled={isSubmitting || !isEmailEditable}
              className={`pl-9 text-sm ${!isEmailEditable ? 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800' : ''} ${errors.email ? 'border-red-500 focus:border-red-500' : ''}`}
            />
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-400">
              <Mail className="h-4 w-4" />
            </div>
          </div>
          {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}

          {!isEmailEditable ? (
            <p className="text-xs text-neutral-500">
              Email cannot be changed after candidate activation (CO-015).
            </p>
          ) : (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Changing an invited email requires sending a fresh invitation link.
            </p>
          )}
        </div>
      </form>
    </Dialog>
  );
}
