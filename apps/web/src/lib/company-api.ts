import { apiFetch, getApiBaseUrl, ApiError } from './api-client';
import type { RoleTemplateSummary, RoleTemplateDetail } from '@/components/company/templates/types';
import type { CreateAssessmentDto, AssessmentDto } from '@/components/company/assessments/types';

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
