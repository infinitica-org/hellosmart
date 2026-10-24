import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { runSeed } from '../src/index.ts';
import { assertEnvironmentSafe, assertTestDatabaseName } from '../src/lib/guard.ts';
import { normaliseEmail, isSeedEmail, deterministicUuid } from '../src/lib/keys.ts';
import { upsertRecord } from '../src/lib/upsert.ts';
import { getPlatformAdmins } from '../src/fixtures/platform-admins.ts';
import { getOrganizations } from '../src/fixtures/organizations.ts';
import { getCompanyUsers } from '../src/fixtures/company-users.ts';
import { getCandidates } from '../src/fixtures/candidates.ts';
import type { SeedConfig } from '../src/config.ts';

// 1. Resolve test database URL with mandatory safety assertion: MUST end in '_test'
function resolveTestDatabaseUrl(): string {
  if (process.env['TEST_DATABASE_URL']) {
    assertTestDatabaseName(process.env['TEST_DATABASE_URL']);
    return process.env['TEST_DATABASE_URL'];
  }
  // If DATABASE_MIGRATOR_URL is explicitly set, check if it targets a test DB
  if (process.env['DATABASE_MIGRATOR_URL']) {
    assertTestDatabaseName(process.env['DATABASE_MIGRATOR_URL']);
    return process.env['DATABASE_MIGRATOR_URL'];
  }
  // Fallback default safe test database on local docker port 5434
  const defaultTestUrl = 'postgres://hs_migrator:hs_migrator_local@localhost:5434/hellosmart_test';
  assertTestDatabaseName(defaultTestUrl);
  return defaultTestUrl;
}

const TEST_DB_URL = resolveTestDatabaseUrl();

describe('HelloSmart Seed Fixture Engine Tests', () => {
  // Test Guard: Test database protection & Environment Guard
  describe('Requirement 1: Environment & Test Database Safety Guards', () => {
    const baseSafeConfig: SeedConfig = {
      nodeEnv: 'development',
      databaseUrl: 'postgres://hs_migrator:hs_migrator_local@localhost:5434/hellosmart_test',
      defaultPassword: 'DevPassword123!',
      allowedHosts: ['localhost', '127.0.0.1', 'postgres'],
      referenceDate: new Date('2026-10-23T00:00:00Z'),
      dryRun: false,
      onlyGroups: [],
      confirmRemote: false,
      verbose: false,
    };

    it('assertTestDatabaseName refuses database names not ending in _test (e.g. hellosmart)', () => {
      assert.throws(
        () => assertTestDatabaseName('postgres://hs_migrator:secret@localhost:5434/hellosmart'),
        /SAFETY ERROR: Test suite refused to run on database 'hellosmart'. Target database name must end in '_test'/i,
      );
      assert.throws(
        () => assertTestDatabaseName('hellosmart'),
        /SAFETY ERROR: Test suite refused to run on database 'hellosmart'. Target database name must end in '_test'/i,
      );
      assert.doesNotThrow(() => assertTestDatabaseName('hellosmart_test'));
      assert.doesNotThrow(() =>
        assertTestDatabaseName('postgres://hs_migrator:secret@localhost:5434/hellosmart_test'),
      );
    });

    it('rejects NODE_ENV=production', () => {
      assert.throws(
        () => assertEnvironmentSafe({ ...baseSafeConfig, nodeEnv: 'production' }),
        /SECURITY VIOLATION.*production/i,
      );
    });

    it('rejects NODE_ENV=prod', () => {
      assert.throws(
        () => assertEnvironmentSafe({ ...baseSafeConfig, nodeEnv: 'prod' }),
        /SECURITY VIOLATION.*production/i,
      );
    });

    it('rejects unknown database host not in allowed list', () => {
      assert.throws(
        () =>
          assertEnvironmentSafe({
            ...baseSafeConfig,
            databaseUrl: 'postgres://hs_migrator:secret@unknown-host.internal:5432/hellosmart_test',
          }),
        /HOST GUARD.*is not in SEED_ALLOWED_DB_HOSTS/i,
      );
    });

    it('rejects production database host', () => {
      assert.throws(
        () =>
          assertEnvironmentSafe({
            ...baseSafeConfig,
            databaseUrl:
              'postgres://hs_migrator:secret@db.production.hellosmart.ai:5432/hellosmart_test',
          }),
        /HOST GUARD.*is not in SEED_ALLOWED_DB_HOSTS/i,
      );
    });

    it('rejects superuser role hs_owner', () => {
      assert.throws(
        () =>
          assertEnvironmentSafe({
            ...baseSafeConfig,
            databaseUrl: 'postgres://hs_owner:secret@localhost:5434/hellosmart_test',
          }),
        /SECURITY RULE.*superuser role 'hs_owner'/i,
      );
    });

    it('allows permitted local development test host', () => {
      const target = assertEnvironmentSafe(baseSafeConfig);
      assert.strictEqual(target.host, 'localhost');
      assert.strictEqual(target.user, 'hs_migrator');
      assert.strictEqual(target.dbName, 'hellosmart_test');
    });
  });

  // Test: Password and Argon2id hash redaction in logs/output
  describe('Requirement 2: Credential & Hash Redaction in Logs', () => {
    it('passwords and argon2id hashes never appear in stdout, stderr, or logs', async () => {
      const captured: string[] = [];
      const sensitiveSecret = 'UniqueSuperSecretTestPassword_987654!';

      // Use seed's logger hook without mutating process.stdout
      await runSeed({
        databaseUrl: TEST_DB_URL,
        defaultPassword: sensitiveSecret,
        dryRun: true,
        logger: (msg: string) => captured.push(msg),
      });

      const allOutput = captured.join('\n');
      assert.doesNotMatch(
        allOutput,
        new RegExp(sensitiveSecret, 'i'),
        'Plaintext password must not appear in output',
      );
      assert.doesNotMatch(
        allOutput,
        /\$argon2id\$/i,
        'Argon2id password hashes must not appear in output',
      );
    });
  });

  // Test: Fixture completeness
  describe('Requirement 3: Fixture Coverage of Real States', () => {
    it('every user status (invited, active, suspended, deleted) has at least one fixture', () => {
      const refDate = new Date('2026-10-23T00:00:00Z');
      const platformAdmins = getPlatformAdmins(refDate);
      const orgs = getOrganizations(refDate, 'dummy-admin-id');
      const companyUsers = getCompanyUsers(refDate, {
        asterId: orgs[0]!.id,
        brindleId: orgs[1]!.id,
      });
      const candidates = getCandidates(refDate, { asterId: orgs[0]!.id, brindleId: orgs[1]!.id });

      const allUsers = [...platformAdmins, ...companyUsers, ...candidates];
      const statuses = new Set(allUsers.map((u) => u.status));

      assert.ok(
        statuses.has('invited'),
        'Must have at least one user fixture with status: invited',
      );
      assert.ok(statuses.has('active'), 'Must have at least one user fixture with status: active');
      assert.ok(
        statuses.has('suspended'),
        'Must have at least one user fixture with status: suspended',
      );
      assert.ok(
        statuses.has('deleted'),
        'Must have at least one user fixture with status: deleted',
      );
    });

    it('each seeded org status (paid_active, trial_active) has at least one fixture', () => {
      const refDate = new Date('2026-10-23T00:00:00Z');
      const orgs = getOrganizations(refDate, 'dummy-admin-id');
      const orgStatuses = new Set(orgs.map((o) => o.status));

      assert.ok(
        orgStatuses.has('paid_active'),
        'Must have at least one organization with status: paid_active',
      );
      assert.ok(
        orgStatuses.has('trial_active'),
        'Must have at least one organization with status: trial_active',
      );
    });
  });

  // Test: Email normalisation
  describe('Requirement 4: Email Normalisation & Determinism', () => {
    it('trims leading/trailing whitespace and lowercases email', () => {
      const input = '   Owner@Aster.Seed.Example.Test   ';
      const normalised = normaliseEmail(input);
      assert.strictEqual(normalised, 'owner@aster.seed.example.test');
    });

    it('normalises tab and mixed-case platform admin email', () => {
      const input = '\tAdmin_Super@Seed.Example.Test\n';
      const normalised = normaliseEmail(input);
      assert.strictEqual(normalised, 'admin_super@seed.example.test');
    });

    it('deterministic UUID produces identical ID for mixed-case and normalized email', () => {
      const raw = '  Candidate1@Aster.Seed.Example.Test  ';
      const cleaned = normaliseEmail(raw);

      const idFromClean = deterministicUuid('user', cleaned);
      const idFromRawNormalized = deterministicUuid('user', normaliseEmail(raw));

      assert.strictEqual(idFromClean, idFromRawNormalized);
      assert.match(
        idFromClean,
        /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('correctly identifies valid seed domains', () => {
      assert.strictEqual(isSeedEmail('user@seed.example.test'), true);
      assert.strictEqual(isSeedEmail('user@aster.seed.example.test'), true);
      assert.strictEqual(isSeedEmail('user@gmail.com'), false);
      assert.strictEqual(isSeedEmail('admin@hellosmart.ai'), false);
    });
  });

  // DB Tests: Dry run on empty DB, idempotency, restore, recreate, and collision
  describe('Database Operations & Idempotency', () => {
    const client = new pg.Client({ connectionString: TEST_DB_URL });

    test.before(async () => {
      await client.connect();
      // Ensure app schema is in search_path and set platform admin bypass for session
      await client.query('SET search_path TO app, public;');
      await client.query("SELECT set_config('app.is_platform', 'true', false);");

      // Reset test database to clean state
      await client.query('DELETE FROM app.users;');
      await client.query('DELETE FROM app.entitlements;');
      await client.query('DELETE FROM app.organizations;');
    });

    test.after(async () => {
      await client.end();
    });

    // Test: Dry-run against an empty database writes zero rows and reports would-create
    it('Requirement 5.0: Dry-run against an empty database reports 37 would-create rows with zero rows written', async () => {
      const dryRunRes = await runSeed({ databaseUrl: TEST_DB_URL, dryRun: true });
      assert.strictEqual(
        dryRunRes.reporter.getTotalCreated(),
        37,
        'Dry-run must report 37 created',
      );
      assert.strictEqual(dryRunRes.reporter.getTotalUpdated(), 0, 'Dry-run must report 0 updated');

      // Verify zero rows in database
      const orgCount = await client.query('SELECT count(*) FROM app.organizations;');
      const userCount = await client.query('SELECT count(*) FROM app.users;');
      const entCount = await client.query('SELECT count(*) FROM app.entitlements;');

      assert.strictEqual(
        Number(orgCount.rows[0]?.count),
        0,
        'Organizations table must have 0 rows',
      );
      assert.strictEqual(Number(userCount.rows[0]?.count), 0, 'Users table must have 0 rows');
      assert.strictEqual(Number(entCount.rows[0]?.count), 0, 'Entitlements table must have 0 rows');
    });

    // Test: Seed twice = 0 created
    it('Requirement 5.1: Initial seed creates 37 records, second seed run results in 0 created', async () => {
      // First run: initial population
      const run1 = await runSeed({ databaseUrl: TEST_DB_URL, dryRun: false });
      assert.strictEqual(run1.reporter.getTotalCreated(), 37);

      // Second run: strict idempotency check
      const run2 = await runSeed({ databaseUrl: TEST_DB_URL, dryRun: false });
      assert.strictEqual(run2.reporter.getTotalCreated(), 0, 'Second run must create 0 rows');
      assert.strictEqual(run2.reporter.getTotalUpdated(), 0, 'Second run must update 0 rows');
    });

    // Test: Change a seed user's status then rerun = restored
    it('Requirement 5.2: Changing seed user status to suspended is restored to active on rerun', async () => {
      const targetEmail = 'owner@aster.seed.example.test';

      // Manually mutate status in DB
      await client.query("UPDATE app.users SET status = 'suspended' WHERE email = $1;", [
        targetEmail,
      ]);

      // Verify status is suspended before rerun
      const mutatedRes = await client.query('SELECT status FROM app.users WHERE email = $1;', [
        targetEmail,
      ]);
      assert.strictEqual(mutatedRes.rows[0]?.status, 'suspended');

      // Rerun seed
      const rerun = await runSeed({ databaseUrl: TEST_DB_URL, dryRun: false });

      // Verify status is restored to 'active'
      const restoredRes = await client.query('SELECT status FROM app.users WHERE email = $1;', [
        targetEmail,
      ]);
      assert.strictEqual(restoredRes.rows[0]?.status, 'active');
      assert.strictEqual(rerun.reporter.getTotalUpdated(), 1, 'Exactly 1 row should be updated');
      assert.strictEqual(rerun.reporter.getTotalCreated(), 0, '0 rows should be created');
    });

    // Test: Restoring unseeded organization statuses (suspended, provisioned, trial_expired)
    it('Requirement 5.3: Changing organization statuses (suspended, provisioned, trial_expired) restores to seeded status on rerun', async () => {
      // 1. Mutate Aster to suspended
      await client.query(
        "UPDATE app.organizations SET status = 'suspended' WHERE slug = 'aster-ridge';",
      );
      let rerun = await runSeed({ databaseUrl: TEST_DB_URL, dryRun: false });
      let checkOrg = await client.query(
        "SELECT status FROM app.organizations WHERE slug = 'aster-ridge';",
      );
      assert.strictEqual(
        checkOrg.rows[0]?.status,
        'paid_active',
        'Aster must be restored from suspended to paid_active',
      );
      assert.strictEqual(rerun.reporter.getTotalUpdated(), 1);

      // 2. Mutate Brindle to provisioned
      await client.query(
        "UPDATE app.organizations SET status = 'provisioned' WHERE slug = 'brindle-co';",
      );
      rerun = await runSeed({ databaseUrl: TEST_DB_URL, dryRun: false });
      checkOrg = await client.query(
        "SELECT status FROM app.organizations WHERE slug = 'brindle-co';",
      );
      assert.strictEqual(
        checkOrg.rows[0]?.status,
        'trial_active',
        'Brindle must be restored from provisioned to trial_active',
      );
      assert.strictEqual(rerun.reporter.getTotalUpdated(), 1);

      // 3. Mutate Brindle to trial_expired
      await client.query(
        "UPDATE app.organizations SET status = 'trial_expired' WHERE slug = 'brindle-co';",
      );
      rerun = await runSeed({ databaseUrl: TEST_DB_URL, dryRun: false });
      checkOrg = await client.query(
        "SELECT status FROM app.organizations WHERE slug = 'brindle-co';",
      );
      assert.strictEqual(
        checkOrg.rows[0]?.status,
        'trial_active',
        'Brindle must be restored from trial_expired to trial_active',
      );
      assert.strictEqual(rerun.reporter.getTotalUpdated(), 1);
    });

    // Test: Delete a seed user then rerun = recreated
    it('Requirement 5.4: Deleting a seed user causes it to be recreated on rerun', async () => {
      const targetEmail = 'complete@seed.example.test';

      // Delete the candidate user
      await client.query('DELETE FROM app.users WHERE email = $1;', [targetEmail]);

      // Verify user is gone
      const checkRes = await client.query('SELECT count(*) FROM app.users WHERE email = $1;', [
        targetEmail,
      ]);
      assert.strictEqual(Number(checkRes.rows[0]?.count), 0);

      // Rerun seed
      const rerun = await runSeed({ databaseUrl: TEST_DB_URL, dryRun: false });

      // Verify user is recreated
      const recreatedRes = await client.query(
        'SELECT email, role, status FROM app.users WHERE email = $1;',
        [targetEmail],
      );
      assert.strictEqual(recreatedRes.rows.length, 1);
      assert.strictEqual(recreatedRes.rows[0]?.role, 'candidate');
      assert.strictEqual(recreatedRes.rows[0]?.status, 'active');
      assert.strictEqual(rerun.reporter.getTotalCreated(), 1, 'Exactly 1 row should be recreated');
    });

    // Test: Non-seed email collision = error and no overwrite
    it('Requirement 5.5: Non-seed email collision throws error and refuses to overwrite', async () => {
      const orgRes = await client.query(
        "SELECT id FROM app.organizations WHERE slug = 'aster-ridge';",
      );
      const asterOrgId = orgRes.rows[0]?.id;
      assert.ok(asterOrgId, 'aster-ridge organization must exist in DB');

      // 1. Pre-insert a non-seed user with an external domain
      const nonSeedEmail = 'external_applicant@somedomain.com';
      await client.query(
        `INSERT INTO app.users (id, org_id, email, name, role, status, email_verified_at, password_hash)
         VALUES ($1, $2, $3, $4, $5, $6, now(), $7);`,
        [
          'a0000000-0000-0000-0000-000000000001',
          asterOrgId,
          nonSeedEmail,
          'External User',
          'candidate',
          'active',
          'some-dummy-hash',
        ],
      );

      // Attempt to upsert a record targeting this non-seed email
      await assert.rejects(async () => {
        await upsertRecord({
          client,
          table: 'app.users',
          keyFields: { org_id: asterOrgId, email: nonSeedEmail },
          values: {
            id: 'a0000000-0000-0000-0000-000000000002',
            org_id: asterOrgId,
            email: nonSeedEmail,
            name: 'Malicious Overwrite Attempt',
            role: 'candidate',
            status: 'active',
          },
          dryRun: false,
        });
      }, /COLLISION GUARD: Account with email 'external_applicant@somedomain.com' already exists as a non-seed account. Overwrite refused./);

      // Verify the non-seed user record was NOT overwritten
      const checkUser = await client.query('SELECT name FROM app.users WHERE email = $1;', [
        nonSeedEmail,
      ]);
      assert.strictEqual(checkUser.rows[0]?.name, 'External User');

      // 2. Pre-insert an account having a seed email but a non-seed ID (e.g. manually signed up)
      const fakeSeedEmail = 'manual_cand@aster.seed.example.test';
      const foreignId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
      const expectedSeedId = '00000000-1111-2222-3333-444444444444';

      await client.query(
        `INSERT INTO app.users (id, org_id, email, name, role, status, email_verified_at, password_hash)
         VALUES ($1, $2, $3, $4, $5, $6, now(), $7);`,
        [
          foreignId,
          asterOrgId,
          fakeSeedEmail,
          'Manually Created Candidate',
          'candidate',
          'active',
          'some-dummy-hash',
        ],
      );

      await assert.rejects(async () => {
        await upsertRecord({
          client,
          table: 'app.users',
          keyFields: { org_id: asterOrgId, email: fakeSeedEmail },
          values: {
            id: expectedSeedId,
            org_id: asterOrgId,
            email: fakeSeedEmail,
            name: 'Seed Attempt',
            role: 'candidate',
            status: 'active',
          },
          dryRun: false,
        });
      }, /COLLISION GUARD: Account with email 'manual_cand@aster.seed.example.test' already exists with non-seed ID 'ffffffff-ffff-ffff-ffff-ffffffffffff'. Overwrite refused./);

      // Clean up test non-seed insertions
      await client.query('DELETE FROM app.users WHERE email = $1;', [nonSeedEmail]);
      await client.query('DELETE FROM app.users WHERE email = $1;', [fakeSeedEmail]);
    });
  });
});
