'use client';

import {
  useGetCandidatesQuery,
  useInviteCandidateMutation,
  useBulkUploadCandidatesMutation,
  useUpdateCandidateMutation,
  useDeleteCandidateMutation,
  useResendCandidateInviteMutation,
} from '@/store/company/companyApi';
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
 * RTK Query hook to list candidates with filters and pagination.
 * Scoped by tenant orgId to prevent cross-tenant cache bleeding (BR-01, CO-014).
 * Centralized in RTK Query companyApi slice.
 */
export function useCandidates(filters?: Partial<CandidateFilters>) {
  const { data, isLoading, error, refetch } = useGetCandidatesQuery(filters);

  const items = Array.isArray(data)
    ? data
    : ((data as unknown as { items?: CandidateDto[] })?.items ?? []);
  const total = Array.isArray(data)
    ? data.length
    : ((data as unknown as { total?: number })?.total ?? items.length);

  const normalizedResponse: CandidateListResponse = {
    items,
    total,
  };

  const normalizedError = error
    ? new Error((error as any)?.message || (error as any)?.data?.message || 'Failed to load candidates.')
    : null;

  return {
    data: normalizedResponse,
    isLoading,
    error: normalizedError,
    refetch: () => void refetch(),
  };
}

/**
 * Mutation hook for inviting a single candidate (CO-011, BR-24).
 * Centralized in RTK Query companyApi slice.
 */
export function useInviteCandidate() {
  const [inviteCandidateMutation, { isLoading: isPending }] = useInviteCandidateMutation();

  return {
    isPending,
    mutateAsync: async (dto: CreateCandidateDto): Promise<CandidateDto> => {
      return await inviteCandidateMutation(dto).unwrap();
    },
  };
}

/**
 * Mutation hook for bulk importing candidates via CSV (CO-012, EX-11).
 * Centralized in RTK Query companyApi slice.
 */
export function useBulkUploadCandidates() {
  const [bulkUploadMutation, { isLoading: isPending }] = useBulkUploadCandidatesMutation();

  return {
    isPending,
    mutateAsync: async (
      payload: BulkCandidateUploadPayload,
    ): Promise<BulkCandidateUploadResponse> => {
      return await bulkUploadMutation(payload).unwrap();
    },
  };
}

/**
 * Mutation hook for updating candidate information (CO-015).
 * Centralized in RTK Query companyApi slice.
 */
export function useUpdateCandidate() {
  const [updateMutation, { isLoading: isPending }] = useUpdateCandidateMutation();

  return {
    isPending,
    mutateAsync: async ({
      candidateId,
      input,
    }: {
      candidateId: string;
      input: UpdateCandidateInput;
    }): Promise<CandidateDto> => {
      return await updateMutation({ candidateId, input }).unwrap();
    },
  };
}

/**
 * Mutation hook for soft-deleting a candidate (CO-016, BR-31).
 * Centralized in RTK Query companyApi slice.
 */
export function useDeleteCandidate() {
  const [deleteMutation, { isLoading: isPending }] = useDeleteCandidateMutation();

  return {
    isPending,
    mutateAsync: async (candidateId: string): Promise<{ success: boolean }> => {
      return await deleteMutation(candidateId).unwrap();
    },
  };
}

/**
 * Mutation hook for resending an expiring invitation link (CO-017, BR-24, BR-31).
 * Centralized in RTK Query companyApi slice.
 */
export function useResendCandidateInvite() {
  const [resendMutation, { isLoading: isPending }] = useResendCandidateInviteMutation();

  return {
    isPending,
    variables: null as string | null,
    mutateAsync: async (
      candidateId: string,
    ): Promise<{ success: boolean; sentAt?: string; deliveryStatus?: 'sent' | 'failed'; processedAt?: string }> => {
      return await resendMutation(candidateId).unwrap();
    },
  };
}
