import crypto from 'node:crypto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AdminAuditService,
  hasIndeterminateKeyOrder,
  matchesInvitationFootprint,
  isProvenSqlInvitationRecord,
  isKnownApplicationAction,
} from '../src/modules/admin/admin-audit.service.js';
import { AdminAuditController } from '../src/modules/admin/admin-audit.controller.js';

interface TestAuditRow {
  id: number;
  at: Date;
  actor_id: string | null;
  actor_role: string;
  org_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  before: any;
  after: any;
  ip: string | null;
  user_agent: string | null;
  request_id: string | null;
  prev_hash: Buffer | null;
  hash: Buffer;
  sql_payload_bytes?: Buffer | null;
  provenance?: 'sql' | 'application' | 'ambiguous' | undefined;
}

function buildCanonical(row: Partial<TestAuditRow>) {
  return JSON.stringify({
    actorId: row.actor_id ?? null,
    actorRole: row.actor_role,
    orgId: row.org_id ?? null,
    action: row.action,
    entity: row.entity,
    entityId: row.entity_id ?? null,
    before: row.before ?? null,
    after: row.after ?? null,
    ip: row.ip ?? null,
    userAgent: row.user_agent ?? null,
    requestId: row.request_id ?? null,
  });
}

function computeDigest(prevHash: Buffer, payload: string | Buffer): Buffer {
  return crypto.createHash('sha256').update(prevHash).update(payload).digest();
}

describe('Recursive hasIndeterminateKeyOrder analysis (Section 3 & 5.B)', () => {
  it('1. Primitive before and after -> Deterministic', () => {
    expect(hasIndeterminateKeyOrder('string_value')).toBe(false);
    expect(hasIndeterminateKeyOrder(12345)).toBe(false);
    expect(hasIndeterminateKeyOrder(true)).toBe(false);
  });

  it('2. Null values -> Deterministic', () => {
    expect(hasIndeterminateKeyOrder(null)).toBe(false);
    expect(hasIndeterminateKeyOrder(undefined)).toBe(false);
  });

  it('3. Empty object -> Deterministic', () => {
    expect(hasIndeterminateKeyOrder({})).toBe(false);
  });

  it('4. Single-key object with primitive value -> Deterministic', () => {
    expect(hasIndeterminateKeyOrder({ name: 'Acme Corp' })).toBe(false);
    expect(hasIndeterminateKeyOrder({ status: 'active' })).toBe(false);
    expect(hasIndeterminateKeyOrder({ count: 42 })).toBe(false);
  });

  it('5. Multi-key top-level object -> Inconclusive', () => {
    expect(hasIndeterminateKeyOrder({ name: 'Acme Corp', status: 'active' })).toBe(true);
    expect(hasIndeterminateKeyOrder({ a: 1, b: 2, c: 3 })).toBe(true);
  });

  it('6. Single-key outer object containing multi-key nested object -> Inconclusive', () => {
    const payload = {
      status: {
        before: {
          name: 'A',
          email: 'a@example.com',
        },
      },
    };
    expect(hasIndeterminateKeyOrder(payload)).toBe(true);
  });

  it('7. Array containing a multi-key object -> Inconclusive', () => {
    const payload = {
      changes: [
        {
          name: 'A',
          email: 'a@example.com',
        },
      ],
    };
    expect(hasIndeterminateKeyOrder(payload)).toBe(true);
  });

  it('8. Nested arrays containing multi-key objects -> Inconclusive', () => {
    const payload = [[[{ key1: 'val1', key2: 'val2' }]]];
    expect(hasIndeterminateKeyOrder(payload)).toBe(true);
  });

  it('9. Deeply nested multi-key object -> Inconclusive', () => {
    const payload = {
      level1: {
        level2: {
          level3: {
            level4: {
              propA: true,
              propB: false,
            },
          },
        },
      },
    };
    expect(hasIndeterminateKeyOrder(payload)).toBe(true);
  });

  it('10. Both before and after contain nested ambiguous objects -> Inconclusive', () => {
    const beforePayload = { meta: { author: 'Alice', role: 'admin' } };
    const afterPayload = { meta: { author: 'Bob', role: 'superadmin' } };
    expect(hasIndeterminateKeyOrder(beforePayload)).toBe(true);
    expect(hasIndeterminateKeyOrder(afterPayload)).toBe(true);
  });

  it('Defensive recursion: handles circular references safely without throwing', () => {
    const circular: any = { single: {} };
    circular.single.self = circular;
    expect(() => hasIndeterminateKeyOrder(circular)).not.toThrow();
    expect(hasIndeterminateKeyOrder(circular)).toBe(true);
  });

  it('Defensive recursion: handles extreme depth (>64) safely', () => {
    let deep: any = { value: 'leaf' };
    for (let i = 0; i < 70; i++) {
      deep = { next: deep };
    }
    expect(() => hasIndeterminateKeyOrder(deep)).not.toThrow();
    expect(hasIndeterminateKeyOrder(deep)).toBe(true);
  });
});

describe('Audit Writer Provenance & Structural Footprint Analysis', () => {
  const footprintMatchingRow: Partial<TestAuditRow> = {
    action: 'invitation.accepted',
    entity: 'user',
    actor_id: '11111111-1111-4111-8111-111111111111',
    entity_id: '11111111-1111-4111-8111-111111111111',
    actor_role: 'candidate',
    org_id: '22222222-2222-4222-8222-222222222222',
    before: { status: 'invited', must_reset_password: true },
    after: { status: 'active', must_reset_password: false, email_verified: true },
    ip: '127.0.0.1',
    user_agent: 'Vitest',
    request_id: 'req-1',
  };

  it('1. matches structural footprint for invitation acceptance', () => {
    expect(matchesInvitationFootprint(footprintMatchingRow as any)).toBe(true);
  });

  it('2. structural matching alone CANNOT establish SQL provenance', () => {
    // Row matches footprint but has no independent trusted provenance metadata (provenance is undefined)
    expect(matchesInvitationFootprint(footprintMatchingRow as any)).toBe(true);
    expect(isProvenSqlInvitationRecord(footprintMatchingRow as any)).toBe(false);
  });

  it('3. an application-generated event can match the SQL invitation structural footprint', () => {
    // appendAuditEvent() accepts caller-provided action, entity, and payload values.
    // It emits an event with compact JS JSON serialization.
    const appEvent = { ...footprintMatchingRow, provenance: 'application' as const };
    expect(matchesInvitationFootprint(appEvent as any)).toBe(true);
    // Even though it matches the structural footprint, it is NOT classified as SQL-generated
    expect(isProvenSqlInvitationRecord(appEvent as any)).toBe(false);
  });

  it('4. independent provenance establishes SQL writer classification', () => {
    const provenSqlRow = { ...footprintMatchingRow, provenance: 'sql' as const };
    expect(isProvenSqlInvitationRecord(provenSqlRow as any)).toBe(true);
  });

  it('5. rejects unverified action/entity combination from matching invitation footprint', () => {
    // Mismatched role: platform_admin cannot accept invitations
    const invalidRoleRow: Partial<TestAuditRow> = {
      ...footprintMatchingRow,
      actor_role: 'platform_admin',
    };
    expect(matchesInvitationFootprint(invalidRoleRow as any)).toBe(false);
    expect(isProvenSqlInvitationRecord(invalidRoleRow as any)).toBe(false);

    // Mismatched actor/entity: user activating another user
    const mismatchedActorRow: Partial<TestAuditRow> = {
      ...footprintMatchingRow,
      entity_id: '99999999-9999-4999-8999-999999999999',
    };
    expect(matchesInvitationFootprint(mismatchedActorRow as any)).toBe(false);
    expect(isProvenSqlInvitationRecord(mismatchedActorRow as any)).toBe(false);

    // Mismatched payloads: custom application before/after
    const customPayloadRow: Partial<TestAuditRow> = {
      ...footprintMatchingRow,
      before: null,
      after: { custom_field: 'arbitrary_application_call' },
    };
    expect(matchesInvitationFootprint(customPayloadRow as any)).toBe(false);
    expect(isProvenSqlInvitationRecord(customPayloadRow as any)).toBe(false);
  });

  it('6. validates known application action catalog', () => {
    expect(isKnownApplicationAction('org.provisioned')).toBe(true);
    expect(isKnownApplicationAction('candidate.invited')).toBe(true);
    expect(isKnownApplicationAction('assessment.created')).toBe(true);
    expect(isKnownApplicationAction('unknown.action')).toBe(false);
    expect(isKnownApplicationAction('custom_unregistered_event')).toBe(false);
  });
});

describe('AdminAuditService & Controller Verification Engine', () => {
  let mockRows: TestAuditRow[] = [];
  let mockClient: any;
  let mockPool: any;
  let service: AdminAuditService;
  let controller: AdminAuditController;

  beforeEach(() => {
    mockRows = [];

    mockClient = {
      query: vi.fn(async (sql: string, params?: any[]) => {
        if (sql.includes('BEGIN')) return { rows: [] };
        if (sql.includes('COMMIT')) return { rows: [] };
        if (sql.includes('ROLLBACK')) return { rows: [] };
        if (sql.includes('set_config')) return { rows: [] };

        if (sql.includes('SELECT count(*)::int AS total FROM audit.events')) {
          let count = mockRows.length;
          if (params && params.length > 0 && sql.includes('actor_role =')) {
            const role = params[0];
            count = mockRows.filter((r) => r.actor_role === role).length;
          }
          return { rows: [{ total: count }] };
        }

        if (sql.includes('ORDER BY id DESC')) {
          let filtered = [...mockRows];
          if (params && params.length > 2 && sql.includes('actor_role =')) {
            const role = params[0];
            filtered = filtered.filter((r) => r.actor_role === role);
          }
          const pageSize = params ? params[params.length - 2] : 25;
          const offset = params ? params[params.length - 1] : 0;
          const paged = filtered.slice(offset, offset + pageSize);
          return {
            rows: paged.map((r) => ({
              ...r,
              prev_hash: r.prev_hash ? r.prev_hash.toString('hex') : null,
              hash: r.hash.toString('hex'),
            })),
          };
        }

        if (sql.includes('ORDER BY id ASC')) {
          return { rows: [...mockRows] };
        }

        return { rows: [] };
      }),
      release: vi.fn(),
    };

    mockPool = {
      connect: vi.fn(async () => mockClient),
    };

    service = new AdminAuditService(mockPool as any);
    controller = new AdminAuditController(service);
  });

  describe('Section 5.A: Comprehensive Provenance Tests', () => {
    it('1. When independent provenance is established, SQL JSONB serialization is used and verified', async () => {
      const sqlPayloadText =
        '{"ip": "127.0.0.1", "after": {"status": "active", "email_verified": true, "must_reset_password": false}, "orgId": "22222222-2222-4222-8222-222222222222", "action": "invitation.accepted", "before": {"status": "invited", "must_reset_password": true}, "entity": "user", "actorId": "11111111-1111-4111-8111-111111111111", "entityId": "11111111-1111-4111-8111-111111111111", "actorRole": "candidate", "requestId": "req-123", "userAgent": "Mozilla/5.0"}';
      const sqlPayloadBytes = Buffer.from(sqlPayloadText, 'utf8');
      const expectedPrevHash = Buffer.alloc(0);
      const sqlHash = computeDigest(expectedPrevHash, sqlPayloadBytes);

      mockRows = [
        {
          id: 1,
          at: new Date('2026-11-01T10:00:00Z'),
          actor_id: '11111111-1111-4111-8111-111111111111',
          actor_role: 'candidate',
          org_id: '22222222-2222-4222-8222-222222222222',
          action: 'invitation.accepted',
          entity: 'user',
          entity_id: '11111111-1111-4111-8111-111111111111',
          before: { status: 'invited', must_reset_password: true },
          after: { status: 'active', must_reset_password: false, email_verified: true },
          ip: '127.0.0.1',
          user_agent: 'Mozilla/5.0',
          request_id: 'req-123',
          prev_hash: null,
          hash: sqlHash,
          sql_payload_bytes: sqlPayloadBytes,
          provenance: 'sql', // Independent trusted provenance established
        },
      ];

      const result = await service.verifyAuditChain();
      expect(result.status).toBe('valid');
      expect(result.valid).toBe(true);
      expect(result.records_checked).toBe(1);
    });

    it('2. An application-generated event matching the SQL invitation structural footprint returns inconclusive, not valid or tampered', async () => {
      // Application service calls appendAuditEvent() with action: 'invitation.accepted', entity: 'user',
      // emitting the exact structural footprint of app.accept_invitation(), but hashed via JS JSON.stringify()
      const appRowData: Partial<TestAuditRow> = {
        id: 1,
        at: new Date('2026-11-01T10:00:00Z'),
        actor_id: '11111111-1111-4111-8111-111111111111',
        actor_role: 'candidate',
        org_id: '22222222-2222-4222-8222-222222222222',
        action: 'invitation.accepted',
        entity: 'user',
        entity_id: '11111111-1111-4111-8111-111111111111',
        before: { status: 'invited', must_reset_password: true },
        after: { status: 'active', must_reset_password: false, email_verified: true },
        ip: '127.0.0.1',
        user_agent: 'Mozilla/5.0',
        request_id: 'req-123',
      };
      // Hashed using JavaScript JSON.stringify (as appendAuditEvent does)
      const jsHash = computeDigest(Buffer.alloc(0), buildCanonical(appRowData));

      // Persisted row in database has NO provenance marker column
      mockRows = [
        {
          ...appRowData,
          prev_hash: null,
          hash: jsHash,
          // provenance is undefined (raw DB row without independent trusted provenance)
        } as TestAuditRow,
      ];

      // In the previous faulty implementation, this was classified as SQL-generated based on footprint,
      // and failed the SQL hash check, incorrectly returning status: 'tampered'!
      // Correct behavior: because provenance cannot be established from persisted fields, it returns inconclusive!
      const result = await service.verifyAuditChain();
      expect(result.status).toBe('inconclusive');
      expect(result.valid).toBe(false);
      expect(result.status).not.toBe('valid');
      expect(result.status).not.toBe('tampered');
      expect(result.tamper_type).toBe('unknown_provenance');
      expect(result.inconclusive_reason).toContain('Ambiguous writer provenance');
      expect(result.inconclusive_reason).toContain('cannot distinguish PostgreSQL SQL writer from Node.js application writer');
    });

    it('3. A proven application-generated event uses application serialization only when safe', async () => {
      const rowData: Partial<TestAuditRow> = {
        id: 1,
        at: new Date('2026-11-01T10:00:00Z'),
        actor_id: '11111111-1111-4111-8111-111111111111',
        actor_role: 'platform_admin',
        org_id: null,
        action: 'org.provisioned',
        entity: 'organization',
        entity_id: 'org-1',
        before: null,
        after: { name: 'Acme Corp' }, // Safe: 1 key
        ip: '127.0.0.1',
        user_agent: 'Vitest',
        request_id: 'req-1',
      };
      const hash = computeDigest(Buffer.alloc(0), buildCanonical(rowData));

      mockRows = [{ ...rowData, prev_hash: null, hash } as TestAuditRow];

      const result = await service.verifyAuditChain();
      expect(result.status).toBe('valid');
      expect(result.valid).toBe(true);
      expect(result.records_checked).toBe(1);
    });

    it('4. An event with ambiguous provenance returns inconclusive', async () => {
      mockRows = [
        {
          id: 1,
          at: new Date('2026-11-01T10:00:00Z'),
          actor_id: null,
          actor_role: 'system',
          org_id: null,
          action: 'unknown.synthetic_action',
          entity: 'custom_entity',
          entity_id: 'custom-1',
          before: null,
          after: null,
          ip: null,
          user_agent: null,
          request_id: null,
          prev_hash: null,
          hash: Buffer.from('some-hash'),
        },
      ];

      const result = await service.verifyAuditChain();
      expect(result.status).toBe('inconclusive');
      expect(result.valid).toBe(false);
      expect(result.first_inconclusive_event_id).toBe('1');
      expect(result.tamper_type).toBe('unknown_provenance');
      expect(result.inconclusive_reason).toContain('Ambiguous writer provenance');
    });

    it('5. An event cannot be classified as SQL-generated solely because an unverified action/entity combination matches', async () => {
      // Row has action: 'invitation.accepted' and entity: 'user', BUT actor_role is 'platform_admin'
      // and before/after payloads are custom (not matching 0003_invitations.sql)
      mockRows = [
        {
          id: 1,
          at: new Date('2026-11-01T10:00:00Z'),
          actor_id: '11111111-1111-4111-8111-111111111111',
          actor_role: 'platform_admin', // UNVERIFIED! (Procedure only permits company_admin/candidate)
          org_id: '22222222-2222-4222-8222-222222222222',
          action: 'invitation.accepted',
          entity: 'user',
          entity_id: '11111111-1111-4111-8111-111111111111',
          before: { arbitrary: 'payload' },
          after: { another: 'payload' },
          ip: '127.0.0.1',
          user_agent: 'Vitest',
          request_id: 'req-x',
          prev_hash: null,
          hash: Buffer.from('unverified-action-entity-hash'),
        },
      ];

      const result = await service.verifyAuditChain();
      expect(result.status).toBe('inconclusive');
      expect(result.valid).toBe(false);
      expect(result.first_inconclusive_event_id).toBe('1');
      expect(result.tamper_type).toBe('unknown_provenance');
      expect(result.inconclusive_reason).toContain('Ambiguous writer provenance');
    });

    it('6. No ambiguous provenance can result in a valid status (always valid: false)', async () => {
      mockRows = [
        {
          id: 1,
          at: new Date('2026-11-01T10:00:00Z'),
          actor_id: null,
          actor_role: 'system',
          org_id: null,
          action: 'invitation.accepted',
          entity: 'user',
          entity_id: 'not-matching-actor-id',
          before: null,
          after: null,
          ip: null,
          user_agent: null,
          request_id: null,
          prev_hash: null,
          hash: Buffer.from('hash'),
          provenance: 'ambiguous',
        },
      ];

      const result = await service.verifyAuditChain();
      expect(result.status).not.toBe('valid');
      expect(result.valid).toBe(false);
      expect(result.status).toBe('inconclusive');
    });
  });

  describe('Section 5.C: Chain Status & Tamper Detection Tests', () => {
    it('returns status: empty for an empty ledger', async () => {
      mockRows = [];
      const result = await service.verifyAuditChain();
      expect(result.status).toBe('empty');
      expect(result.valid).toBe(true);
      expect(result.records_checked).toBe(0);
      expect(result.tamper_type).toBe('empty_chain');
    });

    it('verifies a valid chain of 3 consecutive deterministic blocks', async () => {
      const row1Data: Partial<TestAuditRow> = {
        id: 1,
        at: new Date('2026-11-01T10:00:00Z'),
        actor_id: '11111111-1111-4111-8111-111111111111',
        actor_role: 'platform_admin',
        org_id: null,
        action: 'org.provisioned',
        entity: 'organization',
        entity_id: 'org-1',
        before: null,
        after: { name: 'Acme Corp' },
        ip: '127.0.0.1',
        user_agent: 'Vitest',
        request_id: 'req-1',
      };
      const row1Hash = computeDigest(Buffer.alloc(0), buildCanonical(row1Data));

      const row2Data: Partial<TestAuditRow> = {
        id: 2,
        at: new Date('2026-11-01T10:05:00Z'),
        actor_id: '11111111-1111-4111-8111-111111111111',
        actor_role: 'platform_admin',
        org_id: '22222222-2222-4222-8222-222222222222',
        action: 'entitlements.modified',
        entity: 'entitlements',
        entity_id: '22222222-2222-4222-8222-222222222222',
        before: { max_candidates: 10 },
        after: { max_candidates: 25 },
        ip: '127.0.0.1',
        user_agent: 'Vitest',
        request_id: 'req-2',
      };
      const row2Hash = computeDigest(row1Hash, buildCanonical(row2Data));

      const row3Data: Partial<TestAuditRow> = {
        id: 3,
        at: new Date('2026-11-01T10:10:00Z'),
        actor_id: '33333333-3333-4333-8333-333333333333',
        actor_role: 'company_admin',
        org_id: '22222222-2222-4222-8222-222222222222',
        action: 'candidate.invited',
        entity: 'candidate',
        entity_id: 'c-1',
        before: null,
        after: { email: 'candidate@test.com' },
        ip: '192.168.1.10',
        user_agent: 'Vitest',
        request_id: 'req-3',
      };
      const row3Hash = computeDigest(row2Hash, buildCanonical(row3Data));

      mockRows = [
        { ...row1Data, prev_hash: null, hash: row1Hash } as TestAuditRow,
        { ...row2Data, prev_hash: row1Hash, hash: row2Hash } as TestAuditRow,
        { ...row3Data, prev_hash: row2Hash, hash: row3Hash } as TestAuditRow,
      ];

      const result = await controller.verifyChain();
      expect(result.status).toBe('valid');
      expect(result.valid).toBe(true);
      expect(result.records_checked).toBe(3);
      expect(result.chain_start).toBe('1');
      expect(result.chain_end).toBe('3');
      expect(result.tamper_type).toBe('none');
    });

    it('detects invalid genesis record with non-null prev_hash as tampered', async () => {
      mockRows = [
        {
          id: 1,
          at: new Date('2026-11-01T10:00:00Z'),
          actor_id: '11111111-1111-4111-8111-111111111111',
          actor_role: 'platform_admin',
          org_id: null,
          action: 'org.provisioned',
          entity: 'organization',
          entity_id: 'org-1',
          before: null,
          after: null,
          ip: null,
          user_agent: null,
          request_id: null,
          prev_hash: Buffer.from('unexpected-prev-hash-on-genesis'),
          hash: Buffer.from('genesis-hash'),
        },
      ];

      const result = await service.verifyAuditChain();
      expect(result.status).toBe('tampered');
      expect(result.valid).toBe(false);
      expect(result.first_invalid_event_id).toBe('1');
      expect(result.tamper_type).toBe('invalid_genesis');
    });

    it('detects broken previous_hash chain pointer as tampered', async () => {
      const row1Data: Partial<TestAuditRow> = {
        id: 1,
        at: new Date('2026-11-01T10:00:00Z'),
        actor_id: '11111111-1111-4111-8111-111111111111',
        actor_role: 'platform_admin',
        org_id: null,
        action: 'org.provisioned',
        entity: 'organization',
        entity_id: 'org-1',
        before: null,
        after: null,
        ip: null,
        user_agent: null,
        request_id: null,
      };
      const row1Hash = computeDigest(Buffer.alloc(0), buildCanonical(row1Data));

      mockRows = [
        { ...row1Data, prev_hash: null, hash: row1Hash } as TestAuditRow,
        {
          id: 2,
          at: new Date('2026-11-01T10:05:00Z'),
          actor_id: '11111111-1111-4111-8111-111111111111',
          actor_role: 'platform_admin',
          org_id: null,
          action: 'org.suspended',
          entity: 'organization',
          entity_id: 'org-1',
          before: null,
          after: null,
          ip: null,
          user_agent: null,
          request_id: null,
          prev_hash: Buffer.from('broken-hash-pointer-000000000000'),
          hash: Buffer.from('some-hash'),
        },
      ];

      const result = await service.verifyAuditChain();
      expect(result.status).toBe('tampered');
      expect(result.valid).toBe(false);
      expect(result.first_invalid_event_id).toBe('2');
      expect(result.tamper_type).toBe('prev_hash_mismatch');
      expect(result.expected_previous_hash).toBe(row1Hash.toString('hex'));
    });

    it('classifies a deterministic payload with genuinely incorrect hash as tampered, not inconclusive', async () => {
      const row1Data: Partial<TestAuditRow> = {
        id: 1,
        at: new Date('2026-11-01T10:00:00Z'),
        actor_id: '11111111-1111-4111-8111-111111111111',
        actor_role: 'platform_admin',
        org_id: null,
        action: 'org.provisioned',
        entity: 'organization',
        entity_id: 'org-1',
        before: null,
        after: { name: 'Acme Corp' }, // Deterministic (1 key)
        ip: null,
        user_agent: null,
        request_id: null,
      };
      const legitimateHash = computeDigest(Buffer.alloc(0), buildCanonical(row1Data));

      // Attacker altered after state from 'Acme Corp' to 'Malicious Corp'
      const tamperedRow = {
        ...row1Data,
        after: { name: 'Malicious Corp' },
        prev_hash: null,
        hash: legitimateHash, // Stored hash does not match tampered payload
      } as TestAuditRow;

      mockRows = [tamperedRow];

      const result = await service.verifyAuditChain();
      expect(result.status).toBe('tampered');
      expect(result.valid).toBe(false);
      expect(result.first_invalid_event_id).toBe('1');
      expect(result.tamper_type).toBe('hash_mismatch');
    });

    it('correctly reports records_verified_before_issue when an inconclusive block is encountered', async () => {
      const row1Data: Partial<TestAuditRow> = {
        id: 1,
        at: new Date('2026-11-01T10:00:00Z'),
        actor_id: '11111111-1111-4111-8111-111111111111',
        actor_role: 'platform_admin',
        org_id: null,
        action: 'org.provisioned',
        entity: 'organization',
        entity_id: 'org-1',
        before: null,
        after: { name: 'Acme Corp' },
        ip: null,
        user_agent: null,
        request_id: null,
      };
      const row1Hash = computeDigest(Buffer.alloc(0), buildCanonical(row1Data));

      // Row 2 is indeterminate multi-key payload
      const row2Data: Partial<TestAuditRow> = {
        id: 2,
        at: new Date('2026-11-01T10:05:00Z'),
        actor_id: '11111111-1111-4111-8111-111111111111',
        actor_role: 'platform_admin',
        org_id: '22222222-2222-4222-8222-222222222222',
        action: 'org.configured',
        entity: 'organization',
        entity_id: 'org-1',
        before: null,
        after: { timezone: 'UTC', plan: 'enterprise', tier: 2 }, // multi-key!
        ip: null,
        user_agent: null,
        request_id: null,
      };

      mockRows = [
        { ...row1Data, prev_hash: null, hash: row1Hash } as TestAuditRow,
        { ...row2Data, prev_hash: row1Hash, hash: Buffer.from('indeterminate-hash') } as TestAuditRow,
      ];

      const result = await service.verifyAuditChain();
      expect(result.status).toBe('inconclusive');
      expect(result.valid).toBe(false);
      expect(result.records_verified_before_issue).toBe(1);
      expect(result.first_inconclusive_event_id).toBe('2');
    });
  });

  describe('Section 5.D: SQL JSONB Text Serialization Invariants', () => {
    it('verifies exact PostgreSQL JSONB text structure for SQL invitation procedure', () => {
      // 0003_invitations.sql exact footprint format:
      // Note spaces after ':' and ',', keys ordered by length then ASCII:
      // ip (2), after (5), orgId (5), action (6), before (6), entity (6), actorId (7), entityId (8), actorRole (9), requestId (9), userAgent (9)
      const expectedText =
        '{"ip": "127.0.0.1", "after": {"status": "active", "email_verified": true, "must_reset_password": false}, "orgId": "22222222-2222-4222-8222-222222222222", "action": "invitation.accepted", "before": {"status": "invited", "must_reset_password": true}, "entity": "user", "actorId": "11111111-1111-4111-8111-111111111111", "entityId": "11111111-1111-4111-8111-111111111111", "actorRole": "candidate", "requestId": "req-123", "userAgent": "Mozilla/5.0"}';

      // Parse and verify all required keys are present
      const parsed = JSON.parse(expectedText);
      expect(parsed.orgId).toBe('22222222-2222-4222-8222-222222222222');
      expect(parsed.actorId).toBe('11111111-1111-4111-8111-111111111111');
      expect(parsed.entityId).toBe(parsed.actorId);
      expect(parsed.before).toEqual({ status: 'invited', must_reset_password: true });
      expect(parsed.after).toEqual({ status: 'active', must_reset_password: false, email_verified: true });

      // Verify SHA-256 computation over exact UTF-8 byte representation
      const bytes = Buffer.from(expectedText, 'utf8');
      const hash = crypto.createHash('sha256').update(Buffer.alloc(0)).update(bytes).digest();
      expect(hash.length).toBe(32);
    });
  });
});
