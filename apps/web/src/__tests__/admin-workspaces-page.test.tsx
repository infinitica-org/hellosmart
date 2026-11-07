import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { makeAdminStore } from '@/store/admin/adminStore';
import { adminApi, ADMIN_TAG_TYPES } from '@/store/admin/adminApi';
import { AdminStoreProvider } from '@/providers/store-provider';
import AdminWorkspacesPage from '@/app/(admin)/admin/workspaces/page';
import { WorkspaceMetricsCards } from '@/components/admin/workspaces/workspace-metrics-cards';
import { WorkspaceTable } from '@/components/admin/workspaces/workspace-table';
import { WorkspaceDetailDrawer } from '@/components/admin/workspaces/workspace-detail-drawer';
import { EmergencyDestroyModal } from '@/components/admin/workspaces/emergency-destroy-modal';
import type { AdminWorkspaceListItemDto, AdminWorkspacesMetrics } from '@hs/contracts';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/admin/workspaces',
  useSearchParams: () => new URLSearchParams(),
}));

const mockMetrics: AdminWorkspacesMetrics = {
  totalWorkspaces: 14,
  activeWorkspaces: 6,
  connectedCount: 4,
  disconnectedCount: 2,
  destroyedCount: 1,
  endedCount: 7,
  trackedTenantsCount: 5,
};

const mockItem: AdminWorkspaceListItemDto = {
  id: '88888888-8888-4888-8888-888888888881',
  orgId: '22222222-2222-4222-8222-222222222222',
  orgName: 'Acme Corp',
  orgSlug: 'acme-corp',
  candidateId: '33333333-3333-4333-8333-333333333331',
  candidateName: 'Alex Rivera',
  candidateEmail: 'alex.rivera@example.test',
  assignmentId: '44444444-4444-4444-8444-444444444441',
  assessmentId: '55555555-5555-4555-8555-555555555551',
  assessmentName: 'Senior Backend Engineer Challenge',
  mode: 'cloud',
  status: 'connected',
  runtimeRef: 'hs-container-vm-101',
  snapshotRef: 's3://snapshots/ws-8881.tar.gz',
  startedAt: new Date(Date.now() - 3600000).toISOString(),
  lastActivityAt: new Date(Date.now() - 120000).toISOString(),
  disconnectedAt: null,
  endedAt: null,
  deadlineAt: new Date(Date.now() + 7200000).toISOString(),
  idleMinutes: 2,
  isOnline: true,
  spendInfo: {
    meteringStatus: 'unconnected',
    meteringNotice: 'AI proxy runtime metering unconnected',
    allocatedAmountCents: 25000,
    usedAmountCents: 0,
    balanceCents: 25000,
    markupPercentage: 15.0,
    spendCapCents: 50000,
  },
};

describe('Admin Workspaces Monitoring & Emergency Kill-Switch UI (S1B-T05-3)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('RTK Query Tags & Endpoints', () => {
    it('registers Workspaces in ADMIN_TAG_TYPES', () => {
      expect(ADMIN_TAG_TYPES).toContain('Workspaces');
    });

    it('registers all required workspace monitoring endpoints on adminApi', () => {
      expect(adminApi.endpoints.getAdminWorkspaces).toBeDefined();
      expect(adminApi.endpoints.getAdminWorkspaceById).toBeDefined();
      expect(adminApi.endpoints.emergencyDestroyWorkspace).toBeDefined();
    });
  });

  describe('WorkspaceMetricsCards', () => {
    it('renders aggregate KPI counts properly', () => {
      const html = renderToString(
        <WorkspaceMetricsCards metrics={mockMetrics} isLoading={false} />,
      );

      expect(html).toContain('Total Workspaces');
      expect(html).toContain('14');
      expect(html).toContain('Active Sessions');
      expect(html).toContain('6');
      expect(html).toContain('Connected Now');
      expect(html).toContain('4');
      expect(html).toContain('Destroyed / Killed');
      expect(html).toContain('1');
      expect(html).toContain('Tracked Tenants');
      expect(html).toContain('5');
    });
  });

  describe('WorkspaceTable', () => {
    it('renders workspace row with candidate, org, mode badge, and honest spend status', () => {
      const html = renderToString(
        <WorkspaceTable
          workspaces={[mockItem]}
          total={1}
          page={1}
          pageSize={25}
          totalPages={1}
          isLoading={false}
          query={{}}
          onQueryChange={vi.fn()}
          onInspect={vi.fn()}
          onDestroy={vi.fn()}
          onRefresh={vi.fn()}
        />,
      );

      expect(html).toContain('Alex Rivera');
      expect(html).toContain('alex.rivera@example.test');
      expect(html).toContain('Acme Corp');
      expect(html).toContain('Senior Backend Engineer Challenge');
      expect(html).toContain('Cloud VM');
      expect(html).toContain('connected');
      expect(html).toContain('Unconnected (MMP)');
      expect(html).toContain('Inspect');
      expect(html).toContain('Kill');
    });
  });

  describe('EmergencyDestroyModal', () => {
    it('renders high-friction confirmation and mandatory reason input', () => {
      const html = renderToString(
        <AdminStoreProvider>
          <EmergencyDestroyModal
            workspace={mockItem}
            open={true}
            onClose={vi.fn()}
            onSuccess={vi.fn()}
          />
        </AdminStoreProvider>,
      );

      expect(html).toContain('Emergency Destroy Workspace');
      expect(html).toContain('Destructive &amp; Irreversible Action');
      expect(html).toContain(mockItem.id);
      expect(html).toContain(mockItem.candidateName);
      expect(html).toContain('Reason for Emergency Destruction');
      expect(html).toContain('Confirm Emergency Destroy');
    });
  });
});

