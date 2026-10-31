import { apiFetch, getApiBaseUrl, ApiError } from './api-client';
import type { RoleTemplateSummary, RoleTemplateDetail } from '@/components/company/templates/types';
import type { CreateAssessmentDto, AssessmentDto } from '@/components/company/assessments/types';
import type { AssessmentRubric } from '@/components/company/rubric/types';

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
