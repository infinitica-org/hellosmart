'use client';

import { useCreateAssessmentMutation } from '@/store/company/companyApi';
import type { CreateAssessmentDto, AssessmentDto } from '@/components/company/assessments/types';

/**
 * Mutation hook for creating a new assessment blueprint from a role template version.
 * Routed through centralized RTK Query companyApi slice.
 */
export function useCreateAssessment() {
  const [createAssessmentMutation, { isLoading: isPending }] = useCreateAssessmentMutation();

  const mutate = (
    dto: CreateAssessmentDto,
    options?: {
      onSuccess?: (data: AssessmentDto) => void;
      onError?: (err: Error) => void;
    },
  ) => {
    createAssessmentMutation(dto)
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
                  'Failed to create assessment.',
              );
        options?.onError?.(error);
      });
  };

  return {
    isPending,
    mutate,
    mutateAsync: async (dto: CreateAssessmentDto): Promise<AssessmentDto> => {
      return await createAssessmentMutation(dto).unwrap();
    },
  };
}
