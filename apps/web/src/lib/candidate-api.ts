import { apiFetch, getApiBaseUrl, ApiError } from './api-client';
import type {
  AssessmentTimingResponse,
  CandidateDraft,
  SubmitAssessmentDto,
  SubmitAssessmentResponse,
  AssessmentConsentResponse,
  UploadedArtifactMetadata,
} from '@hs/contracts';
import type { CandidateAssessment } from '@/components/candidate/assessment-card';

export interface CandidateAssessmentDetail {
  id: string;
  assignmentId: string;
  name: string;
  companyName: string;
  durationMinutes: number;
  workspaceMode: 'cloud' | 'chat';
  status: string;
  instructions?: string | null;
  scenario?: string | null;
  deliverables?: string[];
  aiPolicy?: {
    enabled: boolean;
    allowedModels?: string[];
    capPerCandidate?: { unit: string; value: number };
    rpm?: number;
  };
  windowStartUtc?: string | null;
  windowEndUtc?: string | null;
}

export interface WorkspaceSession {
  sessionId: string;
  assignmentId: string;
  mode: 'cloud' | 'chat';
  status: string;
  gatewayUrl: string;
  ticket: string;
  serverTimeUtc: string;
  deadlineUtc: string;
  remainingMs: number;
  requireFullscreen: boolean;
}

/**
 * GET /api/v1/candidate/assignments
 */
export async function fetchCandidateAssignments(
  fetchFn: typeof fetch = fetch
): Promise<CandidateAssessment[]> {
  const url = `${getApiBaseUrl()}/candidate/assignments`;
  const res = await apiFetch(
    url,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    },
    fetchFn
  );

  if (!res.ok) {
    const errorJson = await res.json().catch(() => null);
    throw new ApiError(
      res.status,
      errorJson?.code || 'FETCH_ASSIGNMENTS_FAILED',
      errorJson?.detail || errorJson?.message || `Failed to fetch assignments (${res.status})`
    );
  }

  const json = await res.json();
  return Array.isArray(json) ? json : json?.items || json?.data || [];
}

/**
 * GET /api/v1/candidate/assessments/:id
 */
export async function fetchCandidateAssessmentDetails(
  id: string,
  fetchFn: typeof fetch = fetch
): Promise<CandidateAssessmentDetail> {
  const url = `${getApiBaseUrl()}/candidate/assessments/${encodeURIComponent(id)}`;
  const res = await apiFetch(
    url,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    },
    fetchFn
  );

  if (!res.ok) {
    const errorJson = await res.json().catch(() => null);
    throw new ApiError(
      res.status,
      errorJson?.code || 'FETCH_ASSESSMENT_FAILED',
      errorJson?.detail || errorJson?.message || `Failed to fetch assessment (${res.status})`
    );
  }

  return (await res.json()) as CandidateAssessmentDetail;
}

/**
 * POST /api/v1/candidate/assessments/:id/consent
 */
export async function recordCandidateConsent(
  id: string,
  textVersion: string,
  fetchFn: typeof fetch = fetch
): Promise<AssessmentConsentResponse> {
  const url = `${getApiBaseUrl()}/candidate/assessments/${encodeURIComponent(id)}/consent`;
  const res = await apiFetch(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ textVersion }),
      credentials: 'include',
    },
    fetchFn
  );

  if (!res.ok) {
    const errorJson = await res.json().catch(() => null);
    throw new ApiError(
      res.status,
      errorJson?.code || 'CONSENT_FAILED',
      errorJson?.detail || errorJson?.message || `Failed to record consent (${res.status})`
    );
  }

  return (await res.json()) as AssessmentConsentResponse;
}

/**
 * POST /api/v1/candidate/assessments/:id/start
 */
export async function startCandidateAssessment(
  id: string,
  diagnosticsPassed = true,
  fetchFn: typeof fetch = fetch
): Promise<WorkspaceSession> {
  const url = `${getApiBaseUrl()}/candidate/assessments/${encodeURIComponent(id)}/start`;
  const res = await apiFetch(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ diagnosticsPassed }),
      credentials: 'include',
    },
    fetchFn
  );

  if (!res.ok) {
    const errorJson = await res.json().catch(() => null);
    throw new ApiError(
      res.status,
      errorJson?.code || 'START_ASSESSMENT_FAILED',
      errorJson?.detail || errorJson?.message || `Failed to start assessment (${res.status})`
    );
  }

  return (await res.json()) as WorkspaceSession;
}

/**
 * POST /api/v1/candidate/assessments/:id/submit
 */
export async function submitCandidateDeliverables(
  id: string,
  payload: SubmitAssessmentDto,
  fetchFn: typeof fetch = fetch
): Promise<SubmitAssessmentResponse> {
  const url = `${getApiBaseUrl()}/candidate/assessments/${encodeURIComponent(id)}/submit`;
  const res = await apiFetch(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      credentials: 'include',
    },
    fetchFn
  );

  if (!res.ok) {
    const errorJson = await res.json().catch(() => null);
    throw new ApiError(
      res.status,
      errorJson?.code || 'SUBMIT_FAILED',
      errorJson?.detail || errorJson?.message || `Failed to submit deliverables (${res.status})`
    );
  }

  return (await res.json()) as SubmitAssessmentResponse;
}

/**
 * GET /api/v1/candidate/assessments/:id/timing
 */
export async function fetchCandidateTiming(
  id: string,
  fetchFn: typeof fetch = fetch
): Promise<AssessmentTimingResponse> {
  const url = `${getApiBaseUrl()}/candidate/assessments/${encodeURIComponent(id)}/timing`;
  const res = await apiFetch(
    url,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    },
    fetchFn
  );

  if (!res.ok) {
    const errorJson = await res.json().catch(() => null);
    throw new ApiError(
      res.status,
      errorJson?.code || 'TIMING_SYNC_FAILED',
      errorJson?.detail || errorJson?.message || `Failed to sync timing (${res.status})`
    );
  }

  return (await res.json()) as AssessmentTimingResponse;
}

/**
 * GET /api/v1/candidate/assessments/:id/draft
 */
export async function fetchCandidateDraft(
  id: string,
  fetchFn: typeof fetch = fetch
): Promise<CandidateDraft> {
  const url = `${getApiBaseUrl()}/candidate/assessments/${encodeURIComponent(id)}/draft`;
  const res = await apiFetch(
    url,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    },
    fetchFn
  );

  if (!res.ok) {
    const errorJson = await res.json().catch(() => null);
    throw new ApiError(
      res.status,
      errorJson?.code || 'FETCH_DRAFT_FAILED',
      errorJson?.detail || errorJson?.message || `Failed to fetch draft (${res.status})`
    );
  }

  return (await res.json()) as CandidateDraft;
}

/**
 * POST /api/v1/candidate/assessments/:id/draft
 */
export async function saveCandidateDraft(
  id: string,
  payload: Partial<CandidateDraft>,
  fetchFn: typeof fetch = fetch
): Promise<CandidateDraft> {
  const url = `${getApiBaseUrl()}/candidate/assessments/${encodeURIComponent(id)}/draft`;
  const res = await apiFetch(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      credentials: 'include',
    },
    fetchFn
  );

  if (!res.ok) {
    const errorJson = await res.json().catch(() => null);
    throw new ApiError(
      res.status,
      errorJson?.code || 'SAVE_DRAFT_FAILED',
      errorJson?.detail || errorJson?.message || `Failed to save draft (${res.status})`
    );
  }

  return (await res.json()) as CandidateDraft;
}

/**
 * POST /api/v1/candidate/artifacts/upload
 */
export async function uploadDeliverableArtifact(
  formData: FormData,
  fetchFn: typeof fetch = fetch
): Promise<UploadedArtifactMetadata> {
  const url = `${getApiBaseUrl()}/candidate/artifacts/upload`;
  const res = await apiFetch(
    url,
    {
      method: 'POST',
      body: formData,
      credentials: 'include',
    },
    fetchFn
  );

  if (!res.ok) {
    const errorJson = await res.json().catch(() => null);
    throw new ApiError(
      res.status,
      errorJson?.code || 'UPLOAD_FAILED',
      errorJson?.detail || errorJson?.message || `Upload failed (${res.status})`
    );
  }

  return (await res.json()) as UploadedArtifactMetadata;
}

/**
 * GET /api/v1/candidate/ping
 */
export async function pingCandidateApi(
  fetchFn: typeof fetch = fetch
): Promise<{ ok: boolean; timestamp: number }> {
  const url = `${getApiBaseUrl()}/candidate/ping`;
  const res = await apiFetch(
    url,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
    },
    fetchFn
  );

  if (!res.ok) {
    throw new Error(`Ping failed (${res.status})`);
  }

  return await res.json();
}

