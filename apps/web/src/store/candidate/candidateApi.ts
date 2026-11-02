import { createApi } from '@reduxjs/toolkit/query/react';
import { createCustomBaseQuery } from '../api/baseApi';

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
  baseQuery: createCustomBaseQuery({ reducerPath: 'candidateApi' }),
  tagTypes: CANDIDATE_TAG_TYPES,
  endpoints: (builder) => ({
    getCandidateAssessments: builder.query<CandidateAssessmentItem[], void>({
      query: () => 'candidate/assessments',
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

    saveDraft: builder.mutation<{ success: boolean; savedAt: string }, WorkspaceDraftPayload>({
      query: (body) => ({
        url: `candidate/workspace/${encodeURIComponent(body.workspaceId)}/draft`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, _error, { workspaceId }) => [
        { type: 'Workspace', id: workspaceId },
      ],
    }),

    submitAssessment: builder.mutation<
      AssessmentSubmissionResponse,
      AssessmentSubmissionPayload
    >({
      query: (body) => ({
        url: `candidate/workspace/${encodeURIComponent(body.workspaceId)}/submit`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, _error, { workspaceId }) => [
        { type: 'Workspace', id: workspaceId },
        { type: 'Assessments', id: 'LIST' },
        { type: 'Submissions', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetCandidateAssessmentsQuery,
  useLazyGetCandidateAssessmentsQuery,
  useSaveDraftMutation,
  useSubmitAssessmentMutation,
} = candidateApi;
