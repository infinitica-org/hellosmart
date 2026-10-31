'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAssessmentRubric, updateAssessmentRubric } from '@/lib/company-api';
import { ApiError } from '@/lib/api-client';
import { usePortalAuth } from '@/hooks/use-portal-auth';
import type { AssessmentRubric } from '@/components/company/rubric/types';

/**
 * Hook to retrieve the assessment-specific rubric.
 * Scoped by orgId to prevent cross-tenant data leakage (BR-01).
 */
export function useAssessmentRubric(assessmentId: string | null | undefined) {
  const { user } = usePortalAuth();
  const orgId = user?.org?.id ?? 'current';

  return useQuery<AssessmentRubric, Error>({
    queryKey: ['company', orgId, 'assessment', assessmentId, 'rubric'],
    queryFn: () => {
      if (!assessmentId) {
        throw new Error('Assessment ID is required');
      }
      return fetchAssessmentRubric(assessmentId);
    },
    enabled: Boolean(assessmentId),
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) => {
      if (
        error instanceof ApiError &&
        (error.status === 401 || error.status === 403 || error.status === 404)
      ) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

/**
 * Mutation hook to persist customized rubric dimensions.
 * Enforces 100% total weight and updates React Query cache.
 */
export function useUpdateAssessmentRubric(assessmentId: string) {
  const queryClient = useQueryClient();
  const { user } = usePortalAuth();
  const orgId = user?.org?.id ?? 'current';

  return useMutation<AssessmentRubric, Error, AssessmentRubric>({
    mutationFn: (rubric) => updateAssessmentRubric(assessmentId, rubric),
    onSuccess: (updated) => {
      queryClient.setQueryData(['company', orgId, 'assessment', assessmentId, 'rubric'], updated);
      queryClient.invalidateQueries({
        queryKey: ['company', orgId, 'assessment', assessmentId],
      });
    },
  });
}

