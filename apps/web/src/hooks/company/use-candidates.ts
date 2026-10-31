'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePortalAuth } from '@/hooks/use-portal-auth';
import {
  fetchCandidates,
  inviteCandidate,
  bulkUploadCandidates,
  updateCandidate,
  deleteCandidate,
  resendCandidateInvite,
} from '@/lib/company-api';
import { ApiError } from '@/lib/api-client';
import type {
  CandidateDto,
  CreateCandidateDto,
  CandidateFilters,
  CandidateListResponse,
  UpdateCandidateInput,
  BulkCandidateUploadPayload,
  BulkCandidateUploadResponse,
} from '@/components/company/candidates/types';

export const candidateKeys = {
  all: (orgId: string) => ['company', orgId, 'candidates'] as const,
  list: (orgId: string, filters?: Partial<CandidateFilters>) =>
    [...candidateKeys.all(orgId), 'list', filters ?? {}] as const,
  detail: (orgId: string, candidateId: string) =>
    [...candidateKeys.all(orgId), 'detail', candidateId] as const,
};

/**
 * React Query hook to list candidates with filters and pagination.
 * Scoped by tenant orgId to prevent cross-tenant cache bleeding (BR-01, CO-014).
 */
export function useCandidates(filters?: Partial<CandidateFilters>) {
  const { user } = usePortalAuth();
  const orgId = user?.org?.id ?? 'current';

  return useQuery<CandidateListResponse, Error>({
    queryKey: candidateKeys.list(orgId, filters),
    queryFn: () => fetchCandidates(filters),
    staleTime: 30 * 1000, // 30 seconds
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
 * Mutation hook for inviting a single candidate (CO-011, BR-24).
 */
export function useInviteCandidate() {
  const queryClient = useQueryClient();
  const { user } = usePortalAuth();
  const orgId = user?.org?.id ?? 'current';

  return useMutation<CandidateDto, Error, CreateCandidateDto>({
    mutationFn: (dto) => inviteCandidate(dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: candidateKeys.all(orgId),
      });
    },
  });
}

/**
 * Mutation hook for bulk importing candidates via CSV (CO-012, EX-11).
 */
export function useBulkUploadCandidates() {
  const queryClient = useQueryClient();
  const { user } = usePortalAuth();
  const orgId = user?.org?.id ?? 'current';

  return useMutation<BulkCandidateUploadResponse, Error, BulkCandidateUploadPayload>({
    mutationFn: (payload) => bulkUploadCandidates(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: candidateKeys.all(orgId),
      });
    },
  });
}

/**
 * Mutation hook for updating candidate information (CO-015).
 */
export function useUpdateCandidate() {
  const queryClient = useQueryClient();
  const { user } = usePortalAuth();
  const orgId = user?.org?.id ?? 'current';

  return useMutation<CandidateDto, Error, { candidateId: string; input: UpdateCandidateInput }>({
    mutationFn: ({ candidateId, input }) => updateCandidate(candidateId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: candidateKeys.all(orgId),
      });
    },
  });
}

/**
 * Mutation hook for soft-deleting a candidate (CO-016, BR-31).
 */
export function useDeleteCandidate() {
  const queryClient = useQueryClient();
  const { user } = usePortalAuth();
  const orgId = user?.org?.id ?? 'current';

  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: (candidateId) => deleteCandidate(candidateId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: candidateKeys.all(orgId),
      });
    },
  });
}

/**
 * Mutation hook for resending an expiring invitation link (CO-017, BR-24).
 */
export function useResendCandidateInvite() {
  const queryClient = useQueryClient();
  const { user } = usePortalAuth();
  const orgId = user?.org?.id ?? 'current';

  return useMutation<{ success: boolean; sentAt: string }, Error, string>({
    mutationFn: (candidateId) => resendCandidateInvite(candidateId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: candidateKeys.all(orgId),
      });
    },
  });
}

