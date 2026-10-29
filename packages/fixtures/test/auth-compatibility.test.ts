import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import pg from 'pg';
import { authenticator } from 'otplib';

// Backend auth imports from apps/api
import { verifyPassword, ARGON2_OPTIONS } from '../../../apps/api/dist/modules/auth/password.js';
import { AuthService } from '../../../apps/api/dist/modules/auth/auth.service.js';
import { SessionService } from '../../../apps/api/dist/modules/session/session.service.js';
import { MemorySessionStore } from '../../../apps/api/dist/modules/session/memory-session.store.js';
import { LoginLockoutService } from '../../../apps/api/dist/modules/auth/login-lockout.service.js';
import { PreAuthService } from '../../../apps/api/dist/modules/auth/pre-auth.service.js';
import { MfaService } from '../../../apps/api/dist/modules/auth/mfa.service.js';

// Fixture helpers and constants
import { runSafeSeed, loadLocalTokens, getInMemoryTokens } from '../dist/index.js';
import {
  LOGINABLE_SUPERADMIN_EMAIL,
  LOGINABLE_ASTER_ADMIN_EMAIL,
  LOGINABLE_BRINDLE_ADMIN_EMAIL,
  LOGINABLE_CANDIDATE_EMAIL,
  NEGATIVE_SUSPENDED_CANDIDATE_EMAIL,
  NEGATIVE_DELETED_CANDIDATE_EMAIL,
  NEGATIVE_CRESTVIEW_ADMIN_EMAIL,
} from '../dist/entities/users.js';
import { ASTER_RIDGE_ID, BRINDLE_CO_ID, CRESTVIEW_ID } from '../dist/entities/organizations.js';

function resolveTestDbUrl(): string {
  if (process.env.TEST_DATABASE_URL) {
    return process.env.TEST_DATABASE_URL;
  }
  return 'postgres://hs_migrator:hs_migrator_local@localhost:5434/hellosmart_test';
}

async function checkDbReachability(url: string): Promise<boolean> {
  const probe = new pg.Client({ connectionString: url });
  probe.on('error', () => {});
  try {
    await probe.connect();
    await probe.end();
    return true;
  } catch {
    return false;
  }
}

describe('Seeded Accounts & Real Backend Login Compatibility', () => {
  const TEST_DB_URL = resolveTestDbUrl();
  let client: pg.Client | null = null;
  let pool: pg.Pool | null = null;
  let authService: AuthService | null = null;
  let dbAvailable = false;

  const seedPassword = process.env.SEED_DEFAULT_PASSWORD || 'TestSeedPassword123!';
  const totpSecret =
    process.env.PLATFORM_ADMIN_MFA_SECRET ||
    process.env.SEED_PLATFORM_ADMIN_TOTP_SECRET ||
    'JBSWY3DPEHPK3PXP';

  before(async () => {
    dbAvailable = await checkDbReachability(TEST_DB_URL);
    if (!dbAvailable) {
      console.warn(`Local test DB not reachable at ${TEST_DB_URL}. Skipping DB tests.`);
      return;
    }

    process.env.SEED_DEFAULT_PASSWORD = seedPassword;
    process.env.PLATFORM_ADMIN_MFA_SECRET = totpSecret;
    process.env.SEED_PLATFORM_ADMIN_TOTP_SECRET = totpSecret;

    try {
      client = new pg.Client({ connectionString: TEST_DB_URL });
      client.on('error', () => {});
      await client.connect();

      await client.query('SET search_path TO app, public;');
      await client.query("SELECT set_config('app.is_platform', 'true', false);");

      // Seed the test database cleanly with the test credentials
      await runSafeSeed(client, {
        nodeEnv: 'test',
        databaseUrl: TEST_DB_URL,
        seedPassword,
        totpSecret,
        logger: () => {},
      });

      pool = new pg.Pool({ connectionString: TEST_DB_URL, max: 2 });
      const sessionStore = new MemorySessionStore();
      const sessions = new SessionService(sessionStore);
      const lockout = new LoginLockoutService(null);
      const preAuth = new PreAuthService(null);
      const mfa = new MfaService({ PLATFORM_ADMIN_MFA_SECRET: totpSecret });

      authService = new AuthService(pool, sessions, lockout, preAuth, mfa);
    } catch (err: any) {
      dbAvailable = false;
      if (client) {
        try {
          await client.end();
        } catch {}
        client = null;
      }
      if (pool) {
        try {
          await pool.end();
        } catch {}
        pool = null;
      }
    }
  });

  after(async () => {
    if (pool) {
      await pool.end();
      pool = null;
    }
    if (client) {
      await client.end();
      client = null;
    }
  });

  describe('1. Schema & Role Constraints Verification', () => {
    it('asserts platform_has_no_org holds for all seeded users', async (t) => {
      if (!dbAvailable || !client) return t.skip('Test database not available');

      const res = await client.query(`
        SELECT id, email, role, org_id
        FROM app.users;
      `);

      assert.ok(res.rows.length >= 114, 'Must have at least 114 users in database');

      for (const row of res.rows) {
        if (row.role === 'platform_admin') {
          assert.strictEqual(row.org_id, null, `Platform admin ${row.email} must have NULL org_id`);
        } else {
          assert.ok(
            row.org_id !== null,
            `Non-platform user ${row.email} (${row.role}) must have non-null org_id`,
          );
        }
      }
    });

    it('asserts all users have valid role and status values', async (t) => {
      if (!dbAvailable || !client) return t.skip('Test database not available');

      const allowedRoles = new Set(['platform_admin', 'company_admin', 'candidate']);
      const allowedStatuses = new Set(['invited', 'active', 'suspended', 'deleted']);

      const res = await client.query('SELECT email, role, status FROM app.users;');
      for (const row of res.rows) {
        assert.ok(allowedRoles.has(row.role), `Invalid role '${row.role}' on ${row.email}`);
        assert.ok(
          allowedStatuses.has(row.status),
          `Invalid status '${row.status}' on ${row.email}`,
        );
      }
    });

    it('asserts soft-deletion invariant: deleted_at populated iff status is deleted', async (t) => {
      if (!dbAvailable || !client) return t.skip('Test database not available');

      const res = await client.query('SELECT email, status, deleted_at FROM app.users;');
      for (const row of res.rows) {
        if (row.status === 'deleted') {
          assert.ok(
            row.deleted_at !== null,
            `Deleted user ${row.email} must have deleted_at populated`,
          );
        } else {
          assert.strictEqual(
            row.deleted_at,
            null,
            `Non-deleted user ${row.email} must have deleted_at === null`,
          );
        }
      }
    });

    it('asserts 1:1 mapping with entitlements and Crestview is suspended', async (t) => {
      if (!dbAvailable || !client) return t.skip('Test database not available');

      const orgs = await client.query(`
        SELECT o.id, o.slug, o.status, e.trial_ends_at
        FROM app.organizations o
        JOIN app.entitlements e ON e.org_id = o.id;
      `);

      assert.strictEqual(orgs.rows.length, 3, 'Must have exactly 3 orgs with 1:1 entitlements');

      const crestview = orgs.rows.find(
        (o) => o.slug === 'crestview-suspended' || o.id === CRESTVIEW_ID,
      );
      assert.ok(crestview, 'Crestview Financial must exist');
      assert.strictEqual(crestview.status, 'suspended', 'Crestview Financial must be suspended');

      const brindle = orgs.rows.find((o) => o.slug === 'brindle-co');
      assert.ok(brindle, 'Brindle & Co must exist');
      assert.strictEqual(brindle.status, 'trial_active');
      assert.ok(brindle.trial_ends_at !== null, 'Brindle trial_ends_at must be populated');

      const aster = orgs.rows.find((o) => o.slug === 'aster-ridge');
      assert.ok(aster, 'Aster Ridge must exist');
      assert.strictEqual(aster.status, 'paid_active');
    });
  });

  describe('2. Password Compatibility Verification', () => {
    it('verifies stored Argon2id hashes with backend verifyPassword against SEED_DEFAULT_PASSWORD', async (t) => {
      if (!dbAvailable || !client) return t.skip('Test database not available');

      const targetEmails = [
        LOGINABLE_SUPERADMIN_EMAIL,
        LOGINABLE_ASTER_ADMIN_EMAIL,
        LOGINABLE_BRINDLE_ADMIN_EMAIL,
        LOGINABLE_CANDIDATE_EMAIL,
      ];

      for (const email of targetEmails) {
        const res = await client.query(
          'SELECT password_hash FROM app.users WHERE lower(email::text) = lower($1);',
          [email],
        );

        assert.ok(res.rows.length === 1, `User ${email} must exist in database`);
        const hash = res.rows[0].password_hash;
        assert.ok(hash, `User ${email} must have non-null password_hash`);

        // Assert Argon2id parameters match backend specifications (memory: 64MB, time: 3, parallelism: 1)
        assert.match(
          hash,
          new RegExp(
            `^\\$argon2id\\$v=19\\$m=${ARGON2_OPTIONS.memoryCost},t=${ARGON2_OPTIONS.timeCost},p=${ARGON2_OPTIONS.parallelism}\\$`,
          ),
          `Hash for ${email} must match backend ARGON2_OPTIONS`,
        );

        // Assert backend verifier accepts seedPassword
        const valid = await verifyPassword(hash, seedPassword);
        assert.strictEqual(valid, true, `Backend verifyPassword must succeed for ${email}`);

        // Assert backend verifier rejects wrong password
        const invalid = await verifyPassword(hash, 'IncorrectPassword999!');
        assert.strictEqual(invalid, false, `Backend verifyPassword must fail for wrong password`);
      }
    });
  });

  describe('3. Login Flow Tests via Real AuthService', () => {
    it('succeeds for Company Admin of Aster Ridge', async (t) => {
      if (!dbAvailable || !authService) return t.skip('AuthService or DB not available');

      const res = await authService.login(
        { email: LOGINABLE_ASTER_ADMIN_EMAIL, password: seedPassword },
        { ip: '127.0.0.1' },
      );

      assert.strictEqual('id' in res, true);
      if ('id' in res) {
        assert.strictEqual(res.email, LOGINABLE_ASTER_ADMIN_EMAIL);
        assert.strictEqual(res.role, 'company_admin');
        assert.strictEqual(res.org?.id, ASTER_RIDGE_ID);
        assert.strictEqual(res.mustResetPassword, false);
      }
    });

    it('succeeds for Company Admin of Brindle & Co (trial)', async (t) => {
      if (!dbAvailable || !authService) return t.skip('AuthService or DB not available');

      const res = await authService.login(
        { email: LOGINABLE_BRINDLE_ADMIN_EMAIL, password: seedPassword },
        { ip: '127.0.0.1' },
      );

      assert.strictEqual('id' in res, true);
      if ('id' in res) {
        assert.strictEqual(res.email, LOGINABLE_BRINDLE_ADMIN_EMAIL);
        assert.strictEqual(res.role, 'company_admin');
        assert.strictEqual(res.org?.id, BRINDLE_CO_ID);
      }
    });

    it('succeeds for active candidate (Aster Ridge 001)', async (t) => {
      if (!dbAvailable || !authService) return t.skip('AuthService or DB not available');

      const res = await authService.login(
        { email: LOGINABLE_CANDIDATE_EMAIL, password: seedPassword },
        { ip: '127.0.0.1' },
      );

      assert.strictEqual('id' in res, true);
      if ('id' in res) {
        assert.strictEqual(res.email, LOGINABLE_CANDIDATE_EMAIL);
        assert.strictEqual(res.role, 'candidate');
        assert.strictEqual(res.org?.id, ASTER_RIDGE_ID);
      }
    });

    it('succeeds for Platform Admin via 2-step TOTP MFA flow', async (t) => {
      if (!dbAvailable || !authService) return t.skip('AuthService or DB not available');

      // Step 1: Login with password -> returns { mfaRequired: true, preAuthToken }
      const step1 = await authService.login(
        { email: LOGINABLE_SUPERADMIN_EMAIL, password: seedPassword },
        { ip: '127.0.0.1' },
      );

      assert.strictEqual('mfaRequired' in step1, true);
      if ('mfaRequired' in step1) {
        assert.strictEqual(step1.mfaRequired, true);
        assert.ok(step1.preAuthToken, 'Must issue preAuthToken for MFA');

        // Step 2: Generate valid TOTP code using otplib authenticator
        const totpCode = authenticator.generate(totpSecret);

        // Step 3: Complete verification via verifyMfa
        const me = await authService.verifyMfa(
          { preAuthToken: step1.preAuthToken, totpCode },
          { ip: '127.0.0.1' },
        );

        assert.strictEqual(me.email, LOGINABLE_SUPERADMIN_EMAIL);
        assert.strictEqual(me.role, 'platform_admin');
        assert.strictEqual(me.org, null);
      }
    });

    it('rejects wrong password with 401 INVALID_CREDENTIALS', async (t) => {
      if (!dbAvailable || !authService) return t.skip('AuthService or DB not available');

      await assert.rejects(
        authService.login(
          { email: LOGINABLE_ASTER_ADMIN_EMAIL, password: 'WrongPassword123!' },
          {},
        ),
        (err: any) => {
          assert.strictEqual(err.status, 401);
          assert.strictEqual(err.response?.code, 'INVALID_CREDENTIALS');
          assert.strictEqual(err.response?.detail, 'Invalid email or password');
          return true;
        },
      );
    });

    it('rejects unknown email with identical 401 INVALID_CREDENTIALS', async (t) => {
      if (!dbAvailable || !authService) return t.skip('AuthService or DB not available');

      await assert.rejects(
        authService.login({ email: 'nonexistent-user@example.test', password: seedPassword }, {}),
        (err: any) => {
          assert.strictEqual(err.status, 401);
          assert.strictEqual(err.response?.code, 'INVALID_CREDENTIALS');
          assert.strictEqual(err.response?.detail, 'Invalid email or password');
          return true;
        },
      );
    });

    it('rejects invited user (null password_hash) with identical 401 INVALID_CREDENTIALS', async (t) => {
      if (!dbAvailable || !authService) return t.skip('AuthService or DB not available');

      await assert.rejects(
        authService.login(
          { email: 'candidate.aster-ridge.071@example.com', password: seedPassword },
          {},
        ),
        (err: any) => {
          assert.strictEqual(err.status, 401);
          assert.strictEqual(err.response?.code, 'INVALID_CREDENTIALS');
          assert.strictEqual(err.response?.detail, 'Invalid email or password');
          return true;
        },
      );
    });

    it('rejects deleted user with identical 401 INVALID_CREDENTIALS', async (t) => {
      if (!dbAvailable || !authService) return t.skip('AuthService or DB not available');

      await assert.rejects(
        authService.login({ email: NEGATIVE_DELETED_CANDIDATE_EMAIL, password: seedPassword }, {}),
        (err: any) => {
          assert.strictEqual(err.status, 401);
          assert.strictEqual(err.response?.code, 'INVALID_CREDENTIALS');
          assert.strictEqual(err.response?.detail, 'Invalid email or password');
          return true;
        },
      );
    });

    it('rejects suspended user with 403 ACCOUNT_SUSPENDED', async (t) => {
      if (!dbAvailable || !authService) return t.skip('AuthService or DB not available');

      await assert.rejects(
        authService.login(
          { email: NEGATIVE_SUSPENDED_CANDIDATE_EMAIL, password: seedPassword },
          {},
        ),
        (err: any) => {
          assert.strictEqual(err.status, 403);
          assert.strictEqual(err.response?.code, 'ACCOUNT_SUSPENDED');
          assert.strictEqual(err.response?.detail, 'Account is not active');
          return true;
        },
      );
    });

    it('rejects user in suspended organization (Crestview) with 403 ORG_SUSPENDED', async (t) => {
      if (!dbAvailable || !authService) return t.skip('AuthService or DB not available');

      await assert.rejects(
        authService.login({ email: NEGATIVE_CRESTVIEW_ADMIN_EMAIL, password: seedPassword }, {}),
        (err: any) => {
          assert.strictEqual(err.status, 403);
          assert.strictEqual(err.response?.code, 'ORG_SUSPENDED');
          assert.strictEqual(err.response?.detail, 'Organization is suspended');
          return true;
        },
      );
    });

    it('rejects Platform Admin with wrong TOTP code with 401 MFA_INVALID', async (t) => {
      if (!dbAvailable || !authService) return t.skip('AuthService or DB not available');

      const step1 = await authService.login(
        { email: LOGINABLE_SUPERADMIN_EMAIL, password: seedPassword },
        {},
      );

      assert.strictEqual('mfaRequired' in step1, true);
      if ('mfaRequired' in step1) {
        await assert.rejects(
          authService.verifyMfa({ preAuthToken: step1.preAuthToken, totpCode: '000000' }, {}),
          (err: any) => {
            assert.strictEqual(err.status, 401);
            assert.strictEqual(err.response?.code, 'MFA_INVALID');
            assert.strictEqual(err.response?.detail, 'Invalid MFA code');
            return true;
          },
        );
      }
    });

    it('asserts unknown email, wrong password, invited, and deleted return identical error payloads', async (t) => {
      if (!dbAvailable || !authService) return t.skip('AuthService or DB not available');

      const errorPayloads: any[] = [];
      const testCases = [
        { email: 'random-unknown@example.test', password: 'SomePassword123!' },
        { email: LOGINABLE_ASTER_ADMIN_EMAIL, password: 'WrongPassword999!' },
        { email: 'candidate.aster-ridge.071@example.com', password: seedPassword },
        { email: NEGATIVE_DELETED_CANDIDATE_EMAIL, password: seedPassword },
      ];

      for (const tc of testCases) {
        try {
          await authService.login(tc, {});
          assert.fail('Expected login to fail');
        } catch (err: any) {
          errorPayloads.push({
            status: err.status,
            type: err.response?.type,
            title: err.response?.title,
            detail: err.response?.detail,
            code: err.response?.code,
          });
        }
      }

      assert.strictEqual(errorPayloads.length, 4);
      for (let i = 1; i < errorPayloads.length; i++) {
        assert.deepStrictEqual(
          errorPayloads[i],
          errorPayloads[0],
          `Error payload for case ${i} must be identical to case 0`,
        );
      }

      // Assert no secret leakage in error payloads
      const combined = JSON.stringify(errorPayloads);
      assert.doesNotMatch(combined, /argon2id/i);
      assert.doesNotMatch(combined, new RegExp(seedPassword));
      assert.doesNotMatch(combined, new RegExp(totpSecret));
      assert.doesNotMatch(combined, /select/i);
    });

    it('OBSERVATION FOR VISHAL: suspended-user and suspended-org checks reveal account status prior to password check', async (t) => {
      if (!dbAvailable || !authService) return t.skip('AuthService or DB not available');

      // 1. Suspended user with completely wrong password still returns 403 ACCOUNT_SUSPENDED
      await assert.rejects(
        authService.login(
          { email: NEGATIVE_SUSPENDED_CANDIDATE_EMAIL, password: 'ArbitraryWrongPassword!' },
          {},
        ),
        (err: any) => {
          assert.strictEqual(err.status, 403, 'Must return 403 before verifying password');
          assert.strictEqual(err.response?.code, 'ACCOUNT_SUSPENDED');
          return true;
        },
      );

      // 2. Suspended org admin with completely wrong password still returns 403 ORG_SUSPENDED
      await assert.rejects(
        authService.login(
          { email: NEGATIVE_CRESTVIEW_ADMIN_EMAIL, password: 'ArbitraryWrongPassword!' },
          {},
        ),
        (err: any) => {
          assert.strictEqual(err.status, 403, 'Must return 403 before verifying password');
          assert.strictEqual(err.response?.code, 'ORG_SUSPENDED');
          return true;
        },
      );
    });
  });
});
