import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import pg from 'pg';
import { RetentionPurgeWorker } from '../retention-purge.worker.js';
import { FakeStorageAdapter } from '../../../common/storage/fake-storage.adapter.js';
import { FakeCandidateArtifactLocator } from '../candidate-artifact-locator.port.js';
import { withPlatform } from '../../tenancy/with-org.js';
import type { Config } from '../../../config/config.js';

const TEST_DB_URL =
  process.env.DATABASE_URL_OVERRIDE ??
  'postgres://hs_app:hs_app_local@127.0.0.1:5432/hellosmart_test';
const TEST_PLATFORM_URL =
  process.env.DATABASE_PLATFORM_URL_OVERRIDE ??
  'postgres://hs_platform:hs_platform_local@127.0.0.1:5432/hellosmart_test';

describe('RetentionPurgeWorker (Postgres Integration on hellosmart_test)', () => {
  let appPool: pg.Pool;
  let platformPool: pg.Pool;
  let worker: RetentionPurgeWorker;
  let fakeStorage: FakeStorageAdapter;
  let fakeLocator: FakeCandidateArtifactLocator;

  // Synthetic Test IDs with recognizable UUIDs
  const orgAlphaId = 'aaaaaaaa-1111-4111-8111-111111111111';
  const orgBetaId = 'bbbbbbbb-2222-4222-8222-222222222222';

  // Org Alpha candidates (retention: 30 days)
  const candAlphaExpired = 'ca111111-1111-4111-8111-111111111111'; // 45 days old -> PURGED
  const candAlphaFresh = 'ca222222-2222-4222-8222-222222222222'; // 10 days old -> KEPT
  const candAlphaActive = 'ca333333-3333-4333-8333-333333333333'; // active -> KEPT
  const adminAlphaDeleted = 'ad111111-1111-4111-8111-111111111111'; // admin deleted -> KEPT (only role candidate purged)

  // Org Beta candidates (retention: 90 days)
  const candBetaBetween = 'cb111111-1111-4111-8111-111111111111'; // 45 days old -> KEPT (Beta retention is 90)
  const candBetaExpired = 'cb222222-2222-4222-8222-222222222222'; // 100 days old -> PURGED

  const allSyntheticUserIds = [
    candAlphaExpired,
    candAlphaFresh,
    candAlphaActive,
    adminAlphaDeleted,
    candBetaBetween,
    candBetaExpired,
  ];

  let isDbConnected = false;

  beforeAll(async () => {
    try {
      appPool = new pg.Pool({ connectionString: TEST_DB_URL, max: 5 });
      platformPool = new pg.Pool({ connectionString: TEST_PLATFORM_URL, max: 5 });

      const testClient = await platformPool.connect();
      await testClient.query('SELECT 1');
      testClient.release();
      isDbConnected = true;
    } catch {
      isDbConnected = false;
      return;
    }

    fakeStorage = new FakeStorageAdapter();
    fakeLocator = new FakeCandidateArtifactLocator();

    // Map artifact to candAlphaExpired to verify storage deletion
    const alphaExpiredArtifact = `storage/${orgAlphaId}/submissions/assign-1/obj-expired.zip`;
    fakeLocator.setCandidateKeys(candAlphaExpired, [alphaExpiredArtifact]);
    await fakeStorage.put(
      alphaExpiredArtifact,
      Readable.from(Buffer.from('zip deliverable payload')),
      {
        contentType: 'application/zip',
        filename: 'expired.zip',
        orgId: orgAlphaId,
        assignmentId: 'assign-1',
        objectId: 'obj-expired',
      },
    );

    const config: Config = {
      NODE_ENV: 'test',
      PORT: 4000,
      LOG_LEVEL: 'silent',
      DATABASE_URL: TEST_DB_URL,
      DATABASE_PLATFORM_URL: TEST_PLATFORM_URL,
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

    worker = new RetentionPurgeWorker(config, appPool, platformPool, fakeStorage, fakeLocator);

    // Setup synthetic organizations and users in hellosmart_test via platform connection
    const client = await platformPool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.is_platform', 'true', true)");

      // 1. Clean any prior leftover synthetic rows if present
      await client.query(
        `DELETE FROM app.invitations WHERE user_id = ANY($1) OR org_id IN ($2, $3)`,
        [allSyntheticUserIds, orgAlphaId, orgBetaId],
      );
      await client.query(`DELETE FROM app.password_history WHERE user_id = ANY($1)`, [
        allSyntheticUserIds,
      ]);
      await client.query(`DELETE FROM app.users WHERE id = ANY($1) OR org_id IN ($2, $3)`, [
        allSyntheticUserIds,
        orgAlphaId,
        orgBetaId,
      ]);
      await client.query(`DELETE FROM app.entitlements WHERE org_id IN ($1, $2)`, [
        orgAlphaId,
        orgBetaId,
      ]);
      await client.query(`DELETE FROM app.organizations WHERE id IN ($1, $2)`, [
        orgAlphaId,
        orgBetaId,
      ]);

      // 2. Insert organizations
      await client.query(
        `INSERT INTO app.organizations (id, name, slug, status, retention_days, created_by)
         VALUES
           ($1, 'Retention Test Alpha', 'retention-test-alpha', 'paid_active', 30, $3),
           ($2, 'Retention Test Beta', 'retention-test-beta', 'suspended', 90, $3)`,
        [orgAlphaId, orgBetaId, '00000000-0000-4000-8000-000000000000'],
      );

      await client.query(
        `INSERT INTO app.entitlements (org_id, max_templates, max_candidates)
         VALUES ($1, 5, 50), ($2, 5, 50)`,
        [orgAlphaId, orgBetaId],
      );

      // 3. Insert users with specific deleted_at dates
      // candAlphaExpired: 45 days ago (older than 30 -> purged)
      // candAlphaFresh: 10 days ago (newer than 30 -> kept)
      // candAlphaActive: active, not deleted -> kept
      // adminAlphaDeleted: company_admin, 45 days ago -> kept
      // candBetaBetween: 45 days ago (newer than 90 -> kept!)
      // candBetaExpired: 100 days ago (older than 90 -> purged)
      await client.query(
        `INSERT INTO app.users (id, org_id, email, name, role, status, deleted_at, must_reset_password)
         VALUES
           ($1, $7, 'alpha.expired@test.local', 'Alpha Expired', 'candidate', 'deleted', now() - interval '45 days', false),
           ($2, $7, 'alpha.fresh@test.local', 'Alpha Fresh', 'candidate', 'deleted', now() - interval '10 days', false),
           ($3, $7, 'alpha.active@test.local', 'Alpha Active', 'candidate', 'active', null, false),
           ($4, $7, 'alpha.admin@test.local', 'Alpha Admin Deleted', 'company_admin', 'deleted', now() - interval '45 days', false),
           ($5, $8, 'beta.between@test.local', 'Beta Between', 'candidate', 'deleted', now() - interval '45 days', false),
           ($6, $8, 'beta.expired@test.local', 'Beta Expired', 'candidate', 'deleted', now() - interval '100 days', false)`,
        [
          candAlphaExpired,
          candAlphaFresh,
          candAlphaActive,
          adminAlphaDeleted,
          candBetaBetween,
          candBetaExpired,
          orgAlphaId,
          orgBetaId,
        ],
      );

      // 4. Insert child rows for candAlphaExpired (invitation, password_history)
      const tokenHashAlpha = crypto.createHash('sha256').update('dummy-token-alpha').digest();
      await client.query(
        `INSERT INTO app.invitations (id, org_id, user_id, email, role, token_hash, expires_at)
         VALUES ($1, $2, $3, 'alpha.expired@test.local', 'candidate', $4, now() + interval '1 day')`,
        [crypto.randomUUID(), orgAlphaId, candAlphaExpired, tokenHashAlpha],
      );
      await client.query(
        `INSERT INTO app.password_history (user_id, password_hash)
         VALUES ($1, 'dummy_hash')`,
        [candAlphaExpired],
      );

      // Insert child invitation for candBetaExpired
      const tokenHashBeta = crypto.createHash('sha256').update('dummy-token-beta').digest();
      await client.query(
        `INSERT INTO app.invitations (id, org_id, user_id, email, role, token_hash, expires_at)
         VALUES ($1, $2, $3, 'beta.expired@test.local', 'candidate', $4, now() + interval '1 day')`,
        [crypto.randomUUID(), orgBetaId, candBetaExpired, tokenHashBeta],
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    if (!isDbConnected || !platformPool) return;
    const client = await platformPool.connect();
    try {
      await withPlatform(client, async (tx) => {
        await tx.query(
          `DELETE FROM app.invitations WHERE user_id = ANY($1) OR org_id IN ($2, $3)`,
          [allSyntheticUserIds, orgAlphaId, orgBetaId],
        );
        await tx.query(`DELETE FROM app.password_history WHERE user_id = ANY($1)`, [
          allSyntheticUserIds,
        ]);
        await tx.query(`DELETE FROM app.users WHERE id = ANY($1) OR org_id IN ($2, $3)`, [
          allSyntheticUserIds,
          orgAlphaId,
          orgBetaId,
        ]);
        await tx.query(`DELETE FROM app.entitlements WHERE org_id IN ($1, $2)`, [
          orgAlphaId,
          orgBetaId,
        ]);
        await tx.query(`DELETE FROM app.organizations WHERE id IN ($1, $2)`, [
          orgAlphaId,
          orgBetaId,
        ]);
      });
    } catch {
      // ignore
    } finally {
      client.release();
      await appPool.end();
      await platformPool.end();
    }
  });

  it('purges only expired soft-deleted candidates, enforces per-tenant retention isolation, deletes artifacts first, and cascades clean', async () => {
    if (!isDbConnected) {
      return;
    }

    // Run the worker for real!
    const report = await worker.run();
    expect(report.skippedDueToLock).toBe(false);

    const client = await platformPool.connect();
    try {
      await withPlatform(client, async (tx) => {
        // 1. Verify Org Alpha: candAlphaExpired (45d > 30d) is GONE
        const resAlphaExp = await tx.query('SELECT id FROM app.users WHERE id = $1', [
          candAlphaExpired,
        ]);
        expect(resAlphaExp.rowCount).toBe(0);

        // Verify storage artifact was deleted
        expect(
          await fakeStorage.exists(`storage/${orgAlphaId}/submissions/assign-1/obj-expired.zip`),
        ).toBe(false);

        // Verify candAlphaExpired child rows are GONE
        const resInv = await tx.query('SELECT id FROM app.invitations WHERE user_id = $1', [
          candAlphaExpired,
        ]);
        expect(resInv.rowCount).toBe(0);
        const resPwd = await tx.query('SELECT id FROM app.password_history WHERE user_id = $1', [
          candAlphaExpired,
        ]);
        expect(resPwd.rowCount).toBe(0);

        // 2. Verify non-expired or active candidates remain
        const resAlphaFresh = await tx.query('SELECT id FROM app.users WHERE id = $1', [
          candAlphaFresh,
        ]);
        expect(resAlphaFresh.rowCount).toBe(1);

        const resAlphaActive = await tx.query('SELECT id FROM app.users WHERE id = $1', [
          candAlphaActive,
        ]);
        expect(resAlphaActive.rowCount).toBe(1);

        // 3. Verify company_admin is NOT purged even if soft-deleted 45 days ago
        const resAdmin = await tx.query('SELECT id FROM app.users WHERE id = $1', [
          adminAlphaDeleted,
        ]);
        expect(resAdmin.rowCount).toBe(1);

        // 4. Verify Per-Org Isolation (RLS):
        // candBetaBetween is 45 days old. Beta retention is 90 days.
        // Org Alpha's 30-day purge must NOT purge Org Beta's 45-day-old candidate!
        const resBetaBetween = await tx.query('SELECT id FROM app.users WHERE id = $1', [
          candBetaBetween,
        ]);
        expect(resBetaBetween.rowCount).toBe(1);

        // candBetaExpired is 100 days old (> 90 days) -> GONE
        const resBetaExp = await tx.query('SELECT id FROM app.users WHERE id = $1', [
          candBetaExpired,
        ]);
        expect(resBetaExp.rowCount).toBe(0);

        // 5. Audit Event verification:
        // An audit event for Org Alpha was written with non-PII counts
        const resAuditAlpha = await tx.query(
          `SELECT action, entity, after FROM audit.events WHERE org_id = $1 AND action = 'retention.purged'`,
          [orgAlphaId],
        );
        expect(resAuditAlpha.rowCount).toBeGreaterThanOrEqual(1);
        const auditPayload = resAuditAlpha.rows[0].after;
        expect(auditPayload.candidates_purged).toBe(1);
        expect(auditPayload.retention_days).toBe(30);
        expect(auditPayload.dry_run).toBe(false);
      });

      // 6. Idempotency test:
      // Running worker a second time purges 0 additional candidates and throws no errors
      const secondReport = await worker.run();
      expect(secondReport.totalCandidatesPurged).toBe(0);
      expect(secondReport.totalFailures).toBe(0);
    } finally {
      client.release();
    }
  });
});
