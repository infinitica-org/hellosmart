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
  'Leads',
  'PricingCatalog',
  'PromoCodes',
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

export interface MfaStatus {
  enrolled: boolean;
  backupCodesRemaining: number;
}

export interface MfaSetupStartResponse {
  secret?: string;
  otpauthUri?: string;
}

export interface MfaSetupConfirmResponse {
  backupCodes?: string[];
}

export interface MfaRegenerateBackupCodesResponse {
  backupCodes?: string[];
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

    getQuotes: builder.query<any[], { leadId?: string; orgId?: string; status?: string } | void>({
      query: (filter) => {
        const params = new URLSearchParams();
        if (filter?.leadId) params.set('leadId', filter.leadId);
        if (filter?.orgId) params.set('orgId', filter.orgId);
        if (filter?.status) params.set('status', filter.status);
        const q = params.toString();
        return `admin/quotes${q ? `?${q}` : ''}`;
      },
      providesTags: (result) => {
        const quotes = Array.isArray(result) ? result : [];
        return [
          ...quotes.map(({ id }: { id: string }) => ({
            type: 'Quotes' as const,
            id,
          })),
          { type: 'Quotes', id: 'LIST' },
        ];
      },
    }),

    getQuoteById: builder.query<any, string>({
      query: (id) => `admin/quotes/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Quotes', id }],
    }),

    createQuote: builder.mutation<any, any>({
      query: (body) => ({
        url: 'admin/quotes',
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        { type: 'Quotes', id: 'LIST' },
        { type: 'Leads', id: 'LIST' },
      ],
    }),

    sendQuoteEmail: builder.mutation<
      { success: boolean; quoteNumber: string; recipientEmail: string; sentAt: string },
      { quoteId: string; publicToken?: string; recipientEmail?: string }
    >({
      query: ({ quoteId, publicToken, recipientEmail }) => ({
        url: `admin/quotes/${quoteId}/send`,
        method: 'POST',
        body: { publicToken, recipientEmail },
      }),
      invalidatesTags: (_result, _error, { quoteId }) => [
        { type: 'Quotes', id: quoteId },
        { type: 'Quotes', id: 'LIST' },
      ],
    }),

    // --- Pricing Catalog ---
    getPricingCatalog: builder.query<
      any[],
      { isActive?: boolean; category?: string; currency?: string } | void
    >({
      query: (filter) => {
        const params = new URLSearchParams();
        if (filter?.isActive !== undefined) params.set('isActive', String(filter.isActive));
        if (filter?.category) params.set('category', filter.category);
        if (filter?.currency) params.set('currency', filter.currency);
        const q = params.toString();
        return `admin/pricing-catalog${q ? `?${q}` : ''}`;
      },
      providesTags: (result) => {
        const items = Array.isArray(result) ? result : [];
        return [
          ...items.map(({ id }: { id: string }) => ({
            type: 'PricingCatalog' as const,
            id,
          })),
          { type: 'PricingCatalog', id: 'LIST' },
        ];
      },
    }),

    createPricingCatalogItem: builder.mutation<any, any>({
      query: (body) => ({
        url: 'admin/pricing-catalog',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'PricingCatalog', id: 'LIST' }],
    }),

    updatePricingCatalogItem: builder.mutation<any, { id: string; data: any }>({
      query: ({ id, data }) => ({
        url: `admin/pricing-catalog/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'PricingCatalog', id },
        { type: 'PricingCatalog', id: 'LIST' },
      ],
    }),

    activatePricingCatalogItem: builder.mutation<any, string>({
      query: (id) => ({
        url: `admin/pricing-catalog/${id}/activate`,
        method: 'POST',
        body: {},
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'PricingCatalog', id },
        { type: 'PricingCatalog', id: 'LIST' },
      ],
    }),

    deactivatePricingCatalogItem: builder.mutation<any, string>({
      query: (id) => ({
        url: `admin/pricing-catalog/${id}/deactivate`,
        method: 'POST',
        body: {},
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'PricingCatalog', id },
        { type: 'PricingCatalog', id: 'LIST' },
      ],
    }),

    // --- Promo Codes ---
    getPromoCodes: builder.query<any[], void>({
      query: () => 'admin/promo-codes',
      providesTags: (result) => {
        const codes = Array.isArray(result) ? result : [];
        return [
          ...codes.map(({ id }: { id: string }) => ({
            type: 'PromoCodes' as const,
            id,
          })),
          { type: 'PromoCodes', id: 'LIST' },
        ];
      },
    }),

    createPromoCode: builder.mutation<any, any>({
      query: (body) => ({
        url: 'admin/promo-codes',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'PromoCodes', id: 'LIST' }],
    }),

    // --- Leads ---
    getLeads: builder.query<any[], { stage?: string; search?: string; orgId?: string } | void>({
      query: (filter) => {
        const params = new URLSearchParams();
        if (filter?.stage) params.set('stage', filter.stage);
        if (filter?.search) params.set('search', filter.search);
        if (filter?.orgId) params.set('orgId', filter.orgId);
        const q = params.toString();
        return `admin/leads${q ? `?${q}` : ''}`;
      },
      providesTags: (result) => {
        const leads = Array.isArray(result) ? result : [];
        return [
          ...leads.map(({ id }: { id: string }) => ({
            type: 'Leads' as const,
            id,
          })),
          { type: 'Leads', id: 'LIST' },
        ];
      },
    }),

    getLeadById: builder.query<any, string>({
      query: (id) => `admin/leads/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Leads', id }],
    }),

    // --- GST Calculator ---
    calculateGst: builder.mutation<any, any>({
      query: (body) => ({
        url: 'admin/gst/calculate',
        method: 'POST',
        body,
      }),
    }),

    // --- MFA & Security ---
    getMfaStatus: builder.query<MfaStatus, void>({
      query: () => 'auth/mfa/status',
      providesTags: [{ type: 'Session', id: 'MFA' }],
    }),

    startMfaSetup: builder.mutation<MfaSetupStartResponse, void>({
      query: () => ({
        url: 'auth/mfa/setup/start',
        method: 'POST',
      }),
    }),

    confirmMfaSetup: builder.mutation<MfaSetupConfirmResponse, { totpCode: string }>({
      query: (body) => ({
        url: 'auth/mfa/setup/confirm',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Session', id: 'MFA' }],
    }),

    regenerateBackupCodes: builder.mutation<MfaRegenerateBackupCodesResponse, { totpCode: string }>({
      query: (body) => ({
        url: 'auth/mfa/backup-codes/regenerate',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Session', id: 'MFA' }],
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
  useGetQuoteByIdQuery,
  useLazyGetQuoteByIdQuery,
  useCreateQuoteMutation,
  useSendQuoteEmailMutation,
  useGetPricingCatalogQuery,
  useLazyGetPricingCatalogQuery,
  useCreatePricingCatalogItemMutation,
  useUpdatePricingCatalogItemMutation,
  useActivatePricingCatalogItemMutation,
  useDeactivatePricingCatalogItemMutation,
  useGetPromoCodesQuery,
  useLazyGetPromoCodesQuery,
  useCreatePromoCodeMutation,
  useGetLeadsQuery,
  useLazyGetLeadsQuery,
  useGetLeadByIdQuery,
  useLazyGetLeadByIdQuery,
  useCalculateGstMutation,
  useGetMfaStatusQuery,
  useLazyGetMfaStatusQuery,
  useStartMfaSetupMutation,
  useConfirmMfaSetupMutation,
  useRegenerateBackupCodesMutation,
} = adminApi;
