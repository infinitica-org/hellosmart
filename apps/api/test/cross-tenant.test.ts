import crypto from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { appendAuditEvent } from '../src/modules/audit/audit-writer.js';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://hs_app:hs_app_local@127.0.0.1:5432/hellosmart';
const DATABASE_ADMIN_URL =
  process.env.DATABASE_ADMIN_URL ??
  'postgres://hs_owner:hs_owner_local@127.0.0.1:5432/hellosmart';

interface TestContext {
  orgAlphaId: string;
  orgBetaId: string;
  userAlphaId: string;
  userBetaId: string;
  userAlphaEmail: string;
  userBetaEmail: string;
  tokenAlpha: string;
  tokenAlphaHash: Buffer;
  tokenBeta: string;
  tokenBetaHash: Buffer;
  tokenConsumedHash: Buffer;
  tokenExpiredHash: Buffer;
}

let appPool: pg.Pool;
let adminPool: pg.Pool;
let ctx: TestContext;
let isDbAvailable = false;

async function checkDbConnection(): Promise<boolean> {
  try {
    const probe = new pg.Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 3000, max: 1 });
    const client = await probe.connect();
    await client.query('SELECT 1');
    client.release();
    await probe.end();
    return true;
  } catch {
    return false;
  }
}

isDbAvailable = await checkDbConnection();

describe.runIf(isDbAvailable).sequential('Stream 10: PostgreSQL RLS Access Paths & Cross-Tenant Security', () => {
  beforeAll(async () => {
    appPool = new pg.Pool({ connectionString: DATABASE_URL });
    adminPool = new pg.Pool({ connectionString: DATABASE_ADMIN_URL });

    const nonce = crypto.randomBytes(4).toString('hex');
    const orgAlphaSlug = `rls-alpha-${nonce}`;
    const orgBetaSlug = `rls-beta-${nonce}`;
    const userAlphaEmail = `candidate.alpha.${nonce}@example.test`;
    const userBetaEmail = `candidate.beta.${nonce}@example.test`;

    const adminClient = await adminPool.connect();
    try {
      // 1. Create Org Alpha
      const alphaOrgRes = await adminClient.query(
        `INSERT INTO app.organizations (name, slug, status, created_by)
         VALUES ($1, $2, 'paid_active', '00000000-0000-4000-8000-000000000001')
         RETURNING id`,
        [`Org Alpha ${nonce}`, orgAlphaSlug],
      );
      const orgAlphaId = alphaOrgRes.rows[0].id;

      await adminClient.query(
        `INSERT INTO app.entitlements (org_id, max_templates, max_candidates)
         VALUES ($1, 5, 20) ON CONFLICT (org_id) DO NOTHING`,
        [orgAlphaId],
      );

      // 2. Create Org Beta
      const betaOrgRes = await adminClient.query(
        `INSERT INTO app.organizations (name, slug, status, created_by)
         VALUES ($1, $2, 'paid_active', '00000000-0000-4000-8000-000000000001')
         RETURNING id`,
        [`Org Beta ${nonce}`, orgBetaSlug],
      );
      const orgBetaId = betaOrgRes.rows[0].id;

      await adminClient.query(
        `INSERT INTO app.entitlements (org_id, max_templates, max_candidates)
         VALUES ($1, 5, 20) ON CONFLICT (org_id) DO NOTHING`,
        [orgBetaId],
      );

      // 3. Create Users
      const dummyPasswordHash = '$argon2id$v=19$m=19456,t=2,p=1$dummy$dummy';
      const userAlphaRes = await adminClient.query(
        `INSERT INTO app.users (org_id, email, name, role, password_hash, status)
         VALUES ($1, $2, 'User Alpha', 'candidate', $3, 'active')
         RETURNING id`,
        [orgAlphaId, userAlphaEmail, dummyPasswordHash],
      );
      const userAlphaId = userAlphaRes.rows[0].id;

      const userBetaRes = await adminClient.query(
        `INSERT INTO app.users (org_id, email, name, role, password_hash, status)
         VALUES ($1, $2, 'User Beta', 'candidate', $3, 'active')
         RETURNING id`,
        [orgBetaId, userBetaEmail, dummyPasswordHash],
      );
      const userBetaId = userBetaRes.rows[0].id;

      // 4. Create Invitations
      const tokenAlpha = `tok-alpha-${nonce}`;
      const tokenAlphaHash = crypto.createHash('sha256').update(tokenAlpha).digest();
      await adminClient.query(
        `INSERT INTO app.invitations (org_id, user_id, email, role, token_hash, expires_at)
         VALUES ($1, $2, $3, 'candidate', $4, now() + interval '3 days')`,
        [orgAlphaId, userAlphaId, userAlphaEmail, tokenAlphaHash],
      );

      const tokenBeta = `tok-beta-${nonce}`;
      const tokenBetaHash = crypto.createHash('sha256').update(tokenBeta).digest();
      await adminClient.query(
        `INSERT INTO app.invitations (org_id, user_id, email, role, token_hash, expires_at)
         VALUES ($1, $2, $3, 'candidate', $4, now() + interval '3 days')`,
        [orgBetaId, userBetaId, userBetaEmail, tokenBetaHash],
      );

      const tokenConsumed = `tok-consumed-${nonce}`;
      const tokenConsumedHash = crypto.createHash('sha256').update(tokenConsumed).digest();
      await adminClient.query(
        `INSERT INTO app.invitations (org_id, user_id, email, role, token_hash, expires_at, used_at)
         VALUES ($1, $2, $3, 'candidate', $4, now() + interval '3 days', now() - interval '1 hour')`,
        [orgAlphaId, userAlphaId, userAlphaEmail, tokenConsumedHash],
      );

      const tokenExpired = `tok-expired-${nonce}`;
      const tokenExpiredHash = crypto.createHash('sha256').update(tokenExpired).digest();
      await adminClient.query(
        `INSERT INTO app.invitations (org_id, user_id, email, role, token_hash, created_at, expires_at)
         VALUES ($1, $2, $3, 'candidate', $4, now() - interval '2 days', now() - interval '1 day')`,
        [orgBetaId, userBetaId, userBetaEmail, tokenExpiredHash],
      );

      // 5. Create Audit Events using canonical appendAuditEvent
      await appendAuditEvent(adminClient, {
        actorId: userAlphaId,
        actorRole: 'candidate',
        orgId: orgAlphaId,
        action: 'user.created',
        entity: 'user',
        entityId: userAlphaId,
        after: { created: true },
        ip: '127.0.0.1',
      });
      await appendAuditEvent(adminClient, {
        actorId: userBetaId,
        actorRole: 'candidate',
        orgId: orgBetaId,
        action: 'user.created',
        entity: 'user',
        entityId: userBetaId,
        after: { created: true },
        ip: '127.0.0.1',
      });

      ctx = {
        orgAlphaId,
        orgBetaId,
        userAlphaId,
        userBetaId,
        userAlphaEmail,
        userBetaEmail,
        tokenAlpha,
        tokenAlphaHash,
        tokenBeta,
        tokenBetaHash,
        tokenConsumedHash,
        tokenExpiredHash,
      };
    } finally {
      adminClient.release();
    }
  }, 30_000);

  afterAll(async () => {
    if (adminPool && ctx) {
      const adminClient = await adminPool.connect();
      try {
        await adminClient.query('DELETE FROM app.invitations WHERE org_id IN ($1, $2)', [ctx.orgAlphaId, ctx.orgBetaId]);
        await adminClient.query('DELETE FROM audit.events WHERE org_id IN ($1, $2)');
        await adminClient.query('DELETE FROM app.users WHERE org_id IN ($1, $2)', [ctx.orgAlphaId, ctx.orgBetaId]);
        await adminClient.query('DELETE FROM app.entitlements WHERE org_id IN ($1, $2)', [ctx.orgAlphaId, ctx.orgBetaId]);
        await adminClient.query('DELETE FROM app.organizations WHERE id IN ($1, $2)', [ctx.orgAlphaId, ctx.orgBetaId]);
      } catch {
        // Best-effort cleanup
      } finally {
        adminClient.release();
      }
    }
    await appPool?.end();
    await adminPool?.end();
  });

  // 1. Role Verification (S0-T10-1)
  it('1. Database connection operates strictly as hs_app with NOBYPASSRLS and NOSUPERUSER', async () => {
    const client = await appPool.connect();
    try {
      const res = await client.query(`
        SELECT current_user, session_user, rolsuper, rolbypassrls
        FROM pg_roles
        WHERE rolname = current_user;
      `);
      expect(res.rows).toHaveLength(1);
      const role = res.rows[0];
      expect(role.current_user).toBe('hs_app');
      expect(role.session_user).toBe('hs_app');
      expect(role.rolsuper).toBe(false);
      expect(role.rolbypassrls).toBe(false);
    } finally {
      client.release();
    }
  });

  // 2. Table RLS Status (S0-T10-1, BR-01, BR-31)
  it('2. All core tables and audit.events have rowsecurity=true and forcerowsecurity=true', async () => {
    const client = await appPool.connect();
    try {
      const res = await client.query(`
        SELECT n.nspname AS schemaname, c.relname AS tablename, c.relrowsecurity, c.relforcerowsecurity
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname IN ('app', 'audit')
          AND c.relname IN ('organizations', 'entitlements', 'users', 'invitations', 'events')
        ORDER BY n.nspname, c.relname;
      `);
      expect(res.rows.length).toBeGreaterThanOrEqual(5);
      for (const row of res.rows) {
        expect(row.relrowsecurity, `table ${row.schemaname}.${row.tablename} must have relrowsecurity`).toBe(true);
        expect(row.relforcerowsecurity, `table ${row.schemaname}.${row.tablename} must have relforcerowsecurity`).toBe(true);
      }
    } finally {
      client.release();
    }
  });

  // 3. Direct Unauthenticated Read Isolation (S0-T10-1, BR-01)
  it('3. Direct SELECT as hs_app without tenant context returns 0 rows across all tables', async () => {
    const client = await appPool.connect();
    try {
      const users = await client.query('SELECT count(*) FROM app.users');
      expect(parseInt(users.rows[0].count, 10)).toBe(0);

      const orgs = await client.query('SELECT count(*) FROM app.organizations');
      expect(parseInt(orgs.rows[0].count, 10)).toBe(0);

      const entitlements = await client.query('SELECT count(*) FROM app.entitlements');
      expect(parseInt(entitlements.rows[0].count, 10)).toBe(0);

      const invitations = await client.query('SELECT count(*) FROM app.invitations');
      expect(parseInt(invitations.rows[0].count, 10)).toBe(0);

      const auditEvents = await client.query('SELECT count(*) FROM audit.events');
      expect(parseInt(auditEvents.rows[0].count, 10)).toBe(0);
    } finally {
      client.release();
    }
  });

  // 4. Pre-Login User Lookup SECURITY DEFINER (S0-T10-1)
  it('4. app.find_user_for_login resolves users across organizations without platform elevation', async () => {
    const client = await appPool.connect();
    try {
      // Lookup Org Alpha user
      const alphaRes = await client.query('SELECT * FROM app.find_user_for_login($1)', [ctx.userAlphaEmail]);
      expect(alphaRes.rows).toHaveLength(1);
      const alphaUser = alphaRes.rows[0];
      expect(alphaUser.id).toBe(ctx.userAlphaId);
      expect(alphaUser.org_id).toBe(ctx.orgAlphaId);
      expect(alphaUser.email).toBe(ctx.userAlphaEmail);
      expect(alphaUser.role).toBe('candidate');
      expect(alphaUser.org_status).toBe('paid_active');
      expect(alphaUser.password_hash).toBeTruthy();

      // Lookup Org Beta user
      const betaRes = await client.query('SELECT * FROM app.find_user_for_login($1)', [ctx.userBetaEmail]);
      expect(betaRes.rows).toHaveLength(1);
      const betaUser = betaRes.rows[0];
      expect(betaUser.id).toBe(ctx.userBetaId);
      expect(betaUser.org_id).toBe(ctx.orgBetaId);
      expect(betaUser.email).toBe(ctx.userBetaEmail);

      // Verify non-existent email returns 0 rows
      const noneRes = await client.query('SELECT * FROM app.find_user_for_login($1)', ['nonexistent@example.test']);
      expect(noneRes.rows).toHaveLength(0);

      // Verify empty or null email returns 0 rows
      const emptyRes = await client.query('SELECT * FROM app.find_user_for_login($1)', ['']);
      expect(emptyRes.rows).toHaveLength(0);
      const nullRes = await client.query('SELECT * FROM app.find_user_for_login($1)', [null]);
      expect(nullRes.rows).toHaveLength(0);
    } finally {
      client.release();
    }
  });

  // 5. Soft-Deleted User Exclusion (S0-T10-1)
  it('5. app.find_user_for_login excludes soft-deleted accounts', async () => {
    const adminClient = await adminPool.connect();
    const appClient = await appPool.connect();
    const deletedEmail = `deleted.${crypto.randomBytes(3).toString('hex')}@example.test`;
    try {
      await adminClient.query(
        `INSERT INTO app.users (org_id, email, name, role, password_hash, status, deleted_at)
         VALUES ($1, $2, 'Deleted User', 'candidate', '$argon2id$v=19$dummy', 'deleted', now())`,
        [ctx.orgAlphaId, deletedEmail],
      );

      const res = await appClient.query('SELECT * FROM app.find_user_for_login($1)', [deletedEmail]);
      expect(res.rows).toHaveLength(0);
    } finally {
      await adminClient.query('DELETE FROM app.users WHERE email = $1', [deletedEmail]);
      adminClient.release();
      appClient.release();
    }
  });

  // 6. User Lookup by ID (S0-T10-1)
  it('6. app.find_user_by_id resolves user by UUID without tenant context', async () => {
    const client = await appPool.connect();
    try {
      const res = await client.query('SELECT * FROM app.find_user_by_id($1)', [ctx.userAlphaId]);
      expect(res.rows).toHaveLength(1);
      expect(res.rows[0].id).toBe(ctx.userAlphaId);
      expect(res.rows[0].org_id).toBe(ctx.orgAlphaId);
      expect(res.rows[0].email).toBe(ctx.userAlphaEmail);

      const randomRes = await client.query('SELECT * FROM app.find_user_by_id($1)', ['00000000-0000-4000-8000-999999999999']);
      expect(randomRes.rows).toHaveLength(0);

      const nullRes = await client.query('SELECT * FROM app.find_user_by_id($1)', [null]);
      expect(nullRes.rows).toHaveLength(0);
    } finally {
      client.release();
    }
  });

  // 7. Pre-Login Invitation Lookup (S0-T10-1)
  it('7. app.find_invitation_by_token_hash validates tokens securely', async () => {
    const client = await appPool.connect();
    try {
      // Valid unexpired invitation
      const validRes = await client.query(
        'SELECT * FROM app.find_invitation_by_token_hash($1)',
        [ctx.tokenAlphaHash],
      );
      expect(validRes.rows).toHaveLength(1);
      const inv = validRes.rows[0];
      expect(inv.org_id).toBe(ctx.orgAlphaId);
      expect(inv.email).toBe(ctx.userAlphaEmail);
      expect(inv.role).toBe('candidate');
      expect(inv.used_at).toBeNull();

      // Backward-compatible alias app.lookup_invitation
      const aliasRes = await client.query(
        'SELECT * FROM app.lookup_invitation($1)',
        [ctx.tokenAlphaHash],
      );
      expect(aliasRes.rows).toHaveLength(1);
      expect(aliasRes.rows[0].email).toBe(ctx.userAlphaEmail);

      // Consumed invitation returns 0 rows
      const consumedRes = await client.query(
        'SELECT * FROM app.find_invitation_by_token_hash($1)',
        [ctx.tokenConsumedHash],
      );
      expect(consumedRes.rows).toHaveLength(0);

      // Expired invitation returns 0 rows
      const expiredRes = await client.query(
        'SELECT * FROM app.find_invitation_by_token_hash($1)',
        [ctx.tokenExpiredHash],
      );
      expect(expiredRes.rows).toHaveLength(0);

      // Random 32-byte hash returns 0 rows
      const randomHash = crypto.randomBytes(32);
      const randomRes = await client.query(
        'SELECT * FROM app.find_invitation_by_token_hash($1)',
        [randomHash],
      );
      expect(randomRes.rows).toHaveLength(0);

      // Invalid hash length returns 0 rows
      const shortHash = crypto.randomBytes(16);
      const shortRes = await client.query(
        'SELECT * FROM app.find_invitation_by_token_hash($1)',
        [shortHash],
      );
      expect(shortRes.rows).toHaveLength(0);
    } finally {
      client.release();
    }
  });

  // 8. Cross-Tenant Isolation: Org A cannot read or write Org B (S0-T10-2, BR-01)
  it('8. Org A context is strictly isolated from Org B data', async () => {
    const client = await appPool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.org_id', $1, true)", [ctx.orgAlphaId]);

      // 1. Users isolation
      const users = await client.query('SELECT id, org_id, email FROM app.users');
      expect(users.rows.length).toBeGreaterThanOrEqual(1);
      for (const u of users.rows) {
        expect(u.org_id).toBe(ctx.orgAlphaId);
        expect(u.org_id).not.toBe(ctx.orgBetaId);
      }

      // Querying specifically for Org B user returns 0 rows
      const betaUserQuery = await client.query('SELECT * FROM app.users WHERE id = $1', [ctx.userBetaId]);
      expect(betaUserQuery.rows).toHaveLength(0);

      // 2. Invitations isolation
      const invitations = await client.query('SELECT id, org_id FROM app.invitations');
      expect(invitations.rows.length).toBeGreaterThanOrEqual(1);
      for (const inv of invitations.rows) {
        expect(inv.org_id).toBe(ctx.orgAlphaId);
        expect(inv.org_id).not.toBe(ctx.orgBetaId);
      }

      // 3. Audit events isolation
      const audit = await client.query('SELECT id, org_id FROM audit.events');
      expect(audit.rows.length).toBeGreaterThanOrEqual(1);
      for (const ev of audit.rows) {
        expect(ev.org_id).toBe(ctx.orgAlphaId);
        expect(ev.org_id).not.toBe(ctx.orgBetaId);
      }

      // 4. Cross-tenant mutation blocked by RLS
      const updateRes = await client.query(
        "UPDATE app.users SET name = 'Tampered' WHERE id = $1",
        [ctx.userBetaId],
      );
      expect(updateRes.rowCount).toBe(0);

      const deleteRes = await client.query(
        'DELETE FROM app.users WHERE id = $1',
        [ctx.userBetaId],
      );
      expect(deleteRes.rowCount).toBe(0);

      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  // 9. Cross-Tenant Isolation: Org B context cannot see Org A (S0-T10-2, BR-01)
  it('9. Org B context is strictly isolated from Org A data', async () => {
    const client = await appPool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.org_id', $1, true)", [ctx.orgBetaId]);

      const users = await client.query('SELECT id, org_id FROM app.users');
      expect(users.rows.length).toBeGreaterThanOrEqual(1);
      for (const u of users.rows) {
        expect(u.org_id).toBe(ctx.orgBetaId);
        expect(u.org_id).not.toBe(ctx.orgAlphaId);
      }

      const alphaUserQuery = await client.query('SELECT * FROM app.users WHERE id = $1', [ctx.userAlphaId]);
      expect(alphaUserQuery.rows).toHaveLength(0);

      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  // 10. Platform Admin Context Access (S0-T10-2)
  it('10. Platform admin context (app.is_platform = true) can query across all tenants', async () => {
    const client = await appPool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.is_platform', 'true', true)");

      // Can see both Org A and Org B users
      const users = await client.query(
        'SELECT id, org_id FROM app.users WHERE id IN ($1, $2)',
        [ctx.userAlphaId, ctx.userBetaId],
      );
      expect(users.rows).toHaveLength(2);

      // Can see both Org A and Org B organizations
      const orgs = await client.query(
        'SELECT id FROM app.organizations WHERE id IN ($1, $2)',
        [ctx.orgAlphaId, ctx.orgBetaId],
      );
      expect(orgs.rows).toHaveLength(2);

      // Can see audit events across organizations
      const audit = await client.query(
        'SELECT id, org_id FROM audit.events WHERE org_id IN ($1, $2)',
        [ctx.orgAlphaId, ctx.orgBetaId],
      );
      expect(audit.rows).toHaveLength(2);

      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  // 11. Audit Immutability (BR-31)
  it('11. Direct UPDATE or DELETE on audit.events is strictly rejected', async () => {
    const client = await appPool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.is_platform', 'true', true)");

      await expect(
        client.query("UPDATE audit.events SET action = 'tampered' WHERE org_id = $1", [ctx.orgAlphaId]),
      ).rejects.toThrow();

      await expect(
        client.query('DELETE FROM audit.events WHERE org_id = $1', [ctx.orgAlphaId]),
      ).rejects.toThrow();

      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  // 12. Least Privilege Function Permissions Check (S0-T10-1)
  it('12. Routine execution privileges are granted exclusively to hs_app and revoked from PUBLIC', async () => {
    const client = await appPool.connect();
    try {
      const res = await client.query(`
        SELECT
          p.proname,
          has_function_privilege('hs_app', p.oid, 'EXECUTE') AS hs_app_can_exec,
          has_function_privilege('public', p.oid, 'EXECUTE') AS public_can_exec
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'app'
          AND p.proname IN ('find_user_for_login', 'find_user_by_id', 'find_invitation_by_token_hash', 'lookup_invitation', 'accept_invitation')
        ORDER BY p.proname;
      `);

      expect(res.rows.length).toBeGreaterThanOrEqual(5);
      for (const row of res.rows) {
        expect(row.hs_app_can_exec, `${row.proname} must be executable by hs_app`).toBe(true);
        expect(row.public_can_exec, `${row.proname} must NOT be executable by PUBLIC`).toBe(false);
      }
    } finally {
      client.release();
    }
  });
});
