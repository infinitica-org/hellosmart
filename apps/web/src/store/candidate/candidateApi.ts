import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { getApiBaseUrl, CSRF_HEADER_NAME, CSRF_HEADER_VALUE } from '@/lib/api-client';
import type {
  CandidateAssessmentDetail,
  WorkspaceSession,
} from '@/lib/candidate-api';
import type { CandidateAssessment } from '@/components/candidate/assessment-card';
import type {
  AssessmentTimingResponse,
  CandidateDraft,
  SubmitAssessmentDto,
  SubmitAssessmentResponse,
  AssessmentConsentResponse,
  UploadedArtifactMetadata,
} from '@hs/contracts';

export const candidateApi = createApi({
  reducerPath: 'candidateApi',
  baseQuery: fetchBaseQuery({
    baseUrl: getApiBaseUrl(),
    credentials: 'include',
    prepareHeaders: (headers, { type, endpoint }) => {
      // Automatically add CSRF header for all state-changing mutations
      if (type === 'mutation') {
        headers.set(CSRF_HEADER_NAME, CSRF_HEADER_VALUE);
      }
      return headers;
    },
  }),
  tagTypes: [
    'CandidateAssignments',
    'ActiveSession',
    'AssessmentDetail',
    'CandidateDraft',
  ],
  endpoints: (builder) => ({
    getCandidateAssignments: builder.query<CandidateAssessment[], void>({
      query: () => '/candidate/assignments',
      providesTags: ['CandidateAssignments'],
    }),

    getCandidateAssessment: builder.query<CandidateAssessmentDetail, string>({
      query: (id) => `/candidate/assessments/${encodeURIComponent(id)}`,
      providesTags: (_result, _error, id) => [{ type: 'AssessmentDetail', id }],
    }),

    recordConsent: builder.mutation<
      AssessmentConsentResponse,
      { id: string; textVersion: string }
    >({
      query: ({ id, textVersion }) => ({
        url: `/candidate/assessments/${encodeURIComponent(id)}/consent`,
        method: 'POST',
        body: { textVersion },
      }),
      invalidatesTags: (_result, _error, { id }) => [
        'CandidateAssignments',
        { type: 'AssessmentDetail', id },
      ],
    }),

    startAssessment: builder.mutation<
      WorkspaceSession,
      { id: string; ticket?: string }
    >({
      query: ({ id, ticket }) => ({
        url: `/candidate/assessments/${encodeURIComponent(id)}/start`,
        method: 'POST',
        body: ticket ? { ticket } : {},
      }),
      invalidatesTags: ['CandidateAssignments', 'ActiveSession'],
    }),

    getAssessmentTiming: builder.query<AssessmentTimingResponse, string>({
      query: (id) => `/candidate/assessments/${encodeURIComponent(id)}/timing`,
    }),

    getAssessmentDraft: builder.query<CandidateDraft, string>({
      query: (id) => `/candidate/assessments/${encodeURIComponent(id)}/draft`,
      providesTags: (_result, _error, id) => [{ type: 'CandidateDraft', id }],
    }),

    saveAssessmentDraft: builder.mutation<
      CandidateDraft,
      { id: string; payload: Partial<CandidateDraft> }
    >({
      query: ({ id, payload }) => ({
        url: `/candidate/assessments/${encodeURIComponent(id)}/draft`,
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'CandidateDraft', id }],
    }),

    uploadArtifact: builder.mutation<UploadedArtifactMetadata, FormData>({
      query: (formData) => ({
        url: '/candidate/artifacts/upload',
        method: 'POST',
        body: formData,
      }),
    }),

    submitDeliverables: builder.mutation<
      SubmitAssessmentResponse,
      { id: string; payload: SubmitAssessmentDto }
    >({
      query: ({ id, payload }) => ({
        url: `/candidate/assessments/${encodeURIComponent(id)}/submit`,
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        'CandidateAssignments',
        'ActiveSession',
        { type: 'CandidateDraft', id },
      ],
    }),

    pingCandidate: builder.query<{ ok: boolean; timestamp: number }, void>({
      query: () => '/candidate/ping',
    }),
  }),
});

export const {
  useGetCandidateAssignmentsQuery,
  useGetCandidateAssessmentQuery,
  useRecordConsentMutation,
  useStartAssessmentMutation,
  useGetAssessmentTimingQuery,
  useGetAssessmentDraftQuery,
  useSaveAssessmentDraftMutation,
  useUploadArtifactMutation,
  useSubmitDeliverablesMutation,
  usePingCandidateQuery,
} = candidateApi;

