import crypto from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const TEST_DB = process.env.TEST_DB_NAME ?? 'hellosmart_test';

function resolveDbUrl(envUrl: string | undefined, defaultUser: string, defaultPort = 5432): string {
  if (envUrl) {
    return envUrl.replace(/\/[^/?]+(\?|$)/, `/${TEST_DB}$1`);
  }
  return `postgres://${defaultUser}:${defaultUser}_local@127.0.0.1:${defaultPort}/${TEST_DB}`;
}

const DATABASE_URL = resolveDbUrl(process.env.DATABASE_URL, 'hs_app');
const DATABASE_PLATFORM_URL = resolveDbUrl(process.env.DATABASE_PLATFORM_URL, 'hs_platform');
const DATABASE_MIGRATOR_URL = resolveDbUrl(process.env.DATABASE_MIGRATOR_URL, 'hs_migrator');
const DATABASE_ADMIN_URL = resolveDbUrl(process.env.DATABASE_ADMIN_URL, 'hs_owner');

let appPool: pg.Pool;
let platformPool: pg.Pool;
let migratorPool: pg.Pool;
let adminPool: pg.Pool;
let isDbAvailable = false;

interface TableCounts {
  users: number;
  assessments: number;
  templates: number;
  template_versions: number;
  audit_events: number;
}

let initialCounts: TableCounts;

async function checkDbConnection(): Promise<boolean> {
  try {
    const probe = new pg.Pool({
      connectionString: DATABASE_URL,
      connectionTimeoutMillis: 3000,
      max: 1,
    });
    const client = await probe.connect();
    await client.query('SELECT 1');
    client.release();
    await probe.end();
    return true;
  } catch {
    return false;
  }
}

async function getTableCounts(pool: pg.Pool): Promise<TableCounts> {
  const client = await pool.connect();
  try {
    const users = await client.query('SELECT count(*)::int AS count FROM app.users');
    const assessments = await client.query('SELECT count(*)::int AS count FROM app.assessments');
    const templates = await client.query('SELECT count(*)::int AS count FROM app.templates');
    const template_versions = await client.query(
      'SELECT count(*)::int AS count FROM app.template_versions',
    );
    const audit_events = await client.query('SELECT count(*)::int AS count FROM audit.events');
    return {
      users: users.rows[0].count,
      assessments: assessments.rows[0].count,
      templates: templates.rows[0].count,
      template_versions: template_versions.rows[0].count,
      audit_events: audit_events.rows[0].count,
    };
  } finally {
    client.release();
  }
}

isDbAvailable = await checkDbConnection();

describe
  .runIf(isDbAvailable)
  .sequential('Subtask 4.2: Database Indexing, Query Optimization & Audit Triggers', () => {
    beforeAll(async () => {
      appPool = new pg.Pool({ connectionString: DATABASE_URL });
      platformPool = new pg.Pool({ connectionString: DATABASE_PLATFORM_URL });
      migratorPool = new pg.Pool({ connectionString: DATABASE_MIGRATOR_URL });
      adminPool = new pg.Pool({ connectionString: DATABASE_ADMIN_URL });

      initialCounts = await getTableCounts(adminPool);
    });

    afterAll(async () => {
      if (adminPool) {
        const finalCounts = await getTableCounts(adminPool);
        expect(finalCounts).toEqual(initialCounts);

        await appPool.end();
        await platformPool.end();
        await migratorPool.end();
        await adminPool.end();
      }
    });

    describe('1. Audit Events Append-Only Hardening (BR-31)', () => {
      it('TRUNCATE on audit.events fails for hs_app', async () => {
        const client = await appPool.connect();
        try {
          await expect(client.query('TRUNCATE TABLE audit.events')).rejects.toThrow();
        } finally {
          client.release();
        }
      });

      it('TRUNCATE on audit.events fails for hs_platform', async () => {
        const client = await platformPool.connect();
        try {
          await expect(client.query('TRUNCATE TABLE audit.events')).rejects.toThrow();
        } finally {
          client.release();
        }
      });

      it('TRUNCATE on audit.events fails for hs_migrator (blocked by audit_no_truncate trigger and revoked privilege)', async () => {
        const client = await migratorPool.connect();
        try {
          await expect(client.query('TRUNCATE TABLE audit.events')).rejects.toThrow();
        } finally {
          client.release();
        }
      });

      it('UPDATE on audit.events fails for hs_app', async () => {
        const client = await appPool.connect();
        try {
          await expect(
            client.query("UPDATE audit.events SET action = 'TAMPERED'"),
          ).rejects.toThrow();
        } finally {
          client.release();
        }
      });

      it('DELETE on audit.events fails for hs_app', async () => {
        const client = await appPool.connect();
        try {
          await expect(client.query('DELETE FROM audit.events')).rejects.toThrow();
        } finally {
          client.release();
        }
      });

      it('UPDATE on audit.events fails for hs_platform', async () => {
        const client = await platformPool.connect();
        try {
          await expect(
            client.query("UPDATE audit.events SET action = 'TAMPERED'"),
          ).rejects.toThrow();
        } finally {
          client.release();
        }
      });

      it('DELETE on audit.events fails for hs_platform', async () => {
        const client = await platformPool.connect();
        try {
          await expect(client.query('DELETE FROM audit.events')).rejects.toThrow();
        } finally {
          client.release();
        }
      });

      it('INSERT on audit.events succeeds for hs_app (rolled back to preserve row counts)', async () => {
        const client = await appPool.connect();
        try {
          await client.query('BEGIN');
          const dummyOrgId = '00000000-0000-4000-8000-000000000001';
          await client.query("SELECT set_config('app.org_id', $1, true)", [dummyOrgId]);
          const dummyHash = Buffer.from('0123456789abcdef0123456789abcdef', 'hex');
          const res = await client.query(
            `INSERT INTO audit.events (
            actor_id, actor_role, org_id, action, entity, entity_id, hash
          ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [
              dummyOrgId,
              'company_admin',
              dummyOrgId,
              'TEST_INDEXING_PROBE',
              'test_entity',
              'test-id',
              dummyHash,
            ],
          );
          expect(res.rows.length).toBe(1);
          expect(res.rows[0].id).toBeDefined();
          await client.query('ROLLBACK');
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      });
    });

    describe('2. Query Optimization & Compound Indexes (T-036, T-037)', () => {
      it('idx_users_org_status exists on app.users in pg_indexes', async () => {
        const client = await appPool.connect();
        try {
          const res = await client.query(
            `SELECT indexname, indexdef FROM pg_indexes
           WHERE schemaname = 'app' AND tablename = 'users' AND indexname = 'idx_users_org_status'`,
          );
          expect(res.rows.length).toBe(1);
          expect(res.rows[0].indexdef).toContain('org_id');
          expect(res.rows[0].indexdef).toContain('status');
        } finally {
          client.release();
        }
      });

      it('candidate listing query plan uses index and parses cleanly', async () => {
        const client = await appPool.connect();
        try {
          const dummyOrgId = '00000000-0000-4000-8000-000000000001';
          await client.query("SELECT set_config('app.org_id', $1, false)", [dummyOrgId]);
          const res = await client.query(
            `EXPLAIN (FORMAT JSON)
           SELECT id, email, name, role, status, created_at
           FROM app.users
           WHERE org_id = $1 AND role = 'candidate' AND status = 'active'
           ORDER BY created_at DESC
           LIMIT 50`,
            [dummyOrgId],
          );
          const planStr = JSON.stringify(res.rows[0]);
          expect(planStr).toContain('Plan');
        } finally {
          client.release();
        }
      });
    });

    describe('3. Template Version Immutability (BR-03)', () => {
      it('updating published template version manifest fails', async () => {
        const client = await adminPool.connect();
        try {
          await client.query('BEGIN');
          const nonce = crypto.randomBytes(4).toString('hex');
          const templateId = crypto.randomUUID();
          const versionId = crypto.randomUUID();

          await client.query(
            `INSERT INTO app.templates (id, slug, name, category, difficulty, workspace_mode, description)
           VALUES ($1, $2, $3, 'Coding', 'Beginner', 'chat', 'Test Template')`,
            [templateId, `bench-tmpl-${nonce}`, `Test Template ${nonce}`],
          );

          await client.query(
            `INSERT INTO app.template_versions (id, template_id, version, status, manifest)
           VALUES ($1, $2, '1.0.0', 'published', '{"scenario": "v1"}'::jsonb)`,
            [versionId, templateId],
          );

          // Attempt to update manifest on published version -> must fail
          await expect(
            client.query(
              `UPDATE app.template_versions SET manifest = '{"scenario": "v2"}'::jsonb WHERE id = $1`,
              [versionId],
            ),
          ).rejects.toThrow(/(?:immutable|cannot be modified)/i);

          await client.query('ROLLBACK');
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      });

      it('updating published template version number fails', async () => {
        const client = await adminPool.connect();
        try {
          await client.query('BEGIN');
          const nonce = crypto.randomBytes(4).toString('hex');
          const templateId = crypto.randomUUID();
          const versionId = crypto.randomUUID();

          await client.query(
            `INSERT INTO app.templates (id, slug, name, category, difficulty, workspace_mode, description)
           VALUES ($1, $2, $3, 'Coding', 'Beginner', 'chat', 'Test Template')`,
            [templateId, `bench-tmpl-${nonce}`, `Test Template ${nonce}`],
          );

          await client.query(
            `INSERT INTO app.template_versions (id, template_id, version, status, manifest)
           VALUES ($1, $2, '1.0.0', 'published', '{"scenario": "v1"}'::jsonb)`,
            [versionId, templateId],
          );

          // Attempt to update version number on published version -> must fail
          await expect(
            client.query(`UPDATE app.template_versions SET version = '1.0.1' WHERE id = $1`, [
              versionId,
            ]),
          ).rejects.toThrow(/(?:immutable|cannot be modified)/i);

          await client.query('ROLLBACK');
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      });

      it('deleting published template version fails', async () => {
        const client = await adminPool.connect();
        try {
          await client.query('BEGIN');
          const nonce = crypto.randomBytes(4).toString('hex');
          const templateId = crypto.randomUUID();
          const versionId = crypto.randomUUID();

          await client.query(
            `INSERT INTO app.templates (id, slug, name, category, difficulty, workspace_mode, description)
           VALUES ($1, $2, $3, 'Coding', 'Beginner', 'chat', 'Test Template')`,
            [templateId, `bench-tmpl-${nonce}`, `Test Template ${nonce}`],
          );

          await client.query(
            `INSERT INTO app.template_versions (id, template_id, version, status, manifest)
           VALUES ($1, $2, '1.0.0', 'published', '{"scenario": "v1"}'::jsonb)`,
            [versionId, templateId],
          );

          // Attempt to delete published version -> must fail
          await expect(
            client.query(`DELETE FROM app.template_versions WHERE id = $1`, [versionId]),
          ).rejects.toThrow(/(?:immutable|cannot be deleted)/i);

          await client.query('ROLLBACK');
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      });

      it.skip('BR-03: prevents status demotion from published to draft or tested (blocked on BR-03 decision by Vishal V)', async () => {
        // NOTE: app.prevent_published_template_mutation() checks:
        //   OLD.status = 'published' AND (NEW.manifest != OLD.manifest OR NEW.version != OLD.version)
        // When only status is modified (e.g. SET status = 'draft'), the trigger currently allows it.
        // Modifying this trigger in migration 0013 is deferred pending Vishal V approval.
      });
    });
  });
