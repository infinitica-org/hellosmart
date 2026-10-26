#!/usr/bin/env node
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { assertEnvironmentSafe } from './lib/guard.js';
import { maskSensitiveData } from './lib/masker.js';
import { loadEnvFiles, extractTargetDbInfo } from './index.js';
import {
  getOrganizations,
  getPlatformAdmins,
  getCompanyAdmins,
  getCandidates,
  getInvitations,
  LOGINABLE_SUPERADMIN_EMAIL,
  LOGINABLE_ASTER_ADMIN_EMAIL,
  LOGINABLE_BRINDLE_ADMIN_EMAIL,
  LOGINABLE_CANDIDATE_EMAIL,
  NEGATIVE_CRESTVIEW_ADMIN_EMAIL,
  NEGATIVE_SUSPENDED_CANDIDATE_EMAIL,
  NEGATIVE_DELETED_CANDIDATE_EMAIL,
} from './entities/index.js';
import {
  getSeedDefaultPassword,
  getPlatformAdminTotpSecret,
  isArgon2idHashWithSettings,
} from './lib/credentials.js';
import { loadLocalTokens, getInMemoryTokens, type SeedTokensMap } from './lib/invite-links.js';
import { runSafeSeed } from './lib/upsert.js';

/**
 * Status of an individual verification check.
 */
export type VerificationStatus = 'PASS' | 'FAIL' | 'SKIPPED';

/**
 * Result of an individual verification check.
 */
export interface VerificationCheckResult {
  name: string;
  status: VerificationStatus;
  details: string;
  errors?: string[];
}

/**
 * Overall summary returned by the verification engine.
 */
export interface VerificationSummary {
  passed: boolean;
  targetDb: { host: string; database: string };
  executionDurationMs: number;
  checks: VerificationCheckResult[];
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  skippedChecks: number;
  unhashedActiveUsersCount?: number | undefined;
  idempotencyResult?:
    | {
        run1DurationMs: number;
        run2DurationMs: number;
        countsMatch: boolean;
      }
    | undefined;
}

/**
 * Configurable options for running seed verification.
 */
export interface VerifyOptions {
  databaseUrl?: string;
  nodeEnv?: string;
  /**
   * Whether the check requires ALL active users to have a non-null password_hash (true),
   * or restricts the check to designated loginable active accounts (false).
   *
   * Defaults to `true` per Task [13.3] requirement:
   * "Implement the check as written, run it against a fresh seeded DB, and if it fails
   * for active candidates, report exactly how many and which group... keep the check
   * configurable so the change is one line."
   */
  checkAllActiveUsersHaveHash?: boolean;
  seedPassword?: string;
  totpSecret?: string;
  tokens?: SeedTokensMap;
  runIdempotencyCheck?: boolean;
  quiet?: boolean;
  logger?: (msg: string) => void;
  exitProcess?: boolean;
}

/**
 * Default setting for the active user password_hash check.
 * Configurable in one line:
 * - true: every ACTIVE user must have non-null password_hash.
 * - false: only designated loginable active users must have non-null password_hash.
 */
export const DEFAULT_REQUIRE_ALL_ACTIVE_USERS_HASH = true;

/**
 * Executes comprehensive seed verification and data integrity checks against the database.
 */
export async function runVerifySeed(options: VerifyOptions = {}): Promise<VerificationSummary> {
  const startTime = Date.now();
  const log = (msg: string) => {
    if (options.quiet) return;
    const sanitized = maskSensitiveData(msg);
    if (options.logger) {
      options.logger(sanitized);
    } else {
      console.log(sanitized);
    }
  };

  // 1. Load environment variables
  loadEnvFiles();

  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV ?? 'development';
  // Connect with OWNER role: DATABASE_MIGRATOR_URL takes precedence, falling back to DATABASE_URL
  const databaseUrl =
    options.databaseUrl ?? process.env.DATABASE_MIGRATOR_URL ?? process.env.DATABASE_URL;

  if (!databaseUrl || databaseUrl.trim() === '') {
    const errorMsg =
      '\n❌ Missing database connection string.\n' +
      'Please set DATABASE_MIGRATOR_URL or DATABASE_URL in your environment or root .env file.\n';
    console.error(errorMsg);
    if (options.exitProcess) {
      process.exit(1);
    }
    throw new Error('DATABASE_URL is not set');
  }

  // 2. Safety Guard Check FIRST before any DB connection
  assertEnvironmentSafe(nodeEnv, databaseUrl);

  const targetDb = extractTargetDbInfo(databaseUrl);
  const checks: VerificationCheckResult[] = [];

  // Check 1: Safety Guard passed
  checks.push({
    name: 'Environment Safety Guard',
    status: 'PASS',
    details: `Environment '${nodeEnv}', local target host '${targetDb.host}' verified`,
  });

  const client = new pg.Client({ connectionString: databaseUrl });
  let unhashedActiveCount = 0;
  let idempotencyData: VerificationSummary['idempotencyResult'];

  try {
    await client.connect();
    await client.query('SET search_path TO app, public;');
    await client.query("SELECT set_config('app.is_platform', 'true', false);");

    // Check 2: Database Connectivity & Role
    try {
      const roleResult = await client.query('SELECT current_user, current_database()');
      const currentUser = roleResult.rows[0]?.current_user ?? 'unknown';
      checks.push({
        name: 'Database Connectivity & Role',
        status: 'PASS',
        details: `Connected to ${targetDb.host}/${targetDb.database} as role '${currentUser}'`,
      });
    } catch (err: any) {
      checks.push({
        name: 'Database Connectivity & Role',
        status: 'FAIL',
        details: 'Failed to query database user context',
        errors: [err.message],
      });
    }

    // Check 3: Table Record Counts
    try {
      const orgsCountRes = await client.query('SELECT count(*)::int AS cnt FROM app.organizations');
      const entsCountRes = await client.query('SELECT count(*)::int AS cnt FROM app.entitlements');
      const usersCountRes = await client.query('SELECT count(*)::int AS cnt FROM app.users');
      const invsCountRes = await client.query('SELECT count(*)::int AS cnt FROM app.invitations');

      const actualOrgs = orgsCountRes.rows[0].cnt;
      const actualEnts = entsCountRes.rows[0].cnt;
      const actualUsers = usersCountRes.rows[0].cnt;
      const actualInvs = invsCountRes.rows[0].cnt;
      const actualTotal = actualOrgs + actualEnts + actualUsers + actualInvs;

      const expectedOrgs = getOrganizations().length;
      const expectedEnts = expectedOrgs;
      const expectedPlatAdmins = getPlatformAdmins().length;
      const expectedCompAdmins = getCompanyAdmins().length;
      const expectedCands = getCandidates().length;
      const expectedUsers = expectedPlatAdmins + expectedCompAdmins + expectedCands;
      const expectedInvs = getInvitations().length;
      const expectedTotal = expectedOrgs + expectedEnts + expectedUsers + expectedInvs;

      const countErrors: string[] = [];
      if (actualOrgs !== expectedOrgs) {
        countErrors.push(
          `Organizations count mismatch: expected ${expectedOrgs}, got ${actualOrgs}`,
        );
      }
      if (actualEnts !== expectedEnts) {
        countErrors.push(
          `Entitlements count mismatch: expected ${expectedEnts}, got ${actualEnts}`,
        );
      }
      if (actualUsers !== expectedUsers) {
        countErrors.push(`Users count mismatch: expected ${expectedUsers}, got ${actualUsers}`);
      }
      if (actualInvs !== expectedInvs) {
        countErrors.push(`Invitations count mismatch: expected ${expectedInvs}, got ${actualInvs}`);
      }

      if (countErrors.length === 0) {
        checks.push({
          name: 'Table Record Counts',
          status: 'PASS',
          details: `${actualTotal} records total (${actualOrgs} orgs, ${actualEnts} ents, ${actualUsers} users, ${actualInvs} invs)`,
        });
      } else {
        checks.push({
          name: 'Table Record Counts',
          status: 'FAIL',
          details: `Record count mismatch (${actualTotal} actual vs ${expectedTotal} expected)`,
          errors: countErrors,
        });
      }
    } catch (err: any) {
      checks.push({
        name: 'Table Record Counts',
        status: 'FAIL',
        details: 'Failed querying table record counts',
        errors: [err.message],
      });
    }

    // Check 4: User Role & Status Breakdown
    try {
      const breakdownRes = await client.query(
        'SELECT role, status, count(*)::int AS cnt FROM app.users GROUP BY role, status ORDER BY role, status',
      );
      const actualBreakdown = new Map<string, number>();
      for (const row of breakdownRes.rows) {
        actualBreakdown.set(`${row.role}:${row.status}`, row.cnt);
      }

      const allFixtures = [...getPlatformAdmins(), ...getCompanyAdmins(), ...getCandidates()];
      const expectedBreakdown = new Map<string, number>();
      for (const user of allFixtures) {
        const key = `${user.role}:${user.status}`;
        expectedBreakdown.set(key, (expectedBreakdown.get(key) ?? 0) + 1);
      }

      const breakdownErrors: string[] = [];
      for (const [key, expected] of expectedBreakdown.entries()) {
        const actual = actualBreakdown.get(key) ?? 0;
        if (actual !== expected) {
          breakdownErrors.push(`Breakdown ${key}: expected ${expected}, got ${actual}`);
        }
      }

      const activeUsers = breakdownRes.rows
        .filter((r) => r.status === 'active')
        .reduce((sum, r) => sum + r.cnt, 0);
      const invitedUsers = breakdownRes.rows
        .filter((r) => r.status === 'invited')
        .reduce((sum, r) => sum + r.cnt, 0);
      const suspendedUsers = breakdownRes.rows
        .filter((r) => r.status === 'suspended')
        .reduce((sum, r) => sum + r.cnt, 0);
      const deletedUsers = breakdownRes.rows
        .filter((r) => r.status === 'deleted')
        .reduce((sum, r) => sum + r.cnt, 0);

      if (breakdownErrors.length === 0) {
        checks.push({
          name: 'User Role & Status Distribution',
          status: 'PASS',
          details: `${activeUsers} active, ${invitedUsers} invited, ${suspendedUsers} suspended, ${deletedUsers} deleted`,
        });
      } else {
        checks.push({
          name: 'User Role & Status Distribution',
          status: 'FAIL',
          details: 'Distribution mismatch across role/status buckets',
          errors: breakdownErrors,
        });
      }
    } catch (err: any) {
      checks.push({
        name: 'User Role & Status Distribution',
        status: 'FAIL',
        details: 'Failed querying user distribution',
        errors: [err.message],
      });
    }

    // Check 5: Tenant Scoping & Foreign Keys
    try {
      const scopingErrors: string[] = [];

      // Non-platform users must have non-null org_id referencing app.organizations
      const invalidTenantUsers = await client.query(`
        SELECT id, email, role, org_id FROM app.users
        WHERE role != 'platform_admin'
          AND (org_id IS NULL OR org_id NOT IN (SELECT id FROM app.organizations));
      `);
      if (invalidTenantUsers.rows.length > 0) {
        scopingErrors.push(
          `${invalidTenantUsers.rows.length} non-platform user(s) have NULL or invalid org_id`,
        );
      }

      // Platform admins must have org_id NULL
      const invalidPlatUsers = await client.query(`
        SELECT id, email FROM app.users
        WHERE role = 'platform_admin' AND org_id IS NOT NULL;
      `);
      if (invalidPlatUsers.rows.length > 0) {
        scopingErrors.push(
          `${invalidPlatUsers.rows.length} platform_admin user(s) have non-NULL org_id`,
        );
      }

      // Invitations must reference valid users and organizations, with matching org_id
      const invalidInvs = await client.query(`
        SELECT i.id, i.org_id, u.org_id AS user_org_id
        FROM app.invitations i
        JOIN app.users u ON i.user_id = u.id
        WHERE i.org_id != u.org_id;
      `);
      if (invalidInvs.rows.length > 0) {
        scopingErrors.push(
          `${invalidInvs.rows.length} invitation(s) have mismatched org_id vs linked user`,
        );
      }

      if (scopingErrors.length === 0) {
        checks.push({
          name: 'Tenant Scoping & Foreign Keys',
          status: 'PASS',
          details: 'All tenant records strictly scoped; platform_has_no_org holds; FKs match',
        });
      } else {
        checks.push({
          name: 'Tenant Scoping & Foreign Keys',
          status: 'FAIL',
          details: 'Violations in tenant isolation or foreign key relationships',
          errors: scopingErrors,
        });
      }
    } catch (err: any) {
      checks.push({
        name: 'Tenant Scoping & Foreign Keys',
        status: 'FAIL',
        details: 'Failed querying tenant scoping integrity',
        errors: [err.message],
      });
    }

    // Check 6: Active User Password Hashes
    try {
      const requireAllActiveHaveHash =
        options.checkAllActiveUsersHaveHash ?? DEFAULT_REQUIRE_ALL_ACTIVE_USERS_HASH;

      const activeUsersQuery = await client.query(`
        SELECT id, email, role, org_id, password_hash
        FROM app.users
        WHERE status = 'active';
      `);

      const activeWithoutHash = activeUsersQuery.rows.filter(
        (u) => !u.password_hash || u.password_hash.trim() === '',
      );
      unhashedActiveCount = activeWithoutHash.length;

      const loginableEmails = new Set([
        LOGINABLE_SUPERADMIN_EMAIL,
        LOGINABLE_ASTER_ADMIN_EMAIL,
        LOGINABLE_BRINDLE_ADMIN_EMAIL,
        LOGINABLE_CANDIDATE_EMAIL,
      ]);

      if (requireAllActiveHaveHash) {
        if (activeWithoutHash.length === 0) {
          checks.push({
            name: 'Active User Password Hashes',
            status: 'PASS',
            details: `All ${activeUsersQuery.rows.length} active users have non-null Argon2id password_hash`,
          });
        } else {
          // Identify groups of active users lacking hashes
          const asterCands = activeWithoutHash.filter((u) =>
            u.email.includes('candidate.aster-ridge'),
          );
          const brindleCands = activeWithoutHash.filter((u) =>
            u.email.includes('candidate.brindle-co'),
          );
          const otherUsers = activeWithoutHash.filter(
            (u) =>
              !u.email.includes('candidate.aster-ridge') &&
              !u.email.includes('candidate.brindle-co'),
          );

          checks.push({
            name: 'Active User Password Hashes',
            status: 'FAIL',
            details: `${activeWithoutHash.length} active candidate account(s) lack password_hash (${asterCands.length} Aster Ridge, ${brindleCands.length} Brindle & Co)`,
            errors: [
              `Found ${activeWithoutHash.length} active users with NULL password_hash:`,
              `  - Aster Ridge bulk candidates: ${asterCands.length} users (candidate.aster-ridge.002 to .070)`,
              `  - Brindle & Co bulk candidates: ${brindleCands.length} users (candidate.brindle-co.001 to .004)`,
              ...(otherUsers.length > 0
                ? [`  - Other active users: ${otherUsers.length} users`]
                : []),
              'NOTE: In Task 13.1, only loginable accounts were hashed to maintain sub-3s seed performance.',
            ],
          });
        }
      } else {
        // Restrict check to loginable accounts
        const loginableWithoutHash = activeWithoutHash.filter((u) => loginableEmails.has(u.email));
        if (loginableWithoutHash.length === 0) {
          checks.push({
            name: 'Active User Password Hashes (Loginable Accounts Only)',
            status: 'PASS',
            details: `All designated loginable active accounts have valid Argon2id hashes (${activeWithoutHash.length} bulk accounts unhashed for performance)`,
          });
        } else {
          checks.push({
            name: 'Active User Password Hashes (Loginable Accounts Only)',
            status: 'FAIL',
            details: `${loginableWithoutHash.length} loginable active accounts lack password_hash`,
            errors: loginableWithoutHash.map(
              (u) => `Missing hash for loginable account: ${u.email}`,
            ),
          });
        }
      }
    } catch (err: any) {
      checks.push({
        name: 'Active User Password Hashes',
        status: 'FAIL',
        details: 'Failed querying active user password hashes',
        errors: [err.message],
      });
    }

    // Check 7: Platform Admin MFA Configuration
    try {
      const platAdmins = await client.query(`
        SELECT id, email, role, mfa_secret_ref
        FROM app.users
        WHERE role = 'platform_admin';
      `);

      const mfaErrors: string[] = [];
      for (const admin of platAdmins.rows) {
        if (!admin.mfa_secret_ref || admin.mfa_secret_ref.trim() === '') {
          mfaErrors.push(`Platform admin ${admin.email} has empty mfa_secret_ref`);
          continue;
        }

        // Must not be a raw Base32 TOTP secret (A-Z, 2-7 string of length >= 16)
        const isPlainBase32 = /^[A-Z2-7]{16,32}$/.test(admin.mfa_secret_ref.trim());
        if (isPlainBase32) {
          mfaErrors.push(
            `Platform admin ${admin.email} has raw plaintext Base32 TOTP secret in mfa_secret_ref`,
          );
        }
      }

      if (mfaErrors.length === 0) {
        checks.push({
          name: 'Platform Admin MFA Configuration',
          status: 'PASS',
          details: `Platform admin MFA configured via secret reference '${platAdmins.rows[0]?.mfa_secret_ref}' (not plain Base32)`,
        });
      } else {
        checks.push({
          name: 'Platform Admin MFA Configuration',
          status: 'FAIL',
          details: 'Platform admin MFA secret reference invalid or plaintext',
          errors: mfaErrors,
        });
      }
    } catch (err: any) {
      checks.push({
        name: 'Platform Admin MFA Configuration',
        status: 'FAIL',
        details: 'Failed querying platform admin MFA configuration',
        errors: [err.message],
      });
    }

    // Check 8: Entitlements & Trial Windows
    try {
      const entErrors: string[] = [];
      const orgsRes = await client.query(`
        SELECT o.id, o.slug, o.status, e.trial_ends_at
        FROM app.organizations o
        LEFT JOIN app.entitlements e ON o.id = e.org_id;
      `);

      for (const org of orgsRes.rows) {
        if (org.status === 'trial_active' && !org.trial_ends_at) {
          entErrors.push(`Trial active organization '${org.slug}' has NULL trial_ends_at`);
        }
      }

      const orgStatuses = new Set(orgsRes.rows.map((o) => o.status));
      if (!orgStatuses.has('paid_active'))
        entErrors.push("Missing 'paid_active' organization sample");
      if (!orgStatuses.has('trial_active'))
        entErrors.push("Missing 'trial_active' organization sample");
      if (!orgStatuses.has('suspended')) entErrors.push("Missing 'suspended' organization sample");

      if (entErrors.length === 0) {
        checks.push({
          name: 'Entitlements & Trial Windows',
          status: 'PASS',
          details: '1:1 mapping with orgs, trial_ends_at set for trial_active, valid statuses',
        });
      } else {
        checks.push({
          name: 'Entitlements & Trial Windows',
          status: 'FAIL',
          details: 'Entitlements or organization status verification failed',
          errors: entErrors,
        });
      }
    } catch (err: any) {
      checks.push({
        name: 'Entitlements & Trial Windows',
        status: 'FAIL',
        details: 'Failed querying entitlements and trial windows',
        errors: [err.message],
      });
    }

    // Check 9: Invitations State & Token Hashes
    try {
      const invErrors: string[] = [];
      const invsRes = await client.query(`
        SELECT id, org_id, user_id, token_hash, expires_at, used_at, created_at
        FROM app.invitations;
      `);

      if (invsRes.rows.length !== 3) {
        invErrors.push(`Expected exactly 3 invitations, found ${invsRes.rows.length}`);
      }

      let validCount = 0;
      let expiredCount = 0;
      let usedCount = 0;
      const now = Date.now();

      for (const inv of invsRes.rows) {
        // Must be a 64-char lowercase hex string
        if (!/^[0-9a-f]{64}$/.test(inv.token_hash)) {
          invErrors.push(
            `Invitation ${inv.id} token_hash is not a 64-character lowercase hexadecimal string`,
          );
        }

        const expTime = new Date(inv.expires_at).getTime();
        const usedTime = inv.used_at ? new Date(inv.used_at).getTime() : null;

        if (usedTime !== null) {
          usedCount++;
        } else if (expTime > now) {
          validCount++;
        } else {
          expiredCount++;
        }
      }

      if (validCount !== 1) invErrors.push(`Expected 1 valid invitation, found ${validCount}`);
      if (expiredCount !== 1)
        invErrors.push(`Expected 1 expired invitation, found ${expiredCount}`);
      if (usedCount !== 1) invErrors.push(`Expected 1 used invitation, found ${usedCount}`);

      if (invErrors.length === 0) {
        checks.push({
          name: 'Invitations State & Token Hashes',
          status: 'PASS',
          details: '1 valid, 1 expired, 1 used; all tokens are 64-hex SHA-256 digests',
        });
      } else {
        checks.push({
          name: 'Invitations State & Token Hashes',
          status: 'FAIL',
          details: 'Invitation records or token hashes invalid',
          errors: invErrors,
        });
      }
    } catch (err: any) {
      checks.push({
        name: 'Invitations State & Token Hashes',
        status: 'FAIL',
        details: 'Failed querying invitations state and token hashes',
        errors: [err.message],
      });
    }

    // Check 10: Soft-Deletion Invariants
    try {
      const delErrors: string[] = [];
      const deletedWithNullTimestamp = await client.query(`
        SELECT id, email FROM app.users WHERE status = 'deleted' AND deleted_at IS NULL;
      `);
      if (deletedWithNullTimestamp.rows.length > 0) {
        delErrors.push(
          `${deletedWithNullTimestamp.rows.length} deleted user(s) have NULL deleted_at timestamp`,
        );
      }

      const activeWithDeletedTimestamp = await client.query(`
        SELECT id, email FROM app.users WHERE status = 'active' AND deleted_at IS NOT NULL;
      `);
      if (activeWithDeletedTimestamp.rows.length > 0) {
        delErrors.push(
          `${activeWithDeletedTimestamp.rows.length} active user(s) have non-NULL deleted_at timestamp`,
        );
      }

      if (delErrors.length === 0) {
        checks.push({
          name: 'Soft-Deletion Invariants',
          status: 'PASS',
          details: 'Deleted users have deleted_at populated; active users have deleted_at null',
        });
      } else {
        checks.push({
          name: 'Soft-Deletion Invariants',
          status: 'FAIL',
          details: 'Soft deletion timestamps do not match user status',
          errors: delErrors,
        });
      }
    } catch (err: any) {
      checks.push({
        name: 'Soft-Deletion Invariants',
        status: 'FAIL',
        details: 'Failed querying soft-deletion invariants',
        errors: [err.message],
      });
    }

    // Check 11: Plaintext Secret & Pattern Scan
    try {
      const secretFindings: Array<{ table: string; column: string; rowId: string }> = [];

      let seedPassword: string | null = null;
      try {
        seedPassword = options.seedPassword ?? getSeedDefaultPassword();
      } catch {}

      let totpSecret: string | null = null;
      try {
        totpSecret = options.totpSecret ?? getPlatformAdminTotpSecret();
      } catch {}

      const localTokens = options.tokens ?? getInMemoryTokens() ?? loadLocalTokens();
      const rawTokensList = localTokens
        ? [localTokens.valid, localTokens.expired, localTokens.used].filter(Boolean)
        : [];

      // Scan app.users text columns
      const usersRows = await client.query(`
        SELECT id, email, name, role, status, password_hash, mfa_secret_ref
        FROM app.users;
      `);

      for (const row of usersRows.rows) {
        for (const col of ['email', 'name', 'role', 'status', 'mfa_secret_ref', 'password_hash']) {
          const val = row[col];
          if (typeof val !== 'string' || !val) continue;

          // Check SEED_DEFAULT_PASSWORD
          if (seedPassword && val.includes(seedPassword)) {
            secretFindings.push({ table: 'app.users', column: col, rowId: row.id });
          }
          // Check TOTP secret
          if (totpSecret && val.includes(totpSecret)) {
            secretFindings.push({ table: 'app.users', column: col, rowId: row.id });
          }
          // Check raw tokens
          for (const token of rawTokensList) {
            if (val.includes(token)) {
              secretFindings.push({ table: 'app.users', column: col, rowId: row.id });
            }
          }
          // Check 64-hex string in columns other than token_hash
          if (col !== 'password_hash' && /\b[0-9a-fA-F]{64}\b/.test(val)) {
            secretFindings.push({ table: 'app.users', column: col, rowId: row.id });
          }
        }

        // Specific pattern check: password_hash must start with $argon2id$ if non-null
        if (row.password_hash && !row.password_hash.startsWith('$argon2id$')) {
          secretFindings.push({ table: 'app.users', column: 'password_hash', rowId: row.id });
        }

        // Specific pattern check: mfa_secret_ref must not look like raw Base32 secret
        if (row.mfa_secret_ref && /^[A-Z2-7]{16,32}$/.test(row.mfa_secret_ref.trim())) {
          secretFindings.push({ table: 'app.users', column: 'mfa_secret_ref', rowId: row.id });
        }
      }

      // Scan app.organizations text columns
      const orgsRows = await client.query(`
        SELECT id, name, slug, status, logo_key, custom_domain
        FROM app.organizations;
      `);
      for (const row of orgsRows.rows) {
        for (const col of ['name', 'slug', 'status', 'logo_key', 'custom_domain']) {
          const val = row[col];
          if (typeof val !== 'string' || !val) continue;

          if (seedPassword && val.includes(seedPassword)) {
            secretFindings.push({ table: 'app.organizations', column: col, rowId: row.id });
          }
          if (totpSecret && val.includes(totpSecret)) {
            secretFindings.push({ table: 'app.organizations', column: col, rowId: row.id });
          }
          for (const token of rawTokensList) {
            if (val.includes(token)) {
              secretFindings.push({ table: 'app.organizations', column: col, rowId: row.id });
            }
          }
          if (/\b[0-9a-fA-F]{64}\b/.test(val)) {
            secretFindings.push({ table: 'app.organizations', column: col, rowId: row.id });
          }
        }
      }

      // Scan app.invitations
      const invsRows = await client.query(`
        SELECT id, token_hash FROM app.invitations;
      `);
      for (const row of invsRows.rows) {
        const val = row.token_hash;
        if (seedPassword && val.includes(seedPassword)) {
          secretFindings.push({ table: 'app.invitations', column: 'token_hash', rowId: row.id });
        }
        if (totpSecret && val.includes(totpSecret)) {
          secretFindings.push({ table: 'app.invitations', column: 'token_hash', rowId: row.id });
        }
        for (const token of rawTokensList) {
          if (val === token) {
            secretFindings.push({ table: 'app.invitations', column: 'token_hash', rowId: row.id });
          }
        }
      }

      if (secretFindings.length === 0) {
        const tokenDetail =
          rawTokensList.length > 0
            ? 'verified against local raw tokens'
            : 'token-specific check skipped (no local tokens file found)';
        checks.push({
          name: 'Plaintext Secret & Pattern Scan',
          status: 'PASS',
          details: `Zero plaintext passwords, TOTP secrets, or leaked tokens detected (${tokenDetail})`,
        });
      } else {
        // Report ONLY table, column, and rowId; never print the value or hash
        checks.push({
          name: 'Plaintext Secret & Pattern Scan',
          status: 'FAIL',
          details: `Plaintext secret or forbidden pattern detected in ${secretFindings.length} field(s)`,
          errors: secretFindings.map(
            (f) =>
              `Forbidden value found in table '${f.table}', column '${f.column}', row ID '${f.rowId}'`,
          ),
        });
      }
    } catch (err: any) {
      checks.push({
        name: 'Plaintext Secret & Pattern Scan',
        status: 'FAIL',
        details: 'Failed executing plaintext secret scan',
        errors: [err.message],
      });
    }

    // Check 12: Seed Idempotency & Run Timing (Optional / on-demand)
    if (options.runIdempotencyCheck) {
      try {
        const t1Start = Date.now();
        await runSafeSeed(client, {
          databaseUrl,
          nodeEnv,
          skipSafetyCheck: true,
          logger: () => {},
        });
        const run1Duration = Date.now() - t1Start;

        const count1Res = await client.query(`
          SELECT 
            (SELECT count(*)::int FROM app.organizations) +
            (SELECT count(*)::int FROM app.entitlements) +
            (SELECT count(*)::int FROM app.users) +
            (SELECT count(*)::int FROM app.invitations) AS total;
        `);
        const total1 = count1Res.rows[0].total;

        const t2Start = Date.now();
        await runSafeSeed(client, {
          databaseUrl,
          nodeEnv,
          skipSafetyCheck: true,
          logger: () => {},
        });
        const run2Duration = Date.now() - t2Start;

        const count2Res = await client.query(`
          SELECT 
            (SELECT count(*)::int FROM app.organizations) +
            (SELECT count(*)::int FROM app.entitlements) +
            (SELECT count(*)::int FROM app.users) +
            (SELECT count(*)::int FROM app.invitations) AS total;
        `);
        const total2 = count2Res.rows[0].total;

        const countsMatch = total1 === total2;
        idempotencyData = {
          run1DurationMs: run1Duration,
          run2DurationMs: run2Duration,
          countsMatch,
        };

        const timingWarning =
          run1Duration > 3000 || run2Duration > 3000
            ? ' (WARNING: Seed duration exceeded 3s target)'
            : '';

        if (countsMatch) {
          checks.push({
            name: 'Seed Idempotency & Run Timing',
            status: 'PASS',
            details: `Run 1: ${run1Duration}ms, Run 2: ${run2Duration}ms (0 extra rows)${timingWarning}`,
          });
        } else {
          checks.push({
            name: 'Seed Idempotency & Run Timing',
            status: 'FAIL',
            details: `Non-idempotent seed execution: row counts grew from ${total1} to ${total2}`,
            errors: [`Second seed run added ${total2 - total1} extra row(s)`],
          });
        }
      } catch (err: any) {
        checks.push({
          name: 'Seed Idempotency & Run Timing',
          status: 'FAIL',
          details: 'Error executing programmatic seed re-runs',
          errors: [err.message],
        });
      }
    }
  } finally {
    // Cleanly close database connection (never hang)
    try {
      await client.end();
    } catch {}
  }

  const durationMs = Date.now() - startTime;
  const passedChecks = checks.filter((c) => c.status === 'PASS').length;
  const failedChecks = checks.filter((c) => c.status === 'FAIL').length;
  const skippedChecks = checks.filter((c) => c.status === 'SKIPPED').length;
  const overallPassed = failedChecks === 0;

  // Print formatted summary table
  const tableData = checks.map((c) => ({
    Check: c.name,
    Status: c.status,
    Details: c.details,
  }));

  log('\n================ HelloSmart Seed Verification ================');
  if (!options.quiet) {
    console.table(tableData);
  }
  log(`Target Database : ${targetDb.host} / ${targetDb.database}`);
  log(`Execution Time  : ${durationMs}ms`);
  log(
    `Status          : ${
      overallPassed
        ? 'Verification Passed (All checks OK)'
        : `Verification Failed (${failedChecks} check(s) failed)`
    }`,
  );
  log('==============================================================\n');

  // Print any detailed failure diagnostics
  if (failedChecks > 0 && !options.quiet) {
    for (const c of checks) {
      if (c.status === 'FAIL' && c.errors && c.errors.length > 0) {
        console.error(`\n❌ [${c.name}] Diagnostic details:`);
        for (const err of c.errors) {
          console.error(`  - ${maskSensitiveData(err)}`);
        }
      }
    }
    console.error('');
  }

  const summary: VerificationSummary = {
    passed: overallPassed,
    targetDb,
    executionDurationMs: durationMs,
    checks,
    totalChecks: checks.length,
    passedChecks,
    failedChecks,
    skippedChecks,
    unhashedActiveUsersCount: unhashedActiveCount,
    idempotencyResult: idempotencyData,
  };

  if (!overallPassed && options.exitProcess) {
    process.exit(1);
  }

  return summary;
}

/**
 * Checks if this module is being run directly as a script from CLI.
 */
function isMain(): boolean {
  if (!process.argv || !process.argv[1]) return false;
  try {
    const currentFile = fileURLToPath(import.meta.url).replace(/\\/g, '/');
    const executedFile = process.argv[1].replace(/\\/g, '/');
    return (
      currentFile === executedFile ||
      currentFile.replace(/\.ts$/, '.js') === executedFile ||
      executedFile.endsWith('/dist/verify.js') ||
      executedFile.endsWith('/src/verify.ts')
    );
  } catch {
    return false;
  }
}

if (isMain()) {
  const checkAllActive = !process.argv.includes('--loginable-only-hashes');
  const checkIdempotency = process.argv.includes('--check-idempotency');
  runVerifySeed({
    exitProcess: true,
    checkAllActiveUsersHaveHash: checkAllActive,
    runIdempotencyCheck: checkIdempotency,
  }).catch(() => {
    process.exit(1);
  });
}
