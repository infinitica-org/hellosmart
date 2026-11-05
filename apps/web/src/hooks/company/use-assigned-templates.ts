'use client';

import { useGetCompanyTemplatesQuery } from '@/store/company/companyApi';
import { fetchTemplateById } from '@/lib/company-api';
import { useQuery } from '@tanstack/react-query';
import { usePortalAuth } from '@/hooks/use-portal-auth';
import type { RoleTemplateSummary, RoleTemplateDetail } from '@/components/company/templates/types';

/**
 * Hook to retrieve all role simulation templates assigned to the current organization.
 * Centralized via RTK Query companyApi slice.
 */
export function useAssignedTemplates() {
  const {
    data: templates = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useGetCompanyTemplatesQuery();

  const normalizedError = error
    ? new Error((error as any)?.message || 'Failed to load templates.')
    : null;

  return {
    data: templates as RoleTemplateSummary[],
    isLoading,
    isError,
    error: normalizedError,
    refetch: () => void refetch(),
  };
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
  });
}
