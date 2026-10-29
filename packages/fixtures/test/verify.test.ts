import assert from 'node:assert';
import { before, after, describe, it } from 'node:test';
import pg from 'pg';
import { runVerifySeed, DEFAULT_REQUIRE_ALL_ACTIVE_USERS_HASH } from '../dist/verify.js';
import { runSafeSeed, ensureInvitationsTable } from '../dist/lib/upsert.js';
import { deterministicUuid } from '../dist/lib/keys.js';
import { SUPERADMIN_ID, ASTER_RIDGE_ID } from '../dist/entities/organizations.js';

function resolveTestDbUrl(): string {
  if (process.env.TEST_DATABASE_URL) {
    return process.env.TEST_DATABASE_URL;
  }
  return 'postgres://hs_migrator:hs_migrator_local@localhost:5434/hellosmart_test';
}

describe('Seed Verification Command & Data Integrity Checks ([13.3])', () => {
  const TEST_DB_URL = resolveTestDbUrl();
  let client: pg.Client | null = null;
  let dbAvailable = false;
  const TEST_PASSWORD = 'TestSeedPassword123!';
  const TEST_TOTP = 'JBSWY3DPEHPK3PXP';

  before(async () => {
    process.env.SEED_DEFAULT_PASSWORD = TEST_PASSWORD;
    process.env.SEED_PLATFORM_ADMIN_TOTP_SECRET = TEST_TOTP;

    try {
      client = new pg.Client({ connectionString: TEST_DB_URL });
      await client.connect();
      dbAvailable = true;

      // Ensure clean state and seed test database
      await client.query('SET search_path TO app, public;');
      await client.query("SELECT set_config('app.is_platform', 'true', false);");
      await ensureInvitationsTable(client);

      // Perform initial clean seed
      await runSafeSeed(client, {
        databaseUrl: TEST_DB_URL,
        nodeEnv: 'test',
        seedPassword: TEST_PASSWORD,
        totpSecret: TEST_TOTP,
      });
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
      try {
        await client.end();
      } catch {}
      client = null;
    }
  });

  describe('Pre-Flight Environment Safety Guard', () => {
    it('refuses verification before connecting when NODE_ENV is production', async () => {
      await assert.rejects(async () => {
        await runVerifySeed({
          nodeEnv: 'production',
          databaseUrl: TEST_DB_URL,
          quiet: true,
        });
      }, /SECURITY FATAL: Database seed script execution is strictly forbidden when NODE_ENV is 'production'/);
    });

    it('refuses verification before connecting when DATABASE_URL points to non-local host', async () => {
      await assert.rejects(async () => {
        await runVerifySeed({
          nodeEnv: 'test',
          databaseUrl: 'postgres://hs_migrator:secret@production-db.hellosmart.ai:5432/hellosmart',
          quiet: true,
        });
      }, /SECURITY FATAL: Database host 'production-db\.hellosmart\.ai' is non-local and not in the approved local host allowlist/);
    });

    it('refuses verification before connecting when DATABASE_URL is missing', async () => {
      const origMigrator = process.env.DATABASE_MIGRATOR_URL;
      const origDb = process.env.DATABASE_URL;
      delete process.env.DATABASE_MIGRATOR_URL;
      delete process.env.DATABASE_URL;

      try {
        await assert.rejects(async () => {
          await runVerifySeed({
            nodeEnv: 'test',
            databaseUrl: '',
            quiet: true,
          });
        }, /DATABASE_URL is not set/);
      } finally {
        if (origMigrator) process.env.DATABASE_MIGRATOR_URL = origMigrator;
        if (origDb) process.env.DATABASE_URL = origDb;
      }
    });
  });

  describe('Freshly Seeded Database Integrity Checks', () => {
    it('DEFAULT_REQUIRE_ALL_ACTIVE_USERS_HASH is true as specified by requirement', () => {
      assert.strictEqual(
        DEFAULT_REQUIRE_ALL_ACTIVE_USERS_HASH,
        true,
        'DEFAULT_REQUIRE_ALL_ACTIVE_USERS_HASH must be true as written in requirements',
      );
    });

    describe('Freshly Seeded Database Integrity Checks', () => {
      it('DEFAULT_REQUIRE_ALL_ACTIVE_USERS_HASH is true as specified by requirement', () => {
        assert.strictEqual(
          DEFAULT_REQUIRE_ALL_ACTIVE_USERS_HASH,
          true,
          'DEFAULT_REQUIRE_ALL_ACTIVE_USERS_HASH must be true as written in requirements',
        );
      });

      it('passes all verification checks on freshly seeded DB with strict check by default', async (t) => {
        if (!dbAvailable) {
          return t.skip('Test database not available');
        }

        const summary = await runVerifySeed({
          databaseUrl: TEST_DB_URL,
          nodeEnv: 'test',
          seedPassword: TEST_PASSWORD,
          totpSecret: TEST_TOTP,
          quiet: true,
        });

        assert.strictEqual(
          summary.passed,
          true,
          'Verification must pass on freshly seeded database with default strict checking',
        );
        assert.strictEqual(summary.failedChecks, 0);

        // Verify specific check results
        const recordCounts = summary.checks.find((c) => c.name === 'Table Record Counts');
        assert.strictEqual(recordCounts?.status, 'PASS');
        assert.ok(recordCounts?.details.includes('123 records total'));

        const userDist = summary.checks.find((c) => c.name === 'User Role & Status Distribution');
        assert.strictEqual(userDist?.status, 'PASS');
        assert.ok(userDist?.details.includes('78 active, 18 invited, 11 suspended, 7 deleted'));

        const scoping = summary.checks.find((c) => c.name === 'Tenant Scoping & Foreign Keys');
        assert.strictEqual(scoping?.status, 'PASS');

        const hashCheck = summary.checks.find((c) => c.name === 'Active User Password Hashes');
        assert.strictEqual(hashCheck?.status, 'PASS');
        assert.ok(
          hashCheck?.details.includes('All 78 active users have non-null Argon2id password_hash'),
        );

        const mfa = summary.checks.find((c) => c.name === 'Platform Admin MFA Configuration');
        assert.strictEqual(mfa?.status, 'PASS');
        assert.ok(
          mfa?.details.includes('valid env: reference configured'),
          'MFA verification must confirm valid env: reference is configured',
        );

        const ents = summary.checks.find((c) => c.name === 'Entitlements & Trial Windows');
        assert.strictEqual(ents?.status, 'PASS');

        const invs = summary.checks.find((c) => c.name === 'Invitations State & Token Hashes');
        assert.strictEqual(invs?.status, 'PASS');

        const del = summary.checks.find((c) => c.name === 'Soft-Deletion Invariants');
        assert.strictEqual(del?.status, 'PASS');

        const scan = summary.checks.find((c) => c.name === 'Plaintext Secret & Pattern Scan');
        assert.strictEqual(scan?.status, 'PASS');

        // Idempotency runs by default
        const idemp = summary.checks.find((c) => c.name === 'Seed Idempotency & Run Timing');
        assert.strictEqual(idemp?.status, 'PASS');
        assert.ok(summary.idempotencyResult);
        assert.strictEqual(
          summary.idempotencyResult.countsMatch,
          true,
          'Row counts must match across seed runs',
        );
        assert.ok(
          summary.idempotencyResult.run1DurationMs < 3000,
          `Run 1 duration (${summary.idempotencyResult.run1DurationMs}ms) must stay under 3000ms`,
        );
        assert.ok(
          summary.idempotencyResult.run2DurationMs < 3000,
          `Run 2 duration (${summary.idempotencyResult.run2DurationMs}ms) must stay under 3000ms`,
        );
      });

      it('passes verification with --loginable-only-hashes flag', async (t) => {
        if (!dbAvailable) {
          return t.skip('Test database not available');
        }

        const summary = await runVerifySeed({
          databaseUrl: TEST_DB_URL,
          nodeEnv: 'test',
          checkAllActiveUsersHaveHash: false,
          seedPassword: TEST_PASSWORD,
          totpSecret: TEST_TOTP,
          skipIdempotency: true,
          quiet: true,
        });

        assert.strictEqual(summary.passed, true);
        const hashCheck = summary.checks.find((c) =>
          c.name.includes('Active User Password Hashes (Loginable Accounts Only)'),
        );
        assert.strictEqual(hashCheck?.status, 'PASS');
        assert.ok(
          hashCheck?.details.includes(
            'All designated loginable active accounts have valid Argon2id hashes',
          ),
        );
      });

      it('skips idempotency check when skipIdempotency is true', async (t) => {
        if (!dbAvailable) {
          return t.skip('Test database not available');
        }

        const summary = await runVerifySeed({
          databaseUrl: TEST_DB_URL,
          nodeEnv: 'test',
          skipIdempotency: true,
          seedPassword: TEST_PASSWORD,
          totpSecret: TEST_TOTP,
          quiet: true,
        });

        assert.strictEqual(summary.passed, true);
        const idemp = summary.checks.find((c) => c.name === 'Seed Idempotency & Run Timing');
        assert.strictEqual(idemp?.status, 'SKIPPED');
      });
    });
  });

  describe('Failure Cases & Plaintext Secret Detection', () => {
    it('fails when SEED_DEFAULT_PASSWORD appears as plaintext in a user column', async (t) => {
      if (!dbAvailable || !client) {
        return t.skip('Test database not available');
      }

      const scratchUserId = deterministicUuid('user', 'scratch-plaintext-test@asterridge.com');
      try {
        await client.query(
          `INSERT INTO app.users (
            id, org_id, email, name, role, status, email_verified_at, must_reset_password
          ) VALUES ($1, $2, $3, $4, 'candidate', 'active', now(), false);`,
          [scratchUserId, ASTER_RIDGE_ID, 'scratch-plaintext-test@asterridge.com', TEST_PASSWORD],
        );

        const summary = await runVerifySeed({
          databaseUrl: TEST_DB_URL,
          nodeEnv: 'test',
          checkAllActiveUsersHaveHash: false,
          seedPassword: TEST_PASSWORD,
          totpSecret: TEST_TOTP,
          quiet: true,
        });

        assert.strictEqual(
          summary.passed,
          false,
          'Plaintext password in name must fail verification',
        );
        const scan = summary.checks.find((c) => c.name === 'Plaintext Secret & Pattern Scan');
        assert.strictEqual(scan?.status, 'FAIL');
        assert.ok(
          scan?.errors?.some((e) => e.includes("table 'app.users'") && e.includes("column 'name'")),
          'Diagnostic must cite table app.users and column name',
        );
      } finally {
        await client.query('DELETE FROM app.users WHERE id = $1;', [scratchUserId]);
      }
    });

    it('fails when a plaintext Base32 secret is stored in mfa_secret_ref', async (t) => {
      if (!dbAvailable || !client) {
        return t.skip('Test database not available');
      }

      try {
        await client.query('UPDATE app.users SET mfa_secret_ref = $1 WHERE id = $2;', [
          'JBSWY3DPEHPK3PXP',
          SUPERADMIN_ID,
        ]);

        const summary = await runVerifySeed({
          databaseUrl: TEST_DB_URL,
          nodeEnv: 'test',
          checkAllActiveUsersHaveHash: false,
          seedPassword: TEST_PASSWORD,
          totpSecret: TEST_TOTP,
          quiet: true,
        });

        assert.strictEqual(summary.passed, false);
        const mfaCheck = summary.checks.find((c) => c.name === 'Platform Admin MFA Configuration');
        assert.strictEqual(mfaCheck?.status, 'FAIL');
        assert.ok(mfaCheck?.details.includes('plaintext'));
      } finally {
        await client.query(
          "UPDATE app.users SET mfa_secret_ref = 'env:PLATFORM_ADMIN_MFA_SECRET' WHERE id = $1;",
          [SUPERADMIN_ID],
        );
      }
    });

    it('fails when an unhashed invitation token is stored in token_hash', async (t) => {
      if (!dbAvailable || !client) {
        return t.skip('Test database not available');
      }

      const validId = deterministicUuid('invitation', 'valid');
      let originalHash: string = '';
      const origRes = await client.query('SELECT token_hash FROM app.invitations WHERE id = $1;', [
        validId,
      ]);
      originalHash = origRes.rows[0]?.token_hash;

      try {
        await client.query('UPDATE app.invitations SET token_hash = $1 WHERE id = $2;', [
          'unhashed-raw-token-not-64-hex',
          validId,
        ]);

        const summary = await runVerifySeed({
          databaseUrl: TEST_DB_URL,
          nodeEnv: 'test',
          checkAllActiveUsersHaveHash: false,
          seedPassword: TEST_PASSWORD,
          totpSecret: TEST_TOTP,
          quiet: true,
        });

        assert.strictEqual(summary.passed, false);
        const invCheck = summary.checks.find((c) => c.name === 'Invitations State & Token Hashes');
        assert.strictEqual(invCheck?.status, 'FAIL');
      } finally {
        if (originalHash) {
          await client.query('UPDATE app.invitations SET token_hash = $1 WHERE id = $2;', [
            originalHash,
            validId,
          ]);
        }
      }
    });

    it('fails when an active user lacks a password_hash', async (t) => {
      if (!dbAvailable || !client) {
        return t.skip('Test database not available');
      }

      const scratchUserId = deterministicUuid('user', 'scratch-unhashed-active@asterridge.com');
      const logs: string[] = [];
      try {
        await client.query(
          `INSERT INTO app.users (
            id, org_id, email, name, role, status, email_verified_at, must_reset_password, password_hash
          ) VALUES ($1, $2, $3, 'Unhashed Active Candidate', 'candidate', 'active', now(), false, NULL);`,
          [scratchUserId, ASTER_RIDGE_ID, 'scratch-unhashed-active@asterridge.com'],
        );

        const summary = await runVerifySeed({
          databaseUrl: TEST_DB_URL,
          nodeEnv: 'test',
          checkAllActiveUsersHaveHash: true,
          seedPassword: TEST_PASSWORD,
          totpSecret: TEST_TOTP,
          skipIdempotency: true,
          quiet: false,
          logger: (msg) => logs.push(msg),
        });

        assert.strictEqual(
          summary.passed,
          false,
          'Missing active user hash must fail verification',
        );
        const hashCheck = summary.checks.find((c) => c.name === 'Active User Password Hashes');
        assert.strictEqual(hashCheck?.status, 'FAIL');

        const output = logs.join('\n');
        assert.doesNotMatch(output, new RegExp(TEST_PASSWORD));
        assert.doesNotMatch(output, new RegExp(TEST_TOTP));
      } finally {
        await client.query('DELETE FROM app.users WHERE id = $1 AND org_id = $2;', [
          scratchUserId,
          ASTER_RIDGE_ID,
        ]);
      }
    });

    it('fails when the platform admin MFA secret is removed and exposes zero secrets in output', async (t) => {
      if (!dbAvailable || !client) {
        return t.skip('Test database not available');
      }

      const logs: string[] = [];
      try {
        await client.query('UPDATE app.users SET mfa_secret_ref = NULL WHERE id = $1;', [
          SUPERADMIN_ID,
        ]);

        const summary = await runVerifySeed({
          databaseUrl: TEST_DB_URL,
          nodeEnv: 'test',
          checkAllActiveUsersHaveHash: false,
          seedPassword: TEST_PASSWORD,
          totpSecret: TEST_TOTP,
          skipIdempotency: true,
          quiet: false,
          logger: (msg) => logs.push(msg),
        });

        assert.strictEqual(summary.passed, false);
        const mfaCheck = summary.checks.find((c) => c.name === 'Platform Admin MFA Configuration');
        assert.strictEqual(mfaCheck?.status, 'FAIL');
        assert.ok(mfaCheck?.errors?.some((e) => e.includes('empty mfa_secret_ref')));

        const output = logs.join('\n');
        assert.doesNotMatch(output, new RegExp(TEST_PASSWORD));
        assert.doesNotMatch(output, new RegExp(TEST_TOTP));
        assert.doesNotMatch(output, /postgres:\/\/.*:.*@/);
      } finally {
        await client.query(
          "UPDATE app.users SET mfa_secret_ref = 'env:PLATFORM_ADMIN_MFA_SECRET' WHERE id = $1;",
          [SUPERADMIN_ID],
        );
      }
    });

    it('confirms PostgreSQL schema prevents non-platform user with NULL org_id via CHECK constraint', async (t) => {
      if (!dbAvailable || !client) {
        return t.skip('Test database not available');
      }

      // Schema check: platform_has_no_org CHECK ((role = 'platform_admin') = (org_id IS NULL))
      await assert.rejects(async () => {
        await client!.query(
          `INSERT INTO app.users (
              id, org_id, email, name, role, status
            ) VALUES (gen_random_uuid(), NULL, 'invalid-non-platform@example.com', 'Invalid User', 'candidate', 'active');`,
        );
      }, /new row for relation "users" violates check constraint "platform_has_no_org"/);
    });

    it('confirms PostgreSQL schema prevents non-platform user with non-existent org_id via foreign key constraint', async (t) => {
      if (!dbAvailable || !client) {
        return t.skip('Test database not available');
      }

      // Schema check: users_org_fk FOREIGN KEY (org_id) REFERENCES app.organizations(id)
      await assert.rejects(async () => {
        await client!.query(
          `INSERT INTO app.users (
              id, org_id, email, name, role, status
            ) VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'invalid-non-existent-org@example.com', 'Invalid User', 'candidate', 'active');`,
        );
      }, /violates (foreign key constraint|row-level security policy)/);
    });

    it('captured failure console output masks all sensitive data and exposes zero secrets', async (t) => {
      if (!dbAvailable || !client) {
        return t.skip('Test database not available');
      }

      const scratchUserId = deterministicUuid(
        'user',
        'scratch-console-masking-test@asterridge.com',
      );
      const logs: string[] = [];

      try {
        await client.query(
          `INSERT INTO app.users (
            id, org_id, email, name, role, status, email_verified_at, must_reset_password
          ) VALUES ($1, $2, $3, $4, 'candidate', 'active', now(), false);`,
          [
            scratchUserId,
            ASTER_RIDGE_ID,
            'scratch-console-masking-test@asterridge.com',
            TEST_PASSWORD,
          ],
        );

        const summary = await runVerifySeed({
          databaseUrl: TEST_DB_URL,
          nodeEnv: 'test',
          checkAllActiveUsersHaveHash: false,
          seedPassword: TEST_PASSWORD,
          totpSecret: TEST_TOTP,
          skipIdempotency: true,
          quiet: false,
          logger: (msg) => logs.push(msg),
        });

        assert.strictEqual(summary.passed, false);
        const combined = logs.join('\n');
        assert.doesNotMatch(
          combined,
          new RegExp(TEST_PASSWORD),
          'Plaintext password must never leak in verification logs',
        );
        assert.doesNotMatch(
          combined,
          new RegExp(TEST_TOTP),
          'TOTP secret must never leak in verification logs',
        );
        assert.doesNotMatch(
          combined,
          /postgres:\/\/.*:.*@/,
          'Connection credentials must be stripped in logs',
        );
      } finally {
        await client.query('DELETE FROM app.users WHERE id = $1 AND org_id = $2;', [
          scratchUserId,
          ASTER_RIDGE_ID,
        ]);
      }
    });
  });
});
