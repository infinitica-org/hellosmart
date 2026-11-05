import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Readable } from 'node:stream';
import {
  RetentionPurgeWorker,
  RETENTION_PURGE_ADVISORY_LOCK_ID,
} from '../retention-purge.worker.js';
import { FakeStorageAdapter } from '../../../common/storage/fake-storage.adapter.js';
import { FakeCandidateArtifactLocator } from '../candidate-artifact-locator.port.js';
import type { Config } from '../../../config/config.js';
import type { PgPool } from '../../database/database.tokens.js';
import type { SessionStore } from '../../session/session.types.js';

describe('RetentionPurgeWorker (Unit)', () => {
  let worker: RetentionPurgeWorker;
  let fakeStorage: FakeStorageAdapter;
  let fakeLocator: FakeCandidateArtifactLocator;
  let mockSessionStore: Partial<SessionStore>;
  let mockAppPool: any;
  let mockPlatformPool: any;
  let capturedAuditEvents: any[];
  let executedQueries: { client: string; text: string; values?: any[] | undefined }[];

  const defaultConfig: Config = {
    NODE_ENV: 'test',
    PORT: 4000,
    LOG_LEVEL: 'silent',
    DATABASE_URL: 'postgres://hs_app:hs_app_local@127.0.0.1:5432/hellosmart_test',
    DATABASE_MIGRATOR_URL:
      'postgres://hs_migrator:hs_migrator_local@127.0.0.1:5432/hellosmart_test',
    DATABASE_PLATFORM_URL:
      'postgres://hs_platform:hs_platform_local@127.0.0.1:5432/hellosmart_test',
    SESSION_SECRET: 'test_session_secret_at_least_32_characters_long_hello',
    CORS_ORIGINS: ['http://localhost:3000'],
    PAYMENT_GATEWAY: 'fake',
    EMAIL_PROVIDER: 'fake',
    WORKSPACE_RUNTIME: 'fake',
    APP_BASE_URL: 'http://localhost:3000',
    STORAGE_DRIVER: 'fake',
    STORAGE_LOCAL_ROOT: '.storage',
    STORAGE_S3_BUCKET: 'hs-test-bucket',
    STORAGE_S3_REGION: 'us-east-1',
    RETENTION_PURGE_ENABLED: true,
    RETENTION_PURGE_HOUR_UTC: 3,
    RETENTION_PURGE_BATCH_SIZE: 100,
    RETENTION_PURGE_DRY_RUN: false,
  } as unknown as Config;

  const orgAlpha = { id: '11111111-1111-4111-8111-111111111111', retention_days: 90 };
  const orgBeta = { id: '22222222-2222-4222-8222-222222222222', retention_days: 30 };

  beforeEach(() => {
    fakeStorage = new FakeStorageAdapter();
    fakeLocator = new FakeCandidateArtifactLocator();
    capturedAuditEvents = [];
    executedQueries = [];

    mockSessionStore = {
      revokeAllForUser: vi.fn().mockResolvedValue([]),
    };

    // Mock platform client (handles advisory lock & org listing)
    const platformClient = {
      query: vi.fn().mockImplementation(async (text: string, values?: any[]) => {
        executedQueries.push({ client: 'platform', text, values });
        if (text.includes('pg_try_advisory_lock')) {
          return { rows: [{ acquired: true }] };
        }
        if (text.includes('pg_advisory_unlock')) {
          return { rows: [{ unlocked: true }] };
        }
        if (text.includes('SELECT id, retention_days FROM app.organizations')) {
          return { rows: [orgAlpha, orgBeta] };
        }
        if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') {
          return { rows: [] };
        }
        if (text.includes('set_config')) {
          return { rows: [] };
        }
        return { rows: [] };
      }),
      release: vi.fn(),
    };

    mockPlatformPool = {
      connect: vi.fn().mockResolvedValue(platformClient),
    } as unknown as PgPool;

    // Mock app client (handles candidate selection & deletion)
    const appClient = {
      query: vi.fn().mockImplementation(async (text: string, values?: any[]) => {
        executedQueries.push({ client: 'app', text, values });
        if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') {
          return { rows: [] };
        }
        if (text.includes('set_config')) {
          return { rows: [] };
        }
        if (text.includes('SELECT audit.latest_event_hash')) {
          return { rows: [{ hash: Buffer.from('abc') }] };
        }
        if (text.includes('INSERT INTO audit.events')) {
          capturedAuditEvents.push(values);
          return { rows: [] };
        }
        if (text.includes('SELECT id FROM app.users')) {
          // Default: returns 1 candidate for orgAlpha, 0 for orgBeta
          const orgId = values?.[0];
          if (orgId === orgAlpha.id) {
            return {
              rows: [{ id: 'cand-alpha-1' }, { id: 'cand-alpha-2' }],
            };
          }
          return { rows: [] };
        }
        if (text.includes('DELETE FROM app.invitations')) {
          return { rowCount: 1 };
        }
        if (text.includes('DELETE FROM app.users')) {
          return { rowCount: 1 };
        }
        return { rows: [] };
      }),
      release: vi.fn(),
    };

    mockAppPool = {
      connect: vi.fn().mockResolvedValue(appClient),
    } as unknown as PgPool;

    worker = new RetentionPurgeWorker(
      defaultConfig,
      mockAppPool,
      mockPlatformPool,
      fakeStorage,
      fakeLocator,
      mockSessionStore as SessionStore,
    );
  });

  it('acquires and releases dedicated advisory lock', async () => {
    const report = await worker.run();
    expect(report.skippedDueToLock).toBe(false);

    const lockQuery = executedQueries.find((q) => q.text.includes('pg_try_advisory_lock'));
    expect(lockQuery).toBeDefined();
    expect(lockQuery?.values?.[0]).toBe(RETENTION_PURGE_ADVISORY_LOCK_ID);

    const unlockQuery = executedQueries.find((q) => q.text.includes('pg_advisory_unlock'));
    expect(unlockQuery).toBeDefined();
    expect(unlockQuery?.values?.[0]).toBe(RETENTION_PURGE_ADVISORY_LOCK_ID);
  });

  it('skips run quietly when advisory lock is held by another replica', async () => {
    const busyClient = {
      query: vi.fn().mockImplementation(async (text: string) => {
        if (text.includes('pg_try_advisory_lock')) {
          return { rows: [{ acquired: false }] };
        }
        return { rows: [] };
      }),
      release: vi.fn(),
    };
    mockPlatformPool.connect.mockResolvedValueOnce(busyClient);

    const report = await worker.run();
    expect(report.skippedDueToLock).toBe(true);
    expect(report.totalCandidatesPurged).toBe(0);
    expect(busyClient.release).toHaveBeenCalled();
  });

  it('deletes storage artifacts BEFORE hard-deleting database rows', async () => {
    const orgId = orgAlpha.id;
    const candidateId = 'cand-alpha-1';
    const storageKey = `storage/${orgId}/submissions/assign-1/obj-report.pdf`;

    fakeLocator.setCandidateKeys(candidateId, [storageKey]);
    fakeStorage.put(storageKey, Readable.from(Buffer.from('pdf')), {
      contentType: 'application/pdf',
      filename: 'report.pdf',
      orgId,
      assignmentId: 'assign-1',
      objectId: 'obj',
    });

    const callOrder: string[] = [];
    const origDeleteByKeys = fakeStorage.deleteByKeys.bind(fakeStorage);
    vi.spyOn(fakeStorage, 'deleteByKeys').mockImplementation(async (oid, keys) => {
      callOrder.push('storage.deleteByKeys');
      return origDeleteByKeys(oid, keys);
    });

    const origAppConnect = mockAppPool.connect;
    mockAppPool.connect = vi.fn().mockImplementation(async () => {
      const client = await origAppConnect();
      const origQuery = client.query;
      client.query = vi.fn().mockImplementation(async (text: string, values?: any[]) => {
        if (text.includes('DELETE FROM app.users')) {
          callOrder.push('db.deleteUsers');
        }
        return origQuery(text, values);
      });
      return client;
    });

    await worker.run();

    expect(callOrder).toContain('storage.deleteByKeys');
    expect(callOrder).toContain('db.deleteUsers');
    const storageIdx = callOrder.indexOf('storage.deleteByKeys');
    const dbIdx = callOrder.indexOf('db.deleteUsers');
    expect(storageIdx).toBeLessThan(dbIdx);
  });

  it('skips database deletion if storage deletion fails and counts failure', async () => {
    const orgId = orgAlpha.id;
    const candidateId = 'cand-alpha-1';
    const storageKey = `storage/${orgId}/submissions/assign-1/obj-error.pdf`;

    fakeLocator.setCandidateKeys(candidateId, [storageKey]);
    vi.spyOn(fakeStorage, 'deleteByKeys').mockRejectedValueOnce(new Error('S3 500 Internal Error'));

    let deletedCandidateIds: string[] = [];
    const origAppConnect = mockAppPool.connect;
    mockAppPool.connect = vi.fn().mockImplementation(async () => {
      const client = await origAppConnect();
      const origQuery = client.query;
      client.query = vi.fn().mockImplementation(async (text: string, values?: any[]) => {
        if (text.includes('SELECT id FROM app.users')) {
          return { rows: [{ id: candidateId }] };
        }
        if (text.includes('DELETE FROM app.users')) {
          deletedCandidateIds.push(values?.[0]);
        }
        return origQuery(text, values);
      });
      return client;
    });

    const report = await worker.run();
    expect(report.totalFailures).toBeGreaterThanOrEqual(1);
    expect(deletedCandidateIds).not.toContain(candidateId);
    expect(deletedCandidateIds).toHaveLength(0);
  });

  it('skips organizations whose retention_days is outside bounds (30-730)', async () => {
    const invalidOrg = { id: '99999999-9999-4999-8999-999999999999', retention_days: 10 };
    mockPlatformPool.connect = vi.fn().mockResolvedValue({
      query: vi.fn().mockImplementation(async (text: string) => {
        if (text.includes('pg_try_advisory_lock')) return { rows: [{ acquired: true }] };
        if (text.includes('pg_advisory_unlock')) return { rows: [{ unlocked: true }] };
        if (text.includes('SELECT id, retention_days FROM app.organizations')) {
          return { rows: [invalidOrg] };
        }
        return { rows: [] };
      }),
      release: vi.fn(),
    });

    const report = await worker.run();
    expect(report.orgReports).toHaveLength(1);
    expect(report.orgReports[0]?.skippedReason).toBe('retention_days out of bounds');
    expect(report.totalCandidatesPurged).toBe(0);
  });

  it('dry run mode counts candidates and objects without deleting rows or appending audit event', async () => {
    const orgId = orgAlpha.id;
    const candidateId = 'cand-alpha-1';
    fakeLocator.setCandidateKeys(candidateId, [`storage/${orgId}/submissions/a1/obj1-test.pdf`]);

    let userDeleted = false;
    const origAppConnect = mockAppPool.connect;
    mockAppPool.connect = vi.fn().mockImplementation(async () => {
      const client = await origAppConnect();
      const origQuery = client.query;
      client.query = vi.fn().mockImplementation(async (text: string, values?: any[]) => {
        if (text.includes('DELETE FROM app.users')) {
          userDeleted = true;
        }
        return origQuery(text, values);
      });
      return client;
    });

    const report = await worker.run({ dryRun: true });
    expect(report.totalCandidatesPurged).toBe(2);
    expect(userDeleted).toBe(false);
    expect(capturedAuditEvents).toHaveLength(0); // Dry-run produces zero audit events
  });

  it('audit event payload contains strictly non-PII aggregate counts and exact fields', async () => {
    await worker.run();

    expect(capturedAuditEvents.length).toBeGreaterThan(0);
    const auditPayload = JSON.parse(capturedAuditEvents[0][7]); // after JSON column

    expect(auditPayload).toEqual({
      candidates_purged: 2,
      objects_deleted: 0,
      failures: 0,
      retention_days: 90,
      dry_run: false,
    });

    // Ensure no PII exists in the audit record
    const allAuditJson = JSON.stringify(capturedAuditEvents[0]);
    expect(allAuditJson).not.toContain('cand-alpha');
    expect(allAuditJson).not.toContain('@example.com');
    expect(allAuditJson).not.toContain('Candidate');
  });

  it.skip('submissions purge blocked on submissions table (Sprint 4)', () => {
    // Blocked on app.submissions schema migration in Sprint 4
  });
});
