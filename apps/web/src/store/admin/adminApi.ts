import { createApi } from '@reduxjs/toolkit/query/react';
import { createCustomBaseQuery } from '../api/baseApi';
import type {
  Organization,
  CreateOrganizationInput,
  OrganizationStatus,
  AdminMetrics,
} from '@/types/organization';
import type {
  AuditLogQueryDto,
  PaginatedAuditLogDto,
  AuditVerifyResponseDto,
  OrgDetailDto,
  UpdateOrgEntitlementsDto,
  PlatformAiKeyDto,
  CreatePlatformAiKeyDto,
  UpdatePlatformAiKeyDto,
  CreditAllocationDto,
  CreateCreditAllocationDto,
  AdjustCreditAllocationDto,
  PlatformAiVaultStatsDto,
  AdminWorkspaceQueryDto,
  AdminWorkspacesListResponseDto,
  AdminWorkspaceDetailDto,
  EmergencyDestroyResponseDto,
} from '@hs/contracts';

/**
 * Cache tags owned and managed by the Platform Admin portal.
 * Admin manages master templates, organizations, platform metrics, audit logs, agents, quotes, and AI keys.
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
  'AiKeys',
  'AiAllocations',
  'Workspaces',
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

    getOrganizationById: builder.query<OrgDetailDto, string>({
      query: (id) => `admin/organizations/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Organizations', id }],
    }),

    updateOrganizationEntitlements: builder.mutation<
      OrgDetailDto,
      { id: string; entitlements: UpdateOrgEntitlementsDto }
    >({
      query: ({ id, entitlements }) => ({
        url: `admin/organizations/${id}/entitlements`,
        method: 'PATCH',
        body: entitlements,
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

    getAdminAuditLogs: builder.query<PaginatedAuditLogDto, AuditLogQueryDto | void>({
      query: (params) => ({
        url: 'admin/audit',
        params: (params as Record<string, any>) || {},
      }),
      providesTags: (result) =>
        result?.items
          ? [
              ...result.items.map((item) => ({ type: 'AuditLogs' as const, id: item.id })),
              { type: 'AuditLogs', id: 'LIST' },
            ]
          : [{ type: 'AuditLogs', id: 'LIST' }],
    }),

    verifyAdminAuditChain: builder.mutation<AuditVerifyResponseDto, void>({
      query: () => ({
        url: 'admin/audit/verify-chain',
        method: 'POST',
      }),
    }),

    // ==========================================
    // Platform AI Keys Vault & Allocations (AD-023 / AD-024)
    // ==========================================

    getPlatformAiKeys: builder.query<PlatformAiKeyDto[], void>({
      query: () => 'admin/ai-keys',
      providesTags: (result) =>
        result
          ? [
              ...result.map((item) => ({ type: 'AiKeys' as const, id: item.id })),
              { type: 'AiKeys', id: 'LIST' },
            ]
          : [{ type: 'AiKeys', id: 'LIST' }],
    }),

    createPlatformAiKey: builder.mutation<PlatformAiKeyDto, CreatePlatformAiKeyDto>({
      query: (body) => ({
        url: 'admin/ai-keys',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'AiKeys', id: 'LIST' }],
    }),

    updatePlatformAiKey: builder.mutation<PlatformAiKeyDto, { id: string; data: UpdatePlatformAiKeyDto }>({
      query: ({ id, data }) => ({
        url: `admin/ai-keys/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'AiKeys', id },
        { type: 'AiKeys', id: 'LIST' },
      ],
    }),

    revokePlatformAiKey: builder.mutation<PlatformAiKeyDto, string>({
      query: (id) => ({
        url: `admin/ai-keys/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: 'AiKeys', id },
        { type: 'AiKeys', id: 'LIST' },
      ],
    }),

    testPlatformAiKey: builder.mutation<{ success: boolean; message: string; testedAt: string }, string>({
      query: (id) => ({
        url: `admin/ai-keys/${id}/test`,
        method: 'POST',
      }),
      invalidatesTags: (_res, _err, id) => [{ type: 'AiKeys', id }],
    }),

    getCreditAllocations: builder.query<
      CreditAllocationDto[],
      { orgId?: string; platformKeyId?: string; status?: string } | void
    >({
      query: (params) => {
        if (!params) {
          return 'admin/ai-allocations';
        }
        return {
          url: 'admin/ai-allocations',
          params,
        };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map((item) => ({ type: 'AiAllocations' as const, id: item.id })),
              { type: 'AiAllocations', id: 'LIST' },
            ]
          : [{ type: 'AiAllocations', id: 'LIST' }],
    }),

    createCreditAllocation: builder.mutation<CreditAllocationDto, CreateCreditAllocationDto>({
      query: (body) => ({
        url: 'admin/ai-allocations',
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        { type: 'AiAllocations', id: 'LIST' },
        { type: 'AiKeys', id: 'LIST' },
      ],
    }),

    adjustCreditAllocation: builder.mutation<CreditAllocationDto, { id: string; data: AdjustCreditAllocationDto }>({
      query: ({ id, data }) => ({
        url: `admin/ai-allocations/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'AiAllocations', id },
        { type: 'AiAllocations', id: 'LIST' },
      ],
    }),

    revokeCreditAllocation: builder.mutation<CreditAllocationDto, { id: string; reason: string }>({
      query: ({ id, reason }) => ({
        url: `admin/ai-allocations/${id}/revoke`,
        method: 'POST',
        body: { reason },
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'AiAllocations', id },
        { type: 'AiAllocations', id: 'LIST' },
        { type: 'AiKeys', id: 'LIST' },
      ],
    }),

    getAiVaultStats: builder.query<PlatformAiVaultStatsDto, void>({
      query: () => 'admin/ai-vault/stats',
      providesTags: [{ type: 'AiKeys', id: 'LIST' }, { type: 'AiAllocations', id: 'LIST' }],
    }),

    // --- Workspaces Monitoring & Emergency Kill-Switch (S1B-T05-3) ---
    getAdminWorkspaces: builder.query<
      AdminWorkspacesListResponseDto,
      AdminWorkspaceQueryDto | void
    >({
      query: (params) => {
        const urlParams = new URLSearchParams();
        if (params) {
          if (params.org_id) urlParams.set('org_id', params.org_id);
          if (params.status && params.status !== 'all') urlParams.set('status', params.status);
          if (params.mode && params.mode !== 'all') urlParams.set('mode', params.mode);
          if (params.search) urlParams.set('search', params.search);
          if (params.page) urlParams.set('page', String(params.page));
          if (params.page_size) urlParams.set('page_size', String(params.page_size));
        }
        const q = urlParams.toString();
        return `admin/workspaces${q ? `?${q}` : ''}`;
      },
      providesTags: (result) =>
        result
          ? [
              ...result.items.map((item) => ({ type: 'Workspaces' as const, id: item.id })),
              { type: 'Workspaces', id: 'LIST' },
            ]
          : [{ type: 'Workspaces', id: 'LIST' }],
    }),

    getAdminWorkspaceById: builder.query<AdminWorkspaceDetailDto, string>({
      query: (id) => `admin/workspaces/${id}`,
      providesTags: (_res, _err, id) => [{ type: 'Workspaces', id }],
    }),

    emergencyDestroyWorkspace: builder.mutation<
      EmergencyDestroyResponseDto,
      { id: string; reason: string }
    >({
      query: ({ id, reason }) => ({
        url: `admin/workspaces/${id}/destroy`,
        method: 'POST',
        body: { reason },
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Workspaces', id },
        { type: 'Workspaces', id: 'LIST' },
        { type: 'Metrics', id: 'PLATFORM' },
        { type: 'Organizations', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetOrganizationsQuery,
  useLazyGetOrganizationsQuery,
  useGetOrganizationByIdQuery,
  useLazyGetOrganizationByIdQuery,
  useCreateOrganizationMutation,
  useUpdateOrganizationStatusMutation,
  useUpdateOrganizationEntitlementsMutation,
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
  useGetAdminAuditLogsQuery,
  useLazyGetAdminAuditLogsQuery,
  useVerifyAdminAuditChainMutation,
  useGetPlatformAiKeysQuery,
  useLazyGetPlatformAiKeysQuery,
  useCreatePlatformAiKeyMutation,
  useUpdatePlatformAiKeyMutation,
  useRevokePlatformAiKeyMutation,
  useTestPlatformAiKeyMutation,
  useGetCreditAllocationsQuery,
  useLazyGetCreditAllocationsQuery,
  useCreateCreditAllocationMutation,
  useAdjustCreditAllocationMutation,
  useRevokeCreditAllocationMutation,
  useGetAiVaultStatsQuery,
  useLazyGetAiVaultStatsQuery,
  useGetAdminWorkspacesQuery,
  useLazyGetAdminWorkspacesQuery,
  useGetAdminWorkspaceByIdQuery,
  useLazyGetAdminWorkspaceByIdQuery,
  useEmergencyDestroyWorkspaceMutation,
} = adminApi;
