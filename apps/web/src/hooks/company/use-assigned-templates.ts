'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchAssignedTemplates, fetchTemplateById } from '@/lib/company-api';
import { ApiError } from '@/lib/api-client';
import { usePortalAuth } from '@/hooks/use-portal-auth';
import type { RoleTemplateSummary, RoleTemplateDetail } from '@/components/company/templates/types';

/**
 * Hook to retrieve all role simulation templates assigned to the current organization.
 * Query key scopes by orgId to prevent cache leakage across tenants (BR-01, BR-02).
 */
export function useAssignedTemplates() {
  const { user } = usePortalAuth();
  const orgId = user?.org?.id ?? 'current';

  return useQuery<RoleTemplateSummary[], Error>({
    queryKey: ['company', orgId, 'templates'],
    queryFn: () => fetchAssignedTemplates(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error) => {
      // Never repeatedly retry client auth, forbidden, or unassigned not found errors
      if (
        error instanceof ApiError &&
        (error.status === 401 || error.status === 403 || error.status === 404)
      ) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

/**
 * Hook to retrieve full specification for a single template on-demand.
 * Query only executes when templateId is provided and valid.
 */
export function useTemplateDetail(templateId: string | null | undefined) {
  const { user } = usePortalAuth();
  const orgId = user?.org?.id ?? 'current';

  return useQuery<RoleTemplateDetail, Error>({
    queryKey: ['company', orgId, 'template', templateId],
    queryFn: () => {
      if (!templateId) {
        throw new Error('Template ID is required');
      }
      return fetchTemplateById(templateId);
    },
    enabled: Boolean(templateId),
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: (failureCount, error) => {
      if (
        error instanceof ApiError &&
        (error.status === 401 || error.status === 403 || error.status === 404)
      ) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

