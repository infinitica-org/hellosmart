import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import AdminLayout from '@/app/(admin)/admin/layout';
import CompanyLayout from '@/app/(company)/company/layout';
import CandidateLayout from '@/app/(candidate)/candidate/layout';
import { useAdminSelector, useCompanySelector, useCandidateSelector } from '@/store/hooks';

// Mock usePortalAuth to simulate authenticated sessions
vi.mock('@/hooks/use-portal-auth', () => ({
  usePortalAuth: vi.fn(),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/admin',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { usePortalAuth } from '@/hooks/use-portal-auth';

describe('S1-T00-1: Layout Provider Integration (Criterion 10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AdminLayout mounts AdminStoreProvider so nested components can use useAdminSelector', () => {
    (usePortalAuth as any).mockReturnValue({
      user: { id: 'adm_1', email: 'admin@hellosmart.ai', name: 'Super Admin', role: 'platform_admin' },
      loading: false,
      signOut: vi.fn(),
    });

    let accessedState: any = null;
    function AdminChild() {
      const state = useAdminSelector((s) => s);
      accessedState = state;
      return <div data-testid="admin-child">Admin Content</div>;
    }

    const layoutElement = AdminLayout({
      children: <AdminChild />,
    });

    expect(layoutElement).toBeDefined();
    // Layout element type is AdminStoreProvider
    expect(layoutElement.type.name).toBe('AdminStoreProvider');
  });

  it('CompanyLayout mounts CompanyStoreProvider so nested components can use useCompanySelector', () => {
    (usePortalAuth as any).mockReturnValue({
      user: { id: 'cmp_1', email: 'admin@company.com', name: 'Company Admin', role: 'company_admin', org: { id: 'org_1', name: 'Acme Corp' } },
      loading: false,
      signOut: vi.fn(),
    });

    function CompanyChild() {
      const state = useCompanySelector((s) => s);
      return <div data-testid="company-child">Company Content</div>;
    }

    const layoutElement = CompanyLayout({
      children: <CompanyChild />,
    });

    expect(layoutElement).toBeDefined();
    expect(layoutElement.type.name).toBe('CompanyStoreProvider');
  });

  it('CandidateLayout mounts CandidateStoreProvider so nested components can use useCandidateSelector', () => {
    (usePortalAuth as any).mockReturnValue({
      user: { id: 'cnd_1', email: 'dev@candidate.com', name: 'Candidate User', role: 'candidate' },
      loading: false,
      signOut: vi.fn(),
    });

    function CandidateChild() {
      const state = useCandidateSelector((s) => s);
      return <div data-testid="candidate-child">Candidate Content</div>;
    }

    const layoutElement = CandidateLayout({
      children: <CandidateChild />,
    });

    expect(layoutElement).toBeDefined();
    expect(layoutElement.type.name).toBe('CandidateStoreProvider');
  });
});

