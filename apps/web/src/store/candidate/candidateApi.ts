import { createApi } from '@reduxjs/toolkit/query/react';
import { createCustomBaseQuery } from '../api/baseApi';
import { getApiBaseUrl } from '@/lib/api-client';
import type {
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
  assessmentId: string;
  title: string;
  companyName: string;
  workspaceMode: 'cloud' | 'chat';
  status:
    | 'invited'
    | 'window_not_open'
    | 'ready'
    | 'in_progress'
    | 'disconnected'
    | 'submitted'
    | 'expired'
    | 'revoked';
  durationMinutes: number;
  deadline?: string | null;
  submittedAt?: string | null;
  releaseResults?: boolean;
}

export interface CandidateAssessmentDetail extends CandidateAssessmentItem {
  deadline?: string | null;
  releaseResults?: boolean;
  submittedAt?: string | null;
  timing?: {
    type?: string;
    durationMinutes?: number;
    tz?: string;
    pauseTimerOnDisconnect?: boolean;
  };
  aiPolicy?: {
    enabled?: boolean;
    allowedModels?: string[];
  };
  briefOverrides?: {
    scenario?: string;
    instructions?: string;
    deliverables?: string[];
  };
  firstConnectAt?: string | null;
  autoSubmitted?: boolean;
}

export interface WorkspaceDraftPayload {
  workspaceId: string;
  files?: Record<string, string>;
  notes?: string;
  updatedAt: string;
}

export interface AssessmentSubmissionPayload {
  workspaceId: string;
  assignmentId?: string;
  artifacts?: Array<{ name: string; url: string }>;
  submissionNotes?: string;
  autoSubmitted?: boolean;
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

    getAssessmentById: builder.query<CandidateAssessmentDetail, string>({
      query: (id) => `/candidate/assessments/${encodeURIComponent(id)}`,
      providesTags: (_result, _error, id) => [{ type: 'Assessments', id }, { type: 'AssessmentDetail', id }],
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

    acceptConsent: builder.mutation<
      { success: boolean; status: string; firstConnectAt?: string },
      { assignmentId: string; textVersion?: string }
    >({
      query: ({ assignmentId, textVersion }) => ({
        url: `/candidate/workspace/${encodeURIComponent(assignmentId)}/consent`,
        method: 'POST',
        body: { textVersion: textVersion || 'v1.0' },
      }),
      invalidatesTags: (_result, _error, { assignmentId }) => [
        { type: 'Assessments', id: assignmentId },
        { type: 'Assessments', id: 'LIST' },
        { type: 'Workspace', id: assignmentId },
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
  useGetAssessmentByIdQuery,
  useLazyGetAssessmentByIdQuery,
  useRecordConsentMutation,
  useAcceptConsentMutation,
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
