import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { makeAdminStore } from '@/store/admin/adminStore';
import * as adminApiModule from '@/store/admin/adminApi';
import { adminApi, ADMIN_TAG_TYPES } from '@/store/admin/adminApi';
import { AdminStoreProvider } from '@/providers/store-provider';
import { TenantDetailDrawer } from '@/components/admin/tenant-detail-drawer';
import { TenantTable } from '@/components/admin/tenant-table';
import AdminOrganizationsRedirectPage from '@/app/(admin)/admin/organizations/page';
import * as navigation from 'next/navigation';
import type { Organization } from '@/types/organization';
import type { OrgDetailDto } from '@hs/contracts';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/admin/companies',
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}));

// Mock Drawer to render inline for server-side testing without browser DOM portal
vi.mock('@hs/ui', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    useToast: () => ({ toast: vi.fn(), dismiss: vi.fn(), toasts: [] }),
    DropdownMenu: ({ children }: any) => <div>{children}</div>,
    DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
    DropdownMenuContent: ({ children }: any) => <div data-testid="dropdown-menu-content">{children}</div>,
    DropdownMenuItem: ({ children, onClick, 'data-testid': testId }: any) => (
      <button data-testid={testId} onClick={onClick}>
        {children}
      </button>
    ),
    Drawer: ({ open, children, title, description, 'data-testid': testId }: any) =>
      open ? (
        <div data-testid={testId || 'drawer'}>
          <div data-testid="drawer-title">{title}</div>
          <div data-testid="drawer-desc">{description}</div>
          <div data-testid="drawer-body">{children}</div>
        </div>
      ) : null,
    AlertDialog: ({ open, title, description, confirmLabel, cancelLabel, 'data-testid': testId }: any) =>
      open ? (
        <div data-testid={testId || 'alert-dialog'}>
          <div data-testid="alert-title">{title}</div>
          <div data-testid="alert-desc">{description}</div>
          <button data-testid="alert-confirm">{confirmLabel}</button>
          <button data-testid="alert-cancel">{cancelLabel}</button>
        </div>
      ) : null,
  };
});

describe('Tenant Organization Governance & Entitlement Modifier UI (S1B-T05-1)', () => {
  const mockOrg: Organization = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    name: 'Aster Ridge Inc.',
    slug: 'aster-ridge',
    status: 'active',
    plan: 'pro',
    candidatesCount: 15,
    createdAt: '2026-09-15T08:00:00.000Z',
    adminEmail: 'admin@asterridge.com',
    adminName: 'Jane Aster',
    maxTemplates: 10,
    maxCandidates: 50,
    trialDays: 14,
  };

  const mockOrgDetail: OrgDetailDto = {
    id: mockOrg.id,
    name: mockOrg.name,
    slug: mockOrg.slug,
    status: 'active',
    planId: 'plan_pro',
    logoUrl: null,
    whiteLabel: false,
    customDomain: 'careers.asterridge.com',
    retentionDays: 90,
    createdAt: '2026-09-15T08:00:00.000Z',
    updatedAt: '2026-09-15T08:00:00.000Z',
    entitlements: {
      orgId: mockOrg.id,
      maxTemplates: 10,
      maxCandidates: 50,
      trialEndsAt: null,
      pendingInviteMultiplier: 2.0,
      flags: {
        cloud: true,
        chat: true,
        local: false,
        browser: false,
        white_label: false,
        custom_domain: false,
        managed_ai_credits: false,
        extra_agents: false,
      },
      updatedAt: '2026-09-15T08:00:00.000Z',
    },
    primaryAdmin: {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Jane Aster',
      email: 'admin@asterridge.com',
    },
    stats: {
      candidateCount: 15,
      assessmentCount: 4,
      activeWorkspacesCount: 1,
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('verifies ADMIN_TAG_TYPES contains Organizations cache tag', () => {
    expect(ADMIN_TAG_TYPES).toContain('Organizations');
  });

  it('verifies adminApi registers getOrganizationById and updateOrganizationEntitlements endpoints', () => {
    expect(adminApi.endpoints.getOrganizationById).toBeDefined();
    expect(adminApi.endpoints.updateOrganizationEntitlements).toBeDefined();
  });

  describe('TenantDetailDrawer component', () => {
    it('renders closed drawer cleanly when open is false', () => {
      const store = makeAdminStore();
      const html = renderToString(
        <AdminStoreProvider store={store}>
          <TenantDetailDrawer
            orgId={mockOrg.id}
            open={false}
            onClose={() => {}}
          />
        </AdminStoreProvider>,
      );
      expect(html).not.toContain('data-testid="tenant-detail-drawer"');
    });

    it('renders drawer header, telemetry indicators, governance buttons, and entitlement fields when open', () => {
      vi.spyOn(adminApiModule, 'useGetOrganizationByIdQuery').mockReturnValue({
        data: mockOrgDetail,
        isLoading: false,
        isFetching: false,
        isSuccess: true,
        isError: false,
        refetch: vi.fn(),
      } as any);

      const store = makeAdminStore();
      const html = renderToString(
        <AdminStoreProvider store={store}>
          <TenantDetailDrawer
            orgId={mockOrg.id}
            open={true}
            onClose={() => {}}
          />
        </AdminStoreProvider>,
      );

      expect(html).toContain('data-testid="tenant-detail-drawer"');
      expect(html).toContain('Inspect tenant governance settings, active usage metrics, and modify runtime entitlements (BR-05).');

      // Enforced Quotas section
      expect(html).toContain('Enforced Resource Quotas (BR-05)');
      expect(html).toContain('Actively Enforced');
      expect(html).toContain('These 4 resource quotas are strictly enforced on the server');
      expect(html).toContain('data-testid="max-templates-input"');
      expect(html).toContain('data-testid="max-candidates-input"');
      expect(html).toContain('data-testid="pending-multiplier-input"');
      expect(html).toContain('data-testid="trial-ends-input"');

      // Persisted Feature Flags section (Metadata Only)
      expect(html).toContain('Persisted Configuration Flags (Metadata Only)');
      expect(html).toContain('Not Runtime Enforced');
      expect(html).toContain('Configuration Metadata Only — No Runtime Enforcement');
      expect(html).toContain('no runtime enforcement or access gating effect');

      // All 8 metadata flags rendered with "Metadata Only" badges
      expect(html).toContain('Cloud VM Workspace');
      expect(html).toContain('Chat Workspace');
      expect(html).toContain('Local Workspace');
      expect(html).toContain('Browser Workspace');
      expect(html).toContain('White Label Branding');
      expect(html).toContain('Custom Domain Routing');
      expect(html).toContain('Managed AI Credits');
      expect(html).toContain('Extra Reviewer Agents');
      expect(html).toContain('Metadata Only');

      expect(html).toContain('data-testid="reset-entitlements-btn"');
      expect(html).toContain('data-testid="save-entitlements-btn"');
    });
  });

  describe('TenantTable component integration', () => {
    it('renders company row with inspect triggers and action menu', () => {
      const store = makeAdminStore();
      const onInspect = vi.fn();
      const html = renderToString(
        <AdminStoreProvider store={store}>
          <TenantTable
            organizations={[mockOrg]}
            onInspectOrg={onInspect}
          />
        </AdminStoreProvider>,
      );

      expect(html).toContain('data-testid="tenant-row-aster-ridge"');
      expect(html).toContain('data-testid="tenant-name-aster-ridge"');
      expect(html).toContain('Aster Ridge Inc.');
      expect(html).toContain('admin@asterridge.com');
      expect(html).toContain('data-testid="tenant-status-aster-ridge"');
      expect(html).toContain('data-testid="tenant-actions-aster-ridge"');
      expect(html).toContain('data-testid="inspect-btn-aster-ridge"');
      expect(html).toContain('Inspect &amp; Entitlements');
    });
  });

  describe('Canonical route redirect', () => {
    it('redirects /admin/organizations to canonical /admin/companies', () => {
      AdminOrganizationsRedirectPage();
      expect(navigation.redirect).toHaveBeenCalledWith('/admin/companies');
    });
  });
});
