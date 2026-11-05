import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { runSafeSeed } from '../dist/lib/upsert.js';
import { deterministicUuid, normaliseEmail } from '../dist/lib/keys.js';
import { ASTER_RIDGE_ID, BRINDLE_CO_ID, SUPERADMIN_ID } from '../dist/entities/organizations.js';

function resolveTestDbUrl(): string {
  if (process.env.TEST_DATABASE_URL) {
    return process.env.TEST_DATABASE_URL;
  }
  // Default docker-compose mapped port is 5434 (or standard 5432)
  return 'postgres://hs_migrator:hs_migrator_local@localhost:5434/hellosmart_test';
}

describe('Deterministic UUID & Idempotent Upsert Tests ([6.2])', () => {
  const TEST_DB_URL = resolveTestDbUrl();
  let client: pg.Client | null = null;
  let dbAvailable = false;

  before(async () => {
    process.env.SEED_DEFAULT_PASSWORD = 'TestSeedPassword123!';
    process.env.SEED_PLATFORM_ADMIN_TOTP_SECRET = 'JBSWY3DPEHPK3PXP';

    try {
      client = new pg.Client({ connectionString: TEST_DB_URL });
      await client.connect();
      dbAvailable = true;

      // Clean test database for test suite in reverse FK order
      await client.query('SET search_path TO app, public;');
      await client.query("SELECT set_config('app.is_platform', 'true', false);");
      await client.query('DELETE FROM app.invitations;');
      await client.query('DELETE FROM app.users;');
      await client.query('DELETE FROM app.entitlements;');
      await client.query('DELETE FROM app.organizations;');
    } catch (err: any) {
      console.warn(
        `Local test DB not reachable at ${TEST_DB_URL} (${err.message}). Skipping DB integration tests.`,
      );
      dbAvailable = false;
      if (client) {
        try {
          await client.end();
        } catch {}
        client = null;
      }
    }
  });

  after(async () => {
    if (client) {
      await client.end();
    }
  });

  describe('Deterministic ID Generation', () => {
    it('produces identical UUID across calls for same email with different whitespace and casing', () => {
      const email1 = 'Candidate.Active@Example.Com';
      const email2 = '   candidate.active@example.com   ';
      const email3 = '\tcandidate.active@example.com\n';

      const id1 = deterministicUuid('candidate', normaliseEmail(email1));
      const id2 = deterministicUuid('candidate', normaliseEmail(email2));
      const id3 = deterministicUuid('candidate', normaliseEmail(email3));

      assert.strictEqual(id1, id2);
      assert.strictEqual(id2, id3);
      assert.match(id1, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('produces expected deterministic IDs matching 6.1 constants', () => {
      const superAdminId = deterministicUuid('user', 'superadmin@hellosmart.ai');
      const asterOrgId = deterministicUuid('org', 'aster-ridge');
      const brindleOrgId = deterministicUuid('org', 'brindle-co');

      assert.strictEqual(superAdminId, SUPERADMIN_ID);
      assert.strictEqual(asterOrgId, ASTER_RIDGE_ID);
      assert.strictEqual(brindleOrgId, BRINDLE_CO_ID);
    });
  });

  describe('Idempotent Upsert & Database Integration', () => {
    const TEST_PASSWORD = 'TestSeedPassword123!';

    it('Run 1: seeds initial dataset into empty database', async (t) => {
      if (!dbAvailable || !client) {
        return t.skip('Postgres test database not available');
      }

      const summary = await runSafeSeed(client, {
        nodeEnv: 'test',
        databaseUrl: TEST_DB_URL,
        seedPassword: TEST_PASSWORD,
      });

      assert.strictEqual(summary.organizationsUpserted, 3);
      assert.strictEqual(summary.entitlementsUpserted, 3);
      assert.strictEqual(summary.platformAdminsUpserted, 1);
      assert.strictEqual(summary.companyAdminsUpserted, 3);
      assert.strictEqual(summary.candidatesUpserted, 110);
      assert.strictEqual(summary.invitationsUpserted, 3);
      assert.strictEqual(summary.totalRecordsUpserted, 123);

      // Verify row counts in DB
      const orgsCount = await client.query('SELECT count(*)::int AS count FROM app.organizations;');
      const entsCount = await client.query('SELECT count(*)::int AS count FROM app.entitlements;');
      const usersCount = await client.query('SELECT count(*)::int AS count FROM app.users;');
      const invsCount = await client.query('SELECT count(*)::int AS count FROM app.invitations;');

      assert.strictEqual(orgsCount.rows[0].count, 3);
      assert.strictEqual(entsCount.rows[0].count, 3);
      assert.strictEqual(usersCount.rows[0].count, 114); // 1 superadmin + 3 company admins + 110 candidates
      assert.strictEqual(invsCount.rows[0].count, 3);
    });

    it('Run 2: re-running seed immediately results in exactly 0 extra rows and unchanged password_hash (idempotency)', async (t) => {
      if (!dbAvailable || !client) {
        return t.skip('Postgres test database not available');
      }

      // Record created_at timestamps and password hashes from Run 1
      const preRunUsers = await client.query(
        'SELECT id, created_at, password_hash FROM app.users ORDER BY id;',
      );

      // Execute seed a second time
      const summary = await runSafeSeed(client, {
        nodeEnv: 'test',
        databaseUrl: TEST_DB_URL,
        seedPassword: TEST_PASSWORD,
      });

      assert.strictEqual(summary.totalRecordsUpserted, 123);

      // Verify row counts remain identical (0 extra rows created)
      const orgsCount = await client.query('SELECT count(*)::int AS count FROM app.organizations;');
      const entsCount = await client.query('SELECT count(*)::int AS count FROM app.entitlements;');
      const usersCount = await client.query('SELECT count(*)::int AS count FROM app.users;');
      const invsCount = await client.query('SELECT count(*)::int AS count FROM app.invitations;');

      assert.strictEqual(orgsCount.rows[0].count, 3, 'Orgs count must remain 3');
      assert.strictEqual(entsCount.rows[0].count, 3, 'Entitlements count must remain 3');
      assert.strictEqual(usersCount.rows[0].count, 114, 'Users count must remain 114');
      assert.strictEqual(invsCount.rows[0].count, 3, 'Invitations count must remain 3');

      // Verify created_at and password_hash were NOT modified on conflict
      const postRunUsers = await client.query(
        'SELECT id, created_at, password_hash FROM app.users ORDER BY id;',
      );
      for (let i = 0; i < preRunUsers.rows.length; i++) {
        const pre = preRunUsers.rows[i];
        const post = postRunUsers.rows[i];
        assert.strictEqual(
          pre.created_at.toISOString(),
          post.created_at.toISOString(),
          `User ${pre.id} created_at must remain unchanged on upsert`,
        );
        assert.strictEqual(
          pre.password_hash,
          post.password_hash,
          `User ${pre.id} password_hash must remain unchanged on upsert (idempotency)`,
        );
      }
    });

    it('Transaction Rollback: rolls back atomically when an error occurs so no partial data is written', async (t) => {
      if (!dbAvailable || !client) {
        return t.skip('Postgres test database not available');
      }

      // Reset DB to clean state
      await client.query('DELETE FROM app.invitations;');
      await client.query('DELETE FROM app.users;');
      await client.query('DELETE FROM app.entitlements;');
      await client.query('DELETE FROM app.organizations;');

      // Create a proxy client that throws an error mid-transaction during organizations insert
      let queryCallCount = 0;
      const failingClient = {
        query: async (queryText: any, params: any) => {
          queryCallCount++;
          if (
            typeof queryText === 'string' &&
            queryText.includes('INSERT INTO app.organizations')
          ) {
            throw new Error('SIMULATED_TRANSACTION_FAILURE');
          }
          return client!.query(queryText, params);
        },
      } as any;

      await assert.rejects(
        () =>
          runSafeSeed(failingClient, {
            nodeEnv: 'test',
            databaseUrl: TEST_DB_URL,
            seedPassword: TEST_PASSWORD,
          }),
        /SIMULATED_TRANSACTION_FAILURE/,
      );

      // Verify that due to rollback, 0 rows exist in any table
      const usersCount = await client.query('SELECT count(*)::int AS count FROM app.users;');
      const orgsCount = await client.query('SELECT count(*)::int AS count FROM app.organizations;');
      assert.strictEqual(usersCount.rows[0].count, 0, 'No users should remain after rollback');
      assert.strictEqual(orgsCount.rows[0].count, 0, 'No orgs should remain after rollback');
    });
  });
});
