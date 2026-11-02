'use client';

import { useState, useEffect, useCallback } from 'react';
import type { CandidateAssessment } from '@/components/candidate/assessment-card';

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
      const res = await fetch('/api/candidate/assignments', {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        credentials: 'include',
        cache: 'no-store',
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => null);
        const detail = errorJson?.detail || errorJson?.message || `Failed to fetch assignments (${res.status})`;
        throw new Error(detail);
      }
      const json = await res.json();
      const list: CandidateAssessment[] = Array.isArray(json)
        ? json
        : Array.isArray(json?.items)
          ? json.items
          : Array.isArray(json?.data)
            ? json.data
            : [];

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
