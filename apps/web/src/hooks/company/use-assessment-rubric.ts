'use client';

import {
  useGetAssessmentRubricQuery,
  useUpdateAssessmentRubricMutation,
} from '@/store/company/companyApi';
import type { AssessmentRubric } from '@/components/company/rubric/types';

/**
 * Hook to retrieve the assessment-specific rubric.
 * Centralized via RTK Query companyApi slice.
 */
export function useAssessmentRubric(assessmentId: string | null | undefined) {
  const { data, isLoading, isError, error, refetch } = useGetAssessmentRubricQuery(
    assessmentId ?? '',
    { skip: !assessmentId },
  );

  const normalizedError = error
    ? new Error(
        (error as any)?.data?.message ||
          (error as any)?.data?.detail ||
          (error as any)?.message ||
          'Failed to load assessment rubric.',
      )
    : null;

  return {
    data: data as AssessmentRubric | undefined,
    isLoading,
    isError,
    error: normalizedError,
    refetch: () => void refetch(),
  };
}

/**
 * Mutation hook to persist customized rubric dimensions.
 * Enforces 100% total weight and updates RTK Query cache.
 * Centralized via RTK Query companyApi slice.
 */
export function useUpdateAssessmentRubric(assessmentId: string) {
  const [updateMutation, { isLoading: isPending }] = useUpdateAssessmentRubricMutation();

  const mutate = (
    rubric: AssessmentRubric,
    options?: {
      onSuccess?: (data: AssessmentRubric) => void;
      onError?: (err: Error) => void;
    },
  ) => {
    updateMutation({ assessmentId, rubric })
      .unwrap()
      .then((data) => options?.onSuccess?.(data))
      .catch((err) => {
        const error =
          err instanceof Error
            ? err
            : new Error(
                err?.data?.message ||
                  err?.data?.detail ||
                  err?.message ||
                  'Failed to save rubric configuration to server.',
              );
        options?.onError?.(error);
      });
  };

  return {
    isPending,
    mutate,
    mutateAsync: async (rubric: AssessmentRubric): Promise<AssessmentRubric> => {
      return await updateMutation({ assessmentId, rubric }).unwrap();
    },
  };
}

