import { createApi } from '@reduxjs/toolkit/query/react';
import { createCustomBaseQuery } from '../api/baseApi';
import type {
  Organization,
  CreateOrganizationInput,
  OrganizationStatus,
  AdminMetrics,
} from '@/types/organization';

/**
 * Cache tags owned and managed by the Platform Admin portal.
 * Admin manages master templates, organizations, platform metrics, audit logs, agents, and quotes.
 */
export const ADMIN_TAG_TYPES = [
  'Session',
  'Templates',
  'Organizations',
  'Metrics',
  'AuditLogs',
  'Agents',
  'Quotes',
] as const;

export type AdminTagType = (typeof ADMIN_TAG_TYPES)[number];

export interface GetOrganizationsResponse {
  organizations: Organization[];
  metrics?: AdminMetrics | undefined;
}

export interface AdminQuoteItem {
  id: string;
  organizationId: string;
  amount: number;
  currency: string;
  status: 'draft' | 'sent' | 'paid' | 'expired';
  createdAt: string;
}

export interface CreateAdminQuoteInput {
  organizationId: string;
  amount: number;
  currency: string;
  notes?: string;
}

/**
 * Platform Admin RTK Query API slice.
 * Operates exclusively within the AdminStore with its own dedicated cache and reducerPath.
 */
export const adminApi = createApi({
  reducerPath: 'adminApi',
  baseQuery: createCustomBaseQuery({ reducerPath: 'adminApi' }),
  tagTypes: ADMIN_TAG_TYPES,
  endpoints: (builder) => ({
    getOrganizations: builder.query<GetOrganizationsResponse, void>({
      query: () => 'admin/organizations',
      providesTags: (result) => {
        const orgs = Array.isArray(result?.organizations)
          ? result.organizations
          : Array.isArray(result)
            ? (result as unknown as Organization[])
            : [];
        return [
          ...orgs.map(({ id }: { id: string }) => ({
            type: 'Organizations' as const,
            id,
          })),
          { type: 'Organizations', id: 'LIST' },
          { type: 'Metrics', id: 'PLATFORM' },
        ];
      },
    }),

    createOrganization: builder.mutation<Organization, CreateOrganizationInput>({
      query: (body) => ({
        url: 'admin/organizations',
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        { type: 'Organizations', id: 'LIST' },
        { type: 'Metrics', id: 'PLATFORM' },
      ],
    }),

    updateOrganizationStatus: builder.mutation<
      Organization,
      { id: string; status: OrganizationStatus }
    >({
      query: (body) => ({
        url: 'admin/organizations',
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Organizations', id },
        { type: 'Organizations', id: 'LIST' },
        { type: 'Metrics', id: 'PLATFORM' },
      ],
    }),

    getQuotes: builder.query<AdminQuoteItem[], void>({
      query: () => 'admin/quotes',
      providesTags: (result) => {
        const quotes = Array.isArray(result)
          ? result
          : (result as { quotes?: AdminQuoteItem[] } | null | undefined)?.quotes ?? [];
        return [
          ...quotes.map(({ id }: { id: string }) => ({
            type: 'Quotes' as const,
            id,
          })),
          { type: 'Quotes', id: 'LIST' },
        ];
      },
    }),

    createQuote: builder.mutation<AdminQuoteItem, CreateAdminQuoteInput>({
      query: (body) => ({
        url: 'admin/quotes',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Quotes', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetOrganizationsQuery,
  useLazyGetOrganizationsQuery,
  useCreateOrganizationMutation,
  useUpdateOrganizationStatusMutation,
  useGetQuotesQuery,
  useLazyGetQuotesQuery,
  useCreateQuoteMutation,
} = adminApi;
