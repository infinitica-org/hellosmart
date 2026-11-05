'use client';

import { useState, useEffect, useCallback } from 'react';
import type { CandidateAssessment } from '@/components/candidate/assessment-card';
import { fetchCandidateAssignments } from '@/lib/candidate-api';

export interface UseCandidateAssessmentsResult {
  data: CandidateAssessment[] | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  isRefetching: boolean;
}

export function useCandidateAssessments(
  initialData?: CandidateAssessment[]
): UseCandidateAssessmentsResult {
  const [data, setData] = useState<CandidateAssessment[] | null>(initialData ?? null);
  const [isLoading, setIsLoading] = useState<boolean>(!initialData);
  const [isRefetching, setIsRefetching] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAssignments = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setIsLoading(true);
    } else {
      setIsRefetching(true);
    }
    setError(null);

    try {
      const list = await fetchCandidateAssignments();
      setData(list);
    } catch (err: unknown) {
      const errorObj = err instanceof Error ? err : new Error('Unable to load assigned assessments');
      setError(errorObj);
    } finally {
      setIsLoading(false);
      setIsRefetching(false);
    }
  }, []);

  useEffect(() => {
    if (initialData === undefined) {
      void fetchAssignments(true);
    }
  }, [fetchAssignments, initialData]);

  const refetch = useCallback(async () => {
    await fetchAssignments(false);
  }, [fetchAssignments]);

  return {
    data,
    isLoading,
    error,
    refetch,
    isRefetching,
  };
}
