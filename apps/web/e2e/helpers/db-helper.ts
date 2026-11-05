import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { URL } from 'node:url';
import * as path from 'node:path';

// Resolve api dependencies (pg, argon2) safely across CommonJS and ESM without import.meta
const apiPkgPath = path.resolve(process.cwd(), '../api/package.json');
const apiRequire = createRequire(apiPkgPath);
const { Pool } = apiRequire('pg');
const { hash } = apiRequire('@node-rs/argon2');

export interface TestOrgFixture {
  orgId: string;
  orgName: string;
  orgSlug: string;
  adminId: string;
  adminEmail: string;
  adminPassword: string;
  templateId: string;
  templateSlug: string;
  templateName: string;
  templateVersionId: string;
  templateVersionString: string;
}

export interface DbCounts {
  organizations: number;
  users: number;
  assessments: number;
  invitations: number;
  templates: number;
  templateVersions: number;
  auditEvents: number;
}

const DEFAULT_TEST_DB_URL =
  process.env.DATABASE_MIGRATOR_URL ||
  'postgres://hs_owner:hs_owner_local@127.0.0.1:5432/hellosmart_test';

/**
 * Asserts security invariants on target database connection string.
 * Refuses execution if pointing to any non-localhost host or non-test database.
 */
export function validateDatabaseUrl(
  connectionUrl: string,
  expectedDbName = 'hellosmart_test',
): void {
  const parsed = new URL(connectionUrl);
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname)) {
    throw new Error(
      `[SECURITY] Refusing to connect to non-local database host: ${parsed.hostname}. E2E tests must run on localhost only.`,
    );
  }

  const dbName = parsed.pathname.replace(/^\//, '');
  if (dbName !== expectedDbName) {
    throw new Error(
      `[SECURITY] Refusing to run E2E against database: ${dbName}. Expected: ${expectedDbName}.`,
    );
  }
}

/**
 * Creates an admin connection pool to the test database.
 */
export function getTestDbPool(connectionUrl = DEFAULT_TEST_DB_URL): any {
  validateDatabaseUrl(connectionUrl, 'hellosmart_test');
  return new Pool({
    connectionString: connectionUrl,
    max: 5,
    idleTimeoutMillis: 5000,
  });
}

/**
 * Creates an admin connection pool to the dev database (READ-ONLY for verification).
 */
export function getDevDbPool(
  connectionUrl = 'postgres://hs_owner:hs_owner_local@127.0.0.1:5432/hellosmart',
): any {
  validateDatabaseUrl(connectionUrl, 'hellosmart');
  return new Pool({
    connectionString: connectionUrl,
    max: 2,
    idleTimeoutMillis: 5000,
  });
}

/**
 * Reads row counts for isolation & audit tracking verification.
 */
export async function getDatabaseCounts(pool: any): Promise<DbCounts> {
  const client = await pool.connect();
  try {
    const [orgs, users, assessments, invites, tpls, tplVers, audits] = await Promise.all([
      client.query('SELECT COUNT(*)::int AS count FROM app.organizations'),
      client.query('SELECT COUNT(*)::int AS count FROM app.users'),
      client.query('SELECT COUNT(*)::int AS count FROM app.assessments'),
      client.query('SELECT COUNT(*)::int AS count FROM app.invitations'),
      client.query('SELECT COUNT(*)::int AS count FROM app.templates'),
      client.query('SELECT COUNT(*)::int AS count FROM app.template_versions'),
      client.query('SELECT COUNT(*)::int AS count FROM audit.events'),
    ]);

    return {
      organizations: orgs.rows[0].count,
      users: users.rows[0].count,
      assessments: assessments.rows[0].count,
      invitations: invites.rows[0].count,
      templates: tpls.rows[0].count,
      templateVersions: tplVers.rows[0].count,
      auditEvents: audits.rows[0].count,
    };
  } finally {
    client.release();
  }
}

/**
 * Creates synthetic organization, entitlements, company_admin user,
 * template, draft template version, and template assignment on hellosmart_test.
 */
export async function setupTestEnvironment(pool: any): Promise<TestOrgFixture> {
  const nonce = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const orgId = randomUUID();
  const orgName = `Synthetic E2E Org ${nonce}`;
  const orgSlug = `e2e-org-${nonce}`;

  const adminId = randomUUID();
  const adminEmail = `admin.${nonce}@example.test`;
  const adminPassword = `AdminPass_${nonce}_!Secure99`;

  const templateId = randomUUID();
  const templateSlug = `e2e-tpl-${nonce}`;
  const templateName = `Fullstack Challenge ${nonce}`;
  const templateVersionId = randomUUID();
  // Use templateVersionId as the version string so CreateAssessmentDtoSchema (which requires z.string().uuid()) parses cleanly
  const templateVersionString = templateVersionId;

  // Hash password using backend Argon2 parameters (S0-T03-1)
  const passwordHash = await hash(adminPassword, {
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });

  const manifest = {
    name: templateName,
    version: templateVersionString,
    scenario: 'Build and debug a production-ready fullstack service.',
    brief: 'In this simulation, candidates implement core API endpoints and UI integration.',
    timing_default: { duration_minutes: 90 },
    environment: {
      runtime: ['Node.js 22', 'PostgreSQL 16'],
      tools: ['pnpm', 'vitest', 'git'],
    },
    starterRepository: {
      name: 'fullstack-starter',
      branch: 'main',
      fileStructure: ['src/main.ts', 'package.json', 'README.md'],
    },
    reviewers: ['Architecture & Design', 'Code Quality', 'Testing & Correctness'],
    rubric: [
      {
        id: 'dim_arch',
        name: 'Architecture & Design',
        goal: 'Evaluates domain boundaries and clean separation of concerns.',
        weight: 40,
        signals: ['Clean module boundaries', 'Proper dependency injection'],
      },
      {
        id: 'dim_quality',
        name: 'Code Quality',
        goal: 'Evaluates code readability, static typing, and lint compliance.',
        weight: 35,
        signals: ['Strict TypeScript typing', 'Descriptive naming conventions'],
      },
      {
        id: 'dim_tests',
        name: 'Testing & Correctness',
        goal: 'Evaluates unit test coverage and edge case handling.',
        weight: 25,
        signals: ['Automated test coverage', 'Handles error boundaries'],
      },
    ],
    aiDefaults: {
      enabled: true,
      allowedModels: ['gpt-4o', 'claude-3-5-sonnet'],
    },
  };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Insert synthetic organization
    await client.query(
      `INSERT INTO app.organizations (id, name, slug, status, created_by, retention_days)
       VALUES ($1, $2, $3, 'paid_active', '00000000-0000-4000-8000-000000000001', 90)`,
      [orgId, orgName, orgSlug],
    );

    // 2. Insert entitlements
    await client.query(
      `INSERT INTO app.entitlements (org_id, max_templates, max_candidates, pending_invite_multiplier, flags)
       VALUES ($1, 10, 50, 2.0, '{"cloud": true, "chat": true}'::jsonb)`,
      [orgId],
    );

    // 3. Insert company_admin user (MFA disabled, must_reset_password false)
    await client.query(
      `INSERT INTO app.users (
         id, org_id, email, email_verified_at, name, role,
         password_hash, must_reset_password, mfa_secret_ref, status
       ) VALUES (
         $1, $2, $3, now(), 'E2E Company Admin', 'company_admin',
         $4, false, null, 'active'
       )`,
      [adminId, orgId, adminEmail, passwordHash],
    );

    // 4. Insert master role template
    await client.query(
      `INSERT INTO app.templates (
         id, slug, name, category, difficulty, workspace_mode, description, tags
       ) VALUES (
         $1, $2, $3, 'Fullstack', 'Intermediate', 'cloud',
         'A realistic fullstack engineering assessment blueprint.',
         ARRAY['typescript', 'react', 'node']
       )`,
      [templateId, templateSlug, templateName],
    );

    // 5. Insert template version (published so templates catalog joins it)
    await client.query(
      `INSERT INTO app.template_versions (
         id, template_id, version, status, manifest
       ) VALUES (
         $1, $2, $3, 'published', $4
       )`,
      [templateVersionId, templateId, templateVersionString, JSON.stringify(manifest)],
    );

    // 6. Assign template to synthetic organization (BR-02 boundary)
    await client.query(
      `INSERT INTO app.template_assignments (template_id, org_id)
       VALUES ($1, $2)`,
      [templateId, orgId],
    );

    await client.query('COMMIT');

    return {
      orgId,
      orgName,
      orgSlug,
      adminId,
      adminEmail,
      adminPassword,
      templateId,
      templateSlug,
      templateName,
      templateVersionId,
      templateVersionString,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Cleans up all test data for the synthetic organization in reverse dependency order.
 * Asserts that 0 rows remain across all modified tables.
 */
export async function cleanupTestEnvironment(
  pool: any,
  fixture: Pick<TestOrgFixture, 'orgId' | 'templateId' | 'templateVersionId'>,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL session_replication_role = replica');

    // 1. Delete created assessments
    await client.query('DELETE FROM app.assessments WHERE org_id = $1', [fixture.orgId]);

    // 2. Delete invitations created for admin and imported candidates
    await client.query('DELETE FROM app.invitations WHERE org_id = $1', [fixture.orgId]);

    // 3. Delete users (company_admin and candidates)
    await client.query('DELETE FROM app.users WHERE org_id = $1', [fixture.orgId]);

    // 4. Delete draft template version
    await client.query('DELETE FROM app.template_versions WHERE id = $1', [
      fixture.templateVersionId,
    ]);

    // 5. Delete template assignment
    await client.query('DELETE FROM app.template_assignments WHERE org_id = $1', [fixture.orgId]);

    // 6. Delete template
    await client.query('DELETE FROM app.templates WHERE id = $1', [fixture.templateId]);

    // 7. Delete entitlements
    await client.query('DELETE FROM app.entitlements WHERE org_id = $1', [fixture.orgId]);

    // 8. Delete organization
    await client.query('DELETE FROM app.organizations WHERE id = $1', [fixture.orgId]);

    await client.query('SET LOCAL session_replication_role = origin');
    await client.query('COMMIT');

    // Assert zero rows remain for this test org
    const remaining = await client.query(
      `SELECT
         (SELECT COUNT(*)::int FROM app.organizations WHERE id = $1) AS orgs,
         (SELECT COUNT(*)::int FROM app.users WHERE org_id = $1) AS users,
         (SELECT COUNT(*)::int FROM app.assessments WHERE org_id = $1) AS assessments,
         (SELECT COUNT(*)::int FROM app.invitations WHERE org_id = $1) AS invitations,
         (SELECT COUNT(*)::int FROM app.templates WHERE id = $2) AS templates,
         (SELECT COUNT(*)::int FROM app.template_versions WHERE id = $3) AS versions`,
      [fixture.orgId, fixture.templateId, fixture.templateVersionId],
    );

    const counts = remaining.rows[0];
    const leftoverSum =
      counts.orgs +
      counts.users +
      counts.assessments +
      counts.invitations +
      counts.templates +
      counts.versions;

    if (leftoverSum > 0) {
      throw new Error(
        `[CLEANUP ERROR] Failed to clean up all test rows for org ${fixture.orgId}: ${JSON.stringify(counts)}`,
      );
    }
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
