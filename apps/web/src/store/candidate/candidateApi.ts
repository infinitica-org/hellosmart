import { createApi } from '@reduxjs/toolkit/query/react';
import { createCustomBaseQuery } from '../api/baseApi';
import { getApiBaseUrl } from '@/lib/api-client';
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

/**
 * Cache tags owned and accessible to the Candidate portal.
 * Candidates interact with their assigned assessments, active workspace sessions, and submissions.
 * Company-only resources (Candidates CRUD, Rubrics, Quotes) are strictly excluded.
 */
export const CANDIDATE_TAG_TYPES = [
  'Session',
  'Assessments',
  'Workspace',
  'Submissions',
  'CandidateAssignments',
  'ActiveSession',
  'AssessmentDetail',
  'CandidateDraft',
] as const;

export type CandidateTagType = (typeof CANDIDATE_TAG_TYPES)[number];

export interface CandidateAssessmentItem {
  id: string;
  title: string;
  role: string;
  status: 'invited' | 'in_progress' | 'submitted' | 'expired';
  durationMinutes: number;
  deadline?: string;
  submittedAt?: string;
}

export interface WorkspaceDraftPayload {
  workspaceId: string;
  files?: Record<string, string>;
  notes?: string;
  updatedAt: string;
}

export interface AssessmentSubmissionPayload {
  workspaceId: string;
  artifacts?: Array<{ name: string; url: string }>;
  submissionNotes?: string;
}

export interface AssessmentSubmissionResponse {
  submissionId: string;
  status: 'submitted' | 'under_review';
  submittedAt: string;
}

/**
 * Candidate RTK Query API slice.
 * Operates exclusively within the CandidateStore with its own dedicated cache and reducerPath.
 * Enforces memory isolation so candidates cannot read company or admin store state (BR-01, BR-25).
 */
export const candidateApi = createApi({
  reducerPath: 'candidateApi',
  baseQuery: createCustomBaseQuery({
    baseUrl: getApiBaseUrl(),
    reducerPath: 'candidateApi',
  }),
  tagTypes: CANDIDATE_TAG_TYPES,
  endpoints: (builder) => ({
    getCandidateAssignments: builder.query<CandidateAssessment[], void>({
      query: () => '/candidate/assignments',
      providesTags: ['CandidateAssignments', 'Assessments'],
    }),

    getCandidateAssessments: builder.query<CandidateAssessmentItem[], void>({
      query: () => '/candidate/assignments',
      providesTags: (result) => {
        const items = Array.isArray(result)
          ? result
          : (result as { items?: CandidateAssessmentItem[] } | null | undefined)?.items ?? [];
        return [
          ...items.map(({ id }: { id: string }) => ({
            type: 'Assessments' as const,
            id,
          })),
          { type: 'Assessments', id: 'LIST' },
        ];
      },
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
        'Assessments',
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
      invalidatesTags: ['CandidateAssignments', 'Assessments', 'ActiveSession', 'Workspace'],
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

    saveDraft: builder.mutation<{ success: boolean; savedAt: string }, WorkspaceDraftPayload>({
      query: (body) => ({
        url: `/candidate/assessments/${encodeURIComponent(body.workspaceId)}/draft`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, _error, { workspaceId }) => [
        { type: 'Workspace', id: workspaceId },
        { type: 'CandidateDraft', id: workspaceId },
      ],
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
        'Assessments',
        'ActiveSession',
        'Submissions',
        { type: 'CandidateDraft', id },
      ],
    }),

    submitAssessment: builder.mutation<
      AssessmentSubmissionResponse,
      AssessmentSubmissionPayload
    >({
      query: (body) => ({
        url: `/candidate/assessments/${encodeURIComponent(body.workspaceId)}/submit`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, _error, { workspaceId }) => [
        { type: 'Workspace', id: workspaceId },
        { type: 'Assessments', id: 'LIST' },
        { type: 'Submissions', id: 'LIST' },
      ],
    }),

    pingCandidate: builder.query<{ ok: boolean; timestamp: number }, void>({
      query: () => '/candidate/ping',
    }),
  }),
});

export const {
  useGetCandidateAssignmentsQuery,
  useGetCandidateAssessmentsQuery,
  useLazyGetCandidateAssessmentsQuery,
  useGetCandidateAssessmentQuery,
  useRecordConsentMutation,
  useStartAssessmentMutation,
  useGetAssessmentTimingQuery,
  useGetAssessmentDraftQuery,
  useSaveAssessmentDraftMutation,
  useSaveDraftMutation,
  useUploadArtifactMutation,
  useSubmitDeliverablesMutation,
  useSubmitAssessmentMutation,
  usePingCandidateQuery,
} = candidateApi;
