import { createApi } from '@reduxjs/toolkit/query/react';
import { createCustomBaseQuery } from '../api/baseApi';
import type {
  CandidateDto,
  CreateCandidateDto,
} from '@hs/contracts';
import type {
  CandidateFilters,
  BulkCandidateUploadPayload,
  BulkCandidateUploadResponse,
  UpdateCandidateInput,
} from '@/components/company/candidates/types';
import type { RoleTemplateSummary } from '@/components/company/templates/types';
import type {
  CreateAssessmentDto,
  AssessmentDto,
} from '@/components/company/assessments/types';

export interface CompanyMetricsDto {
  configuredAssessments: number;
  invitedCandidates: number;
  activeCandidates?: number;
  submissionsToReview: number;
  maxCandidates?: number;
  remainingQuota: number;
}

/**
 * Cache tags owned and managed by the Company Admin portal.
 * Company manages assigned templates, assessments, candidate invites, metrics, rubrics, and quotes.
 */
export const COMPANY_TAG_TYPES = [
  'Session',
  'Templates',
  'Assessments',
  'Candidates',
  'Metrics',
  'Rubrics',
  'Quotes',
] as const;

export type CompanyTagType = (typeof COMPANY_TAG_TYPES)[number];

/**
 * Company Admin RTK Query API slice.
 * Operates exclusively within the CompanyStore with its own dedicated cache and reducerPath.
 */
export const companyApi = createApi({
  reducerPath: 'companyApi',
  baseQuery: createCustomBaseQuery({ reducerPath: 'companyApi' }),
  tagTypes: COMPANY_TAG_TYPES,
  endpoints: (builder) => ({
    getCandidates: builder.query<
      CandidateDto[] | { items: CandidateDto[]; total: number },
      Partial<CandidateFilters> | void
    >({
      query: (filters) => {
        if (!filters) return 'company/candidates';
        const params = new URLSearchParams();
        if (filters.search) params.set('search', filters.search);
        if (filters.status && filters.status !== 'all') params.set('status', filters.status);
        if (filters.page) params.set('page', String(filters.page));
        if (filters.limit) params.set('limit', String(filters.limit));
        const qs = params.toString();
        return qs ? `company/candidates?${qs}` : 'company/candidates';
      },
      providesTags: (result) => {
        const items = Array.isArray(result)
          ? result
          : (result as { items?: CandidateDto[] } | null | undefined)?.items;
        return Array.isArray(items)
          ? [
              ...items.map(({ id }) => ({
                type: 'Candidates' as const,
                id,
              })),
              { type: 'Candidates', id: 'LIST' },
            ]
          : [{ type: 'Candidates', id: 'LIST' }];
      },
    }),

    inviteCandidate: builder.mutation<CandidateDto, CreateCandidateDto>({
      query: (body) => ({
        url: 'company/candidates',
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        { type: 'Candidates', id: 'LIST' },
        { type: 'Metrics', id: 'PIPELINE' },
      ],
    }),

    bulkUploadCandidates: builder.mutation<
      BulkCandidateUploadResponse,
      BulkCandidateUploadPayload
    >({
      query: (body) => ({
        url: 'company/candidates/bulk',
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        { type: 'Candidates', id: 'LIST' },
        { type: 'Metrics', id: 'PIPELINE' },
      ],
    }),

    updateCandidate: builder.mutation<
      CandidateDto,
      { candidateId: string; input: UpdateCandidateInput }
    >({
      query: ({ candidateId, input }) => ({
        url: `company/candidates/${encodeURIComponent(candidateId)}`,
        method: 'PATCH',
        body: input,
      }),
      invalidatesTags: (_result, _error, { candidateId }) => [
        { type: 'Candidates', id: candidateId },
        { type: 'Candidates', id: 'LIST' },
      ],
    }),

    deleteCandidate: builder.mutation<{ success: boolean }, string>({
      query: (candidateId) => ({
        url: `company/candidates/${encodeURIComponent(candidateId)}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, candidateId) => [
        { type: 'Candidates', id: candidateId },
        { type: 'Candidates', id: 'LIST' },
        { type: 'Metrics', id: 'PIPELINE' },
      ],
    }),

    resendCandidateInvite: builder.mutation<{ success: boolean; sentAt: string }, string>({
      query: (candidateId) => ({
        url: `company/candidates/${encodeURIComponent(candidateId)}/resend-invite`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, candidateId) => [
        { type: 'Candidates', id: candidateId },
      ],
    }),

    getCompanyTemplates: builder.query<
      RoleTemplateSummary[] | { items: RoleTemplateSummary[] },
      void
    >({
      query: () => 'company/templates',
      providesTags: (result) => {
        const items = Array.isArray(result)
          ? result
          : (result as { items?: RoleTemplateSummary[] } | null | undefined)?.items;
        return Array.isArray(items)
          ? [
              ...items.map(({ id }) => ({
                type: 'Templates' as const,
                id,
              })),
              { type: 'Templates', id: 'LIST' },
            ]
          : [{ type: 'Templates', id: 'LIST' }];
      },
    }),

    createAssessment: builder.mutation<AssessmentDto, CreateAssessmentDto>({
      query: (body) => ({
        url: 'company/assessments',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Assessments', id: 'LIST' }],
    }),

    getCompanyMetrics: builder.query<CompanyMetricsDto, void>({
      query: () => 'company/metrics',
      providesTags: [{ type: 'Metrics', id: 'PIPELINE' }],
    }),
  }),
});

export const {
  useGetCandidatesQuery,
  useLazyGetCandidatesQuery,
  useInviteCandidateMutation,
  useBulkUploadCandidatesMutation,
  useUpdateCandidateMutation,
  useDeleteCandidateMutation,
  useResendCandidateInviteMutation,
  useGetCompanyTemplatesQuery,
  useLazyGetCompanyTemplatesQuery,
  useCreateAssessmentMutation,
  useGetCompanyMetricsQuery,
  useLazyGetCompanyMetricsQuery,
} = companyApi;
