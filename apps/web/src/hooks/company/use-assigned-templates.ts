'use client';

import {
  useGetCompanyTemplatesQuery,
  useGetTemplateByIdQuery,
} from '@/store/company/companyApi';
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
 * Centralized via RTK Query companyApi slice.
 */
export function useTemplateDetail(templateId: string | null | undefined) {
  const { data, isLoading, isError, error, refetch } = useGetTemplateByIdQuery(
    templateId ?? '',
    { skip: !templateId },
  );

  const normalizedError = error
    ? new Error(
        (error as any)?.data?.message ||
          (error as any)?.data?.detail ||
          (error as any)?.message ||
          'Failed to load template.',
      )
    : null;

  return {
    data: data as RoleTemplateDetail | undefined,
    isLoading,
    isError,
    error: normalizedError,
    refetch: () => void refetch(),
  };
}
