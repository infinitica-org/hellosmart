'use client';

import { useState, useCallback } from 'react';
import {
  CURRENT_CONSENT_TEXT_VERSION,
  type AssessmentConsentResponse,
} from '@hs/contracts';
import { recordCandidateConsent } from '@/lib/candidate-api';

export interface UseCandidateConsentResult {
  isSubmitting: boolean;
  error: string | null;
  recordedConsent: AssessmentConsentResponse | null;
  submitConsent: (assessmentId: string) => Promise<AssessmentConsentResponse | null>;
  resetError: () => void;
}

export function useCandidateConsent(): UseCandidateConsentResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordedConsent, setRecordedConsent] = useState<AssessmentConsentResponse | null>(null);

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  const submitConsent = useCallback(
    async (assessmentId: string): Promise<AssessmentConsentResponse | null> => {
      setIsSubmitting(true);
      setError(null);

      try {
        const data = await recordCandidateConsent(assessmentId, CURRENT_CONSENT_TEXT_VERSION);
        setRecordedConsent(data);
        return data;
      } catch (err: unknown) {
        const errMsg =
          err instanceof Error
            ? err.message
            : 'Network error while recording consent. Please try again.';
        setError(errMsg);
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  return {
    isSubmitting,
    error,
    recordedConsent,
    submitConsent,
    resetError,
  };
}

