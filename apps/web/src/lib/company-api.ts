import { apiFetch, getApiBaseUrl, ApiError } from './api-client';
import type { RoleTemplateSummary, RoleTemplateDetail } from '@/components/company/templates/types';
import { DEFAULT_ROLE_TEMPLATES, DEFAULT_ROLE_TEMPLATES_DETAIL } from './templates-data';
import type { CreateAssessmentDto, AssessmentDto } from '@/components/company/assessments/types';
import type { AssessmentRubric } from '@/components/company/rubric/types';
import type {
  CandidateDto,
  CreateCandidateDto,
  CandidateFilters,
  CandidateListResponse,
  UpdateCandidateInput,
  BulkCandidateUploadPayload,
  BulkCandidateUploadResponse,
} from '@/components/company/candidates/types';


/**
 * Fetches the customized rubric configuration for a specific assessment.
 * Falls back to inherited template rubric if not yet customized.
 *
 * Endpoint: GET /api/v1/company/assessments/:id/rubric
 */
export async function fetchAssessmentRubric(
  assessmentId: string,
  fetchFn: typeof fetch = fetch
): Promise<AssessmentRubric> {
  if (!assessmentId) {
    throw new Error('Assessment ID is required');
  }

  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/company/assessments/${encodeURIComponent(assessmentId)}/rubric`;

  const res = await apiFetch(
    url,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      credentials: 'include',
    },
    fetchFn
  );

  if (!res.ok) {
    let errorDetail = 'Failed to fetch assessment rubric';
    let errorCode = 'RUBRIC_NOT_FOUND';

    try {
      const errorJson = await res.json();
      errorDetail = errorJson.detail || errorDetail;
      errorCode = errorJson.code || errorCode;
    } catch {
      // ignore
    }

    throw new ApiError(res.status, errorCode, errorDetail);
  }

  return (await res.json()) as AssessmentRubric;
}

/**
 * Updates the assessment-specific rubric dimensions.
 * Enforces 100% total weight invariant and tenant isolation (BR-01, BR-18).
 *
 * Endpoint: PUT /api/v1/company/assessments/:id/rubric
 */
export async function updateAssessmentRubric(
  assessmentId: string,
  rubric: AssessmentRubric,
  fetchFn: typeof fetch = fetch
): Promise<AssessmentRubric> {
  if (!assessmentId) {
    throw new Error('Assessment ID is required');
  }

  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/company/assessments/${encodeURIComponent(assessmentId)}/rubric`;

  const res = await apiFetch(
    url,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(rubric),
      credentials: 'include',
    },
    fetchFn
  );

  if (!res.ok) {
    let errorDetail = 'Failed to update assessment rubric';
    let errorCode = 'RUBRIC_UPDATE_FAILED';

    try {
      const errorJson = await res.json();
      errorDetail = errorJson.detail || errorDetail;
      errorCode = errorJson.code || errorCode;
    } catch {
      // ignore
    }

    throw new ApiError(res.status, errorCode, errorDetail);
  }

  return (await res.json()) as AssessmentRubric;
}


/**
 * Creates a new assessment blueprint based on a selected role template version.
 * Enforces BR-01 (Tenant Isolation) & BR-03 (Template Version Pinning).
 * Initial status: 'draft'.
 *
 * Endpoint: POST /api/v1/company/assessments
 * (Tracked Backend Dependency - throws ApiError on failure)
 */
export async function createAssessment(
  dto: CreateAssessmentDto,
  fetchFn: typeof fetch = fetch
): Promise<AssessmentDto> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/company/assessments`;

  const res = await apiFetch(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(dto),
      credentials: 'include',
    },
    fetchFn
  );

  if (!res.ok) {
    let errorDetail = 'Failed to create assessment';
    let errorCode = 'ASSESSMENT_CREATION_FAILED';

    try {
      const errorJson = await res.json();
      errorDetail = errorJson.detail || errorDetail;
      errorCode = errorJson.code || errorCode;
    } catch {
      // ignore JSON parse error
    }

    throw new ApiError(res.status, errorCode, errorDetail);
  }

  return (await res.json()) as AssessmentDto;
}

/**
 * Fetches the list of role simulation templates privately assigned to the caller's organization.
 * Enforces BR-01 (Tenant Isolation) & BR-02 (Template Privacy).
 *
 * Endpoint: GET /api/v1/company/templates
 */
export async function fetchAssignedTemplates(
  fetchFn: typeof fetch = fetch
): Promise<RoleTemplateSummary[]> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/company/templates`;

  const res = await apiFetch(
    url,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      credentials: 'include',
    },
    fetchFn
  );

  if (!res.ok) {
    if (res.status === 404) {
      return DEFAULT_ROLE_TEMPLATES;
    }

    let errorDetail = 'Failed to fetch assigned templates';
    let errorCode = 'TEMPLATES_FETCH_FAILED';

    try {
      const errorJson = await res.json();
      errorDetail = errorJson.detail || errorDetail;
      errorCode = errorJson.code || errorCode;
    } catch {
      // ignore json parse error
    }

    throw new ApiError(res.status, errorCode, errorDetail);
  }

  const data = (await res.json()) as { items?: RoleTemplateSummary[] } | RoleTemplateSummary[];
  if (Array.isArray(data)) {
    return data;
  }
  return data.items ?? [];
}

/**
 * Fetches the full specification for a single template on-demand (brief, repo structure, rubric, AI policy).
 *
 * Endpoint: GET /api/v1/company/templates/:id
 */
export async function fetchTemplateById(
  templateId: string,
  fetchFn: typeof fetch = fetch
): Promise<RoleTemplateDetail> {
  if (!templateId) {
    throw new Error('Template ID is required');
  }

  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/company/templates/${encodeURIComponent(templateId)}`;

  const res = await apiFetch(
    url,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      credentials: 'include',
    },
    fetchFn
  );

  if (!res.ok) {
    if (res.status === 404 && DEFAULT_ROLE_TEMPLATES_DETAIL[templateId]) {
      return DEFAULT_ROLE_TEMPLATES_DETAIL[templateId]!;
    }

    let errorDetail = 'Failed to fetch template specification';
    let errorCode = 'TEMPLATE_NOT_FOUND';

    try {
      const errorJson = await res.json();
      errorDetail = errorJson.detail || errorDetail;
      errorCode = errorJson.code || errorCode;
    } catch {
      // ignore
    }

    throw new ApiError(res.status, errorCode, errorDetail);
  }

  return (await res.json()) as RoleTemplateDetail;
}

/**
 * Fetches the paginated list of candidates for the caller's organization.
 * Scoped strictly by server session tenant orgId (BR-01, CO-014).
 *
 * Endpoint: GET /api/v1/candidates
 */
export async function fetchCandidates(
  filters?: Partial<CandidateFilters>,
  fetchFn: typeof fetch = fetch
): Promise<CandidateListResponse> {
  const baseUrl = getApiBaseUrl();
  const searchParams = new URLSearchParams();

  if (filters?.search) {
    searchParams.set('search', filters.search);
  }
  if (filters?.status && filters.status !== 'all') {
    searchParams.set('status', filters.status);
  }
  if (filters?.page) {
    searchParams.set('page', filters.page.toString());
  }
  if (filters?.limit) {
    searchParams.set('limit', filters.limit.toString());
  }

  const queryString = searchParams.toString();
  const url = `${baseUrl}/candidates${queryString ? `?${queryString}` : ''}`;

  const res = await apiFetch(
    url,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      credentials: 'include',
    },
    fetchFn
  );

  if (!res.ok) {
    let errorDetail = 'Failed to fetch candidates';
    let errorCode = 'CANDIDATES_FETCH_FAILED';

    try {
      const errorJson = await res.json();
      errorDetail = errorJson.detail || errorDetail;
      errorCode = errorJson.code || errorCode;
    } catch {
      // ignore
    }

    throw new ApiError(res.status, errorCode, errorDetail);
  }

  const data = await res.json();
  if (Array.isArray(data)) {
    return { items: data as CandidateDto[], total: data.length };
  }
  return data as CandidateListResponse;
}

/**
 * Invites a single candidate to the organization.
 * Triggers 72h token creation and sends invitation email (BR-24, CO-011, CO-013).
 *
 * Endpoint: POST /api/v1/candidates
 */
export async function inviteCandidate(
  dto: CreateCandidateDto,
  fetchFn: typeof fetch = fetch
): Promise<CandidateDto> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/candidates`;

  const res = await apiFetch(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(dto),
      credentials: 'include',
    },
    fetchFn
  );

  if (!res.ok) {
    let errorDetail = 'Failed to invite candidate';
    let errorCode = 'CANDIDATE_INVITE_FAILED';

    try {
      const errorJson = await res.json();
      errorDetail = errorJson.detail || errorDetail;
      errorCode = errorJson.code || errorCode;
    } catch {
      // ignore
    }

    throw new ApiError(res.status, errorCode, errorDetail);
  }

  return (await res.json()) as CandidateDto;
}

/**
 * Imports a batch of candidates via bulk upload.
 * Partial success: valid rows are imported, invalid rows returned with reasons (CO-012, EX-11).
 *
 * Endpoint: POST /api/v1/candidates/bulk
 */
export async function bulkUploadCandidates(
  payload: BulkCandidateUploadPayload,
  fetchFn: typeof fetch = fetch
): Promise<BulkCandidateUploadResponse> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/candidates/bulk`;

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
    let errorDetail = 'Failed to bulk upload candidates';
    let errorCode = 'BULK_UPLOAD_FAILED';

    try {
      const errorJson = await res.json();
      errorDetail = errorJson.detail || errorDetail;
      errorCode = errorJson.code || errorCode;
    } catch {
      // ignore
    }

    throw new ApiError(res.status, errorCode, errorDetail);
  }

  return (await res.json()) as BulkCandidateUploadResponse;
}

/**
 * Updates a candidate's information.
 * Allows name editing; email editing only if still in 'invited' state (CO-015).
 *
 * Endpoint: PATCH /api/v1/candidates/:id
 */
export async function updateCandidate(
  candidateId: string,
  input: UpdateCandidateInput,
  fetchFn: typeof fetch = fetch
): Promise<CandidateDto> {
  if (!candidateId) {
    throw new Error('Candidate ID is required');
  }

  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/candidates/${encodeURIComponent(candidateId)}`;

  const res = await apiFetch(
    url,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(input),
      credentials: 'include',
    },
    fetchFn
  );

  if (!res.ok) {
    let errorDetail = 'Failed to update candidate';
    let errorCode = 'CANDIDATE_UPDATE_FAILED';

    try {
      const errorJson = await res.json();
      errorDetail = errorJson.detail || errorDetail;
      errorCode = errorJson.code || errorCode;
    } catch {
      // ignore
    }

    throw new ApiError(res.status, errorCode, errorDetail);
  }

  return (await res.json()) as CandidateDto;
}

/**
 * Soft deletes a candidate with audit record (CO-016, BR-31).
 *
 * Endpoint: DELETE /api/v1/candidates/:id
 */
export async function deleteCandidate(
  candidateId: string,
  fetchFn: typeof fetch = fetch
): Promise<{ success: boolean }> {
  if (!candidateId) {
    throw new Error('Candidate ID is required');
  }

  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/candidates/${encodeURIComponent(candidateId)}`;

  const res = await apiFetch(
    url,
    {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
      },
      credentials: 'include',
    },
    fetchFn
  );

  if (!res.ok) {
    let errorDetail = 'Failed to delete candidate';
    let errorCode = 'CANDIDATE_DELETE_FAILED';

    try {
      const errorJson = await res.json();
      errorDetail = errorJson.detail || errorDetail;
      errorCode = errorJson.code || errorCode;
    } catch {
      // ignore
    }

    throw new ApiError(res.status, errorCode, errorDetail);
  }

  return { success: true };
}

/**
 * Resends an invitation to an eligible candidate with a fresh expiring link (CO-017, BR-24, BR-31).
 *
 * Endpoint: POST /api/v1/candidates/:id/resend-invite
 */
export async function resendCandidateInvite(
  candidateId: string,
  fetchFn: typeof fetch = fetch
): Promise<{ success: boolean; sentAt: string }> {
  if (!candidateId) {
    throw new Error('Candidate ID is required');
  }

  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/candidates/${encodeURIComponent(candidateId)}/resend-invite`;

  const res = await apiFetch(
    url,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
      credentials: 'include',
    },
    fetchFn
  );

  if (!res.ok) {
    let errorDetail = 'Failed to resend candidate invitation';
    let errorCode = 'RESEND_INVITE_FAILED';

    try {
      const errorJson = await res.json();
      errorDetail = errorJson.detail || errorDetail;
      errorCode = errorJson.code || errorCode;
    } catch {
      // ignore
    }

    throw new ApiError(res.status, errorCode, errorDetail);
  }

  return { success: true, sentAt: new Date().toISOString() };
}

