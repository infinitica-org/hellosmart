import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { makeAdminStore } from '@/store/admin/adminStore';
import { adminApi, ADMIN_TAG_TYPES } from '@/store/admin/adminApi';
import { AdminStoreProvider } from '@/providers/store-provider';
import AdminAuditPage from '@/app/(admin)/admin/audit/page';
import { AuditEventTable } from '@/components/admin/audit/audit-event-table';
import { AuditDetailDrawer } from '@/components/admin/audit/audit-detail-drawer';
import { HashChainStatusBanner } from '@hs/ui';
import { type AuditEventDto } from '@hs/contracts';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/admin/audit',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Drawer to render inline for server-side testing without browser DOM portal
vi.mock('@hs/ui', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    Drawer: ({ open, children, title, description, footer, 'data-testid': testId }: any) =>
      open ? (
        <div data-testid={testId || 'drawer'}>
          <div data-testid="drawer-title">{title}</div>
          <div data-testid="drawer-desc">{description}</div>
          <div data-testid="drawer-body">{children}</div>
          <div data-testid="drawer-footer">{footer}</div>
        </div>
      ) : null,
  };
});

describe('Admin Audit Explorer & Hash Chain Verifier UI (S1B-T05-4)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('verifies ADMIN_TAG_TYPES contains AuditLogs cache tag', () => {
    expect(ADMIN_TAG_TYPES).toContain('AuditLogs');
  });

  it('verifies adminApi registers getAdminAuditLogs and verifyAdminAuditChain endpoints', () => {
    expect(adminApi.endpoints.getAdminAuditLogs).toBeDefined();
    expect(adminApi.endpoints.verifyAdminAuditChain).toBeDefined();
  });

  it('renders AdminAuditPage layout with header, stat cards, filter controls, and trust boundary notice', () => {
    const store = makeAdminStore();
    const html = renderToString(
      <AdminStoreProvider store={store}>
        <AdminAuditPage />
      </AdminStoreProvider>,
    );

    expect(html).toContain('Platform Audit Trail');
    expect(html).toContain('Audit Ledger Hash-Chain Continuity Verification');
    expect(html).toContain('Verify Hash-Chain Continuity');
    expect(html).toContain('TOTAL AUDIT BLOCKS');
    expect(html).toContain('LEDGER CONTINUITY');
    expect(html).toContain('RETENTION POLICY');
    expect(html).toContain('data-testid="audit-filter-toggle"');
    expect(html).toContain('data-testid="audit-search-input"');
    expect(html).toContain('data-testid="audit-role-filter"');
    expect(html).toContain('data-testid="audit-trust-boundary-notice"');
    expect(html).toContain('Cryptographic Trust Boundary &amp; Threat Model Notice');
    expect(html).toContain('Genesis-Relative Hash Continuity');
    expect(html).toContain('Head &amp; Tail Deletion Undetectability');
    expect(html).toContain('BR-31 Invariant: Append-Only Cryptographic Audit Log');
  });

  describe('HashChainStatusBanner component', () => {
    it('renders idle banner with verification CTA button', () => {
      const html = renderToString(
        <HashChainStatusBanner status="idle" onVerify={() => {}} />,
      );

      expect(html).toContain('Audit Ledger Hash-Chain Continuity Verification');
      expect(html).toContain('Verify Hash-Chain Continuity');
      expect(html).toContain('Append-Only');
    });

    it('renders verifying spinner state', () => {
      const html = renderToString(
        <HashChainStatusBanner status="verifying" isLoading={true} />,
      );

      expect(html).toContain('Verifying SHA-256 Hash Chain...');
      expect(html).toContain('data-testid="hash-chain-verifying-banner"');
    });

    it('renders valid verified ledger banner with block count and timestamp', () => {
      const html = renderToString(
        <HashChainStatusBanner
          status="valid"
          recordsChecked={128}
          chainStart="1"
          chainEnd="128"
          verifiedAt="2026-11-06T11:00:00.000Z"
          onVerify={() => {}}
        />,
      );

      expect(html).toContain('Internal Hash-Chain Continuity Verified');
      expect(html).toContain('Continuity Verified (BR-31)');
      expect(html).toContain('128');
      expect(html).toContain('blocks verified sequentially');
      expect(html).toContain('Blocks');
    });

    it('renders inconclusive state with block identifier and indeterminate reason (never green valid)', () => {
      const html = renderToString(
        <HashChainStatusBanner
          status="inconclusive"
          firstInconclusiveEventId="77"
          inconclusiveReason="Cannot verify cryptographic hash: original JSON property ordering for nested state changes (before/after) cannot be recovered from PostgreSQL JSONB"
          recordsChecked={76}
          recordsVerifiedBeforeIssue={76}
          chainStart="1"
          verifiedAt="2026-11-06T11:00:00.000Z"
          onVerify={() => {}}
        />,
      );

      expect(html).toContain('data-testid="hash-chain-inconclusive-banner"');
      expect(html).toContain('Hash Chain Verification Inconclusive');
      expect(html).toContain('Inconclusive');
      expect(html).toContain('77');
      expect(html).toContain('76');
      expect(html).toContain('blocks verified before halting');
      expect(html).toContain('original JSON property ordering');
      // Crucial security invariant: Inconclusive must never render as green Valid
      expect(html).not.toContain('Valid (BR-31)');
      expect(html).not.toContain('data-testid="hash-chain-valid-banner"');
    });

    it('renders unknown provenance as inconclusive and never produces a green verification banner', () => {
      const html = renderToString(
        <HashChainStatusBanner
          status="inconclusive"
          firstInconclusiveEventId="105"
          inconclusiveReason="Ambiguous writer provenance: cannot distinguish PostgreSQL SQL writer from Node.js application writer for invitation.accepted event from persisted database fields alone"
          recordsChecked={104}
          recordsVerifiedBeforeIssue={104}
          chainStart="1"
          verifiedAt="2026-11-06T11:00:00.000Z"
          onVerify={() => {}}
        />,
      );

      // Must render amber inconclusive banner
      expect(html).toContain('data-testid="hash-chain-inconclusive-banner"');
      expect(html).toContain('Hash Chain Verification Inconclusive');
      expect(html).toContain('Ambiguous writer provenance');
      // Must NEVER render green valid / verified banner
      expect(html).not.toContain('data-testid="hash-chain-valid-banner"');
      expect(html).not.toContain('Continuity Verified (BR-31)');
      expect(html).not.toContain('Internal Hash-Chain Continuity Verified');
    });

    it('renders tampered state with block identifier and failure reason', () => {
      const html = renderToString(
        <HashChainStatusBanner
          status="tampered"
          firstInvalidEventId="42"
          failureReason="Cryptographic hash mismatch: row payload altered"
          expectedHash="expected-sha256-hash-hex"
          storedHash="stored-corrupted-hash-hex"
          onVerify={() => {}}
        />,
      );

      expect(html).toContain('Integrity Violation Detected (BR-31)');
      expect(html).toContain('Tampered');
      expect(html).toContain('42');
      expect(html).toContain('Cryptographic hash mismatch: row payload altered');
      expect(html).toContain('expected-sha256-hash-hex');
      expect(html).toContain('stored-corrupted-hash-hex');
    });
  });

  describe('AuditEventTable component', () => {
    const mockEvents: AuditEventDto[] = [
      {
        id: '101',
        at: '2026-11-06T10:00:00.000Z',
        actor_id: '00000000-0000-4000-8000-000000000001',
        actor_role: 'platform_admin',
        org_id: null,
        action: 'org.provisioned',
        entity: 'organization',
        entity_id: 'org-abc',
        before: null,
        after: { name: 'Acme Corp' },
        ip: '127.0.0.1',
        user_agent: 'Chrome/130',
        request_id: 'req-001',
        prev_hash: null,
        hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      },
    ];

    it('renders event table rows with action pills, entity, actor role, and hashes', () => {
      const html = renderToString(
        <AuditEventTable
          events={mockEvents}
          isLoading={false}
          total={1}
          page={1}
          pageSize={25}
          totalPages={1}
          onPageChange={() => {}}
          onSelectEvent={() => {}}
        />,
      );

      expect(html).toContain('101');
      expect(html).toContain('org.provisioned');
      expect(html).toContain('organization');
      expect(html).toContain('org-abc');
      expect(html).toContain('platform_admin');
      expect(html).toContain('Platform');
      expect(html).toContain('127.0.0.1');
      expect(html).toContain('e3b0c442');
      expect(html).toContain('Inspect');
    });

    it('renders empty state when events list is empty', () => {
      const html = renderToString(
        <AuditEventTable
          events={[]}
          isLoading={false}
          total={0}
          page={1}
          pageSize={25}
          totalPages={0}
          onPageChange={() => {}}
          onSelectEvent={() => {}}
        />,
      );

      expect(html).toContain('No Audit Records Found');
    });

    it('renders loading skeleton when isLoading is true', () => {
      const html = renderToString(
        <AuditEventTable
          events={[]}
          isLoading={true}
          total={0}
          page={1}
          pageSize={25}
          totalPages={0}
          onPageChange={() => {}}
          onSelectEvent={() => {}}
        />,
      );

      expect(html).toContain('data-testid="audit-table-loading"');
    });
  });

  describe('AuditDetailDrawer component', () => {
    const mockEvent: AuditEventDto = {
      id: '202',
      at: '2026-11-06T10:30:00.000Z',
      actor_id: '00000000-0000-4000-8000-000000000001',
      actor_role: 'platform_admin',
      org_id: 'org-test-uuid',
      action: 'org.status_changed',
      entity: 'organization',
      entity_id: 'org-test-uuid',
      before: { status: 'trial_active' },
      after: { status: 'suspended', reason: 'Non-payment' },
      ip: '10.0.0.1',
      user_agent: 'Mozilla/5.0',
      request_id: 'req-abc-999',
      prev_hash: '1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff',
      hash: '9999888877776666555544443333222211110000ffffeeeeddddccccbbbbaaaa',
    };

    it('renders detailed metadata, hashes, and formatted before/after JSON states', () => {
      const html = renderToString(
        <AuditDetailDrawer
          event={mockEvent}
          open={true}
          onClose={() => {}}
        />,
      );

      expect(html).toContain('Audit Event #');
      expect(html).toContain('202');
      expect(html).toContain('org.status_changed');
      expect(html).toContain('platform_admin');
      expect(html).toContain('org-test-uuid');
      expect(html).toContain('10.0.0.1');
      expect(html).toContain('req-abc-999');
      expect(html).toContain('1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff');
      expect(html).toContain('9999888877776666555544443333222211110000ffffeeeeddddccccbbbbaaaa');
      expect(html).toContain('&quot;trial_active&quot;');
      expect(html).toContain('&quot;suspended&quot;');
      expect(html).toContain('&quot;Non-payment&quot;');
    });
  });
});
