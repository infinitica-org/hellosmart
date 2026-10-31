'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createAssessment } from '@/lib/company-api';
import { usePortalAuth } from '@/hooks/use-portal-auth';
import type { CreateAssessmentDto, AssessmentDto } from '@/components/company/assessments/types';

export function useCreateAssessment() {
  const queryClient = useQueryClient();
  const { user } = usePortalAuth();
  const orgId = user?.org?.id ?? 'current';

  return useMutation<AssessmentDto, Error, CreateAssessmentDto>({
    mutationFn: (dto) => createAssessment(dto),
    onSuccess: () => {
      // Invalidate company assessments list so fresh state is fetched
      queryClient.invalidateQueries({
        queryKey: ['company', orgId, 'assessments'],
      });
    },
  });
}

