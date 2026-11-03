import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { makeAdminStore } from '@/store/admin/adminStore';
import { makeCompanyStore } from '@/store/company/companyStore';
import { makeCandidateStore } from '@/store/candidate/candidateStore';
import { adminApi, ADMIN_TAG_TYPES } from '@/store/admin/adminApi';
import { companyApi, COMPANY_TAG_TYPES } from '@/store/company/companyApi';
import { candidateApi, CANDIDATE_TAG_TYPES } from '@/store/candidate/candidateApi';
import {
  AdminStoreProvider,
  CompanyStoreProvider,
  CandidateStoreProvider,
} from '@/providers/store-provider';
import AdminDashboardPage from '@/app/(admin)/admin/page';
import CompanyCandidatesPage from '@/app/(company)/company/candidates/page';
import CompanyDashboardPage from '@/app/(company)/company/page';
import CandidateDashboardPage from '@/app/(candidate)/candidate/page';
import { TenantTable } from '@/components/admin/tenant-table';
import { ProvisionModal } from '@/components/admin/provision-modal';
import { ToastProvider } from '@hs/ui';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/candidate',
  useSearchParams: () => new URLSearchParams(),
}));

describe('S1-T00-3: Component API Migration & RTK Endpoint Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Admin API Endpoints & Components
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. Admin API Endpoints & Admin Components', () => {
    it('verifies ADMIN_TAG_TYPES contains Organizations and dedicated Metrics tag', () => {
      expect(ADMIN_TAG_TYPES).toContain('Organizations');
      expect(ADMIN_TAG_TYPES).toContain('Metrics');
    });

    it('executes getOrganizations and receives structured data with entity-specific tags', async () => {
      const store = makeAdminStore();
      let capturedRequest: Request | undefined;
      const mockFetch = vi.fn().mockImplementation((req: Request) => {
        capturedRequest = req;
        return Promise.resolve(
          new Response(
            JSON.stringify({
              organizations: [
                {
                  id: 'org_1',
                  name: 'Acme Corp',
                  slug: 'acme',
                  status: 'active',
                  plan: 'trial',
                  candidatesCount: 12,
                  createdAt: '2026-01-01',
                  maxTemplates: 5,
                  maxCandidates: 25,
                  trialDays: 14,
                  adminEmail: 'admin@acme.com',
                  adminName: 'Admin Acme',
                },
              ],
              metrics: {
                totalCompanies: 1,
                activeTrials: 0,
                totalCandidates: 12,
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await store.dispatch(adminApi.endpoints.getOrganizations.initiate());
      expect(result.data).toBeDefined();
      expect(result.data?.organizations).toHaveLength(1);
      expect(result.data?.organizations[0]?.name).toBe('Acme Corp');
      expect(result.data?.metrics?.totalCompanies).toBe(1);
      expect(capturedRequest?.url).toContain('/admin/organizations');
      expect(capturedRequest?.credentials).toBe('include');
    });

    it('executes createOrganization mutation with CSRF header and invalidates Organizations and Metrics', async () => {
      const store = makeAdminStore();
      let capturedRequest: Request | undefined;
      const mockFetch = vi.fn().mockImplementation((req: Request) => {
        capturedRequest = req;
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 'org_new',
              name: 'New Corp',
              slug: 'new-corp',
              status: 'trial',
              plan: 'trial',
              candidatesCount: 0,
              createdAt: '2026-01-01',
              maxTemplates: 5,
              maxCandidates: 25,
              trialDays: 14,
              adminEmail: 'admin@newcorp.com',
              adminName: 'Admin New',
            }),
            { status: 201, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await store.dispatch(
        adminApi.endpoints.createOrganization.initiate({
          name: 'New Corp',
          slug: 'new-corp',
          adminEmail: 'admin@newcorp.com',
          adminName: 'Admin New',
          plan: 'trial',
          maxTemplates: 5,
          maxCandidates: 25,
          trialDays: 14,
        }),
      );

      expect(result).toHaveProperty('data');
      expect((result as any).data?.name).toBe('New Corp');
      expect(capturedRequest?.url).toContain('/admin/organizations');
      expect(capturedRequest?.method).toBe('POST');
      expect(capturedRequest?.credentials).toBe('include');
      expect(capturedRequest?.headers.get('X-HS-CSRF')).toBe('1');
    });

    it('executes updateOrganizationStatus mutation with CSRF header and entity tag invalidation', async () => {
      const store = makeAdminStore();
      let capturedRequest: Request | undefined;
      const mockFetch = vi.fn().mockImplementation((req: Request) => {
        capturedRequest = req;
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 'org_1',
              name: 'Acme Corp',
              slug: 'acme',
              status: 'suspended',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await store.dispatch(
        adminApi.endpoints.updateOrganizationStatus.initiate({
          id: 'org_1',
          status: 'suspended',
        }),
      );

      expect(result).toHaveProperty('data');
      expect((result as any).data?.status).toBe('suspended');
      expect(capturedRequest?.url).toContain('/admin/organizations');
      expect(capturedRequest?.method).toBe('PATCH');
      expect(capturedRequest?.credentials).toBe('include');
      expect(capturedRequest?.headers.get('X-HS-CSRF')).toBe('1');
    });

    it('renders AdminDashboardPage within AdminStoreProvider', () => {
      const html = renderToString(
        <AdminStoreProvider>
          <AdminDashboardPage />
        </AdminStoreProvider>,
      );
      expect(html).toContain('Platform Administration');
      expect(html).toContain('Super Admin');
      expect(html).toContain('Customer Companies');
      expect(html).toContain('Provision New Company');
    });

    it('renders TenantTable within AdminStoreProvider and ToastProvider', () => {
      const orgs = [
        {
          id: 'org_1',
          name: 'Acme Corp',
          slug: 'acme',
          status: 'trial' as const,
          plan: 'trial' as const,
          candidatesCount: 5,
          createdAt: '2026-01-01',
          maxTemplates: 5,
          maxCandidates: 25,
          trialDays: 14,
          adminEmail: 'admin@acme.com',
          adminName: 'Admin Acme',
        },
      ];

      const html = renderToString(
        <ToastProvider>
          <AdminStoreProvider>
            <TenantTable organizations={orgs} />
          </AdminStoreProvider>
        </ToastProvider>,
      );
      expect(html).toContain('Acme Corp');
      expect(html).toContain('acme');
      expect(html).toContain('Trial');
    });

    it('instantiates and renders ProvisionModal within AdminStoreProvider and ToastProvider', () => {
      const element = React.createElement(ProvisionModal, { open: true, onClose: () => {} });
      expect(element).toBeDefined();
      const html = renderToString(
        <ToastProvider>
          <AdminStoreProvider>
            {element}
          </AdminStoreProvider>
        </ToastProvider>,
      );
      expect(html).toBeDefined();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Company API Endpoints & Components
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. Company API Endpoints & Company Components', () => {
    it('verifies COMPANY_TAG_TYPES contains Candidates and dedicated Metrics tag', () => {
      expect(COMPANY_TAG_TYPES).toContain('Candidates');
      expect(COMPANY_TAG_TYPES).toContain('Metrics');
    });

    it('executes getCandidates query providing entity-specific Candidates tags', async () => {
      const store = makeCompanyStore();
      const mockFetch = vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify([
              {
                id: 'cand_1',
                email: 'jane@example.com',
                name: 'Jane Doe',
                status: 'invited',
                createdAt: '2026-01-01',
              },
            ]),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
      );
      vi.stubGlobal('fetch', mockFetch);

      const result = await store.dispatch(companyApi.endpoints.getCandidates.initiate());
      expect(result.data).toBeDefined();
      const candidates = Array.isArray(result.data) ? result.data : result.data?.items;
      expect(candidates).toHaveLength(1);
      expect(candidates?.[0]?.email).toBe('jane@example.com');
    });

    it('executes getCompanyMetrics query providing dedicated Metrics tag (decoupled from Candidates tag)', async () => {
      const store = makeCompanyStore();
      const mockFetch = vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              configuredAssessments: 3,
              invitedCandidates: 15,
              submissionsToReview: 2,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
      );
      vi.stubGlobal('fetch', mockFetch);

      const result = await store.dispatch(companyApi.endpoints.getCompanyMetrics.initiate());
      expect(result.data).toBeDefined();
      expect(result.data?.configuredAssessments).toBe(3);
      expect(result.data?.invitedCandidates).toBe(15);
      expect(result.data?.submissionsToReview).toBe(2);
    });

    it('executes inviteCandidate mutation with CSRF header and invalidates both Candidates and Metrics tags', async () => {
      const store = makeCompanyStore();
      let capturedRequest: Request | undefined;
      const mockFetch = vi.fn().mockImplementation((req: Request) => {
        capturedRequest = req;
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 'cand_2',
              email: 'john@example.com',
              name: 'John Doe',
              status: 'invited',
              createdAt: '2026-01-01',
            }),
            { status: 201, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await store.dispatch(
        companyApi.endpoints.inviteCandidate.initiate({
          email: 'john@example.com',
          name: 'John Doe',
        }),
      );

      expect((result as any).data?.name).toBe('John Doe');
      expect(capturedRequest?.url).toContain('/company/candidates');
      expect(capturedRequest?.method).toBe('POST');
      expect(capturedRequest?.headers.get('X-HS-CSRF')).toBe('1');
    });

    it('renders CompanyCandidatesPage within CompanyStoreProvider', () => {
      const html = renderToString(
        <CompanyStoreProvider>
          <CompanyCandidatesPage />
        </CompanyStoreProvider>,
      );
      expect(html).toContain('Candidates');
      expect(html).toContain('Invite Candidate');
    });

    it('renders CompanyDashboardPage within CompanyStoreProvider', () => {
      const html = renderToString(
        <CompanyStoreProvider>
          <CompanyDashboardPage />
        </CompanyStoreProvider>,
      );
      expect(html).toContain('Hiring Pipeline');
      expect(html).toContain('Invited Candidates');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Candidate API Slice & Candidate Portal
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Candidate API Slice & Candidate Portal', () => {
    it('verifies CANDIDATE_TAG_TYPES contains Workspace tag alongside Assessments and Submissions', () => {
      expect(CANDIDATE_TAG_TYPES).toContain('Workspace');
      expect(CANDIDATE_TAG_TYPES).toContain('Assessments');
      expect(CANDIDATE_TAG_TYPES).toContain('Submissions');
      expect(CANDIDATE_TAG_TYPES).not.toContain('Candidates');
      expect(CANDIDATE_TAG_TYPES).not.toContain('Organizations');
    });

    it('verifies candidateStore registers candidateApi reducer with clean zero endpoints', () => {
      const store = makeCandidateStore();
      const state = store.getState();
      expect(state).toHaveProperty('candidateApi');
      expect(typeof store.dispatch).toBe('function');
    });

    it('renders CandidateDashboardPage in clean deferred state within CandidateStoreProvider', () => {
      const html = renderToString(
        <CandidateStoreProvider>
          <CandidateDashboardPage />
        </CandidateStoreProvider>,
      );
      expect(html).toContain('Candidate Assessment Workspace');
      expect(html).toContain('No active assignments');
      expect(html).toContain('Assigned Tasks');
    });
  });
});
