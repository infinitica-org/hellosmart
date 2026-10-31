import crypto from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { appendAuditEvent } from '../src/modules/audit/audit-writer.js';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://hs_app:hs_app_local@127.0.0.1:5432/hellosmart';
const DATABASE_PLATFORM_URL =
  process.env.DATABASE_PLATFORM_URL ??
  'postgres://hs_platform:hs_platform_local@127.0.0.1:5432/hellosmart';
const DATABASE_ADMIN_URL =
  process.env.DATABASE_ADMIN_URL ?? 'postgres://hs_owner:hs_owner_local@127.0.0.1:5432/hellosmart';

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
  pwdAlphaId: string;
  pwdBetaId: string;
  codeAlphaId: string;
  codeBetaId: string;
}

let appPool: pg.Pool;
let platformPool: pg.Pool;
let adminPool: pg.Pool;
let ctx: TestContext;
let isDbAvailable = false;

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

isDbAvailable = await checkDbConnection();

describe
  .runIf(isDbAvailable)
  .sequential('Stream 10: PostgreSQL RLS Access Paths & Cross-Tenant Security', () => {
    beforeAll(async () => {
      appPool = new pg.Pool({ connectionString: DATABASE_URL });
      platformPool = new pg.Pool({ connectionString: DATABASE_PLATFORM_URL });
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

        // 6. Seed password history & MFA backup codes
        const pwdAlphaRes = await adminClient.query(
          `INSERT INTO app.password_history (user_id, password_hash)
         VALUES ($1, $2) RETURNING id`,
          [userAlphaId, dummyPasswordHash],
        );
        const pwdBetaRes = await adminClient.query(
          `INSERT INTO app.password_history (user_id, password_hash)
         VALUES ($1, $2) RETURNING id`,
          [userBetaId, dummyPasswordHash],
        );

        const codeAlphaRes = await adminClient.query(
          `INSERT INTO app.mfa_backup_codes (user_id, code_hash)
         VALUES ($1, 'hash_alpha_1') RETURNING id`,
          [userAlphaId],
        );
        const codeBetaRes = await adminClient.query(
          `INSERT INTO app.mfa_backup_codes (user_id, code_hash)
         VALUES ($1, 'hash_beta_1') RETURNING id`,
          [userBetaId],
        );

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
          pwdAlphaId: pwdAlphaRes.rows[0].id,
          pwdBetaId: pwdBetaRes.rows[0].id,
          codeAlphaId: codeAlphaRes.rows[0].id,
          codeBetaId: codeBetaRes.rows[0].id,
        };
      } finally {
        adminClient.release();
      }
    }, 30_000);

    afterAll(async () => {
      if (adminPool && ctx) {
        const adminClient = await adminPool.connect();
        try {
          await adminClient.query('DELETE FROM app.mfa_backup_codes WHERE user_id IN ($1, $2)', [
            ctx.userAlphaId,
            ctx.userBetaId,
          ]);
          await adminClient.query('DELETE FROM app.password_history WHERE user_id IN ($1, $2)', [
            ctx.userAlphaId,
            ctx.userBetaId,
          ]);
          await adminClient.query('DELETE FROM app.invitations WHERE org_id IN ($1, $2)', [
            ctx.orgAlphaId,
            ctx.orgBetaId,
          ]);
          await adminClient.query('DELETE FROM audit.events WHERE org_id IN ($1, $2)');
          await adminClient.query('DELETE FROM app.users WHERE org_id IN ($1, $2)', [
            ctx.orgAlphaId,
            ctx.orgBetaId,
          ]);
          await adminClient.query('DELETE FROM app.entitlements WHERE org_id IN ($1, $2)', [
            ctx.orgAlphaId,
            ctx.orgBetaId,
          ]);
          await adminClient.query('DELETE FROM app.organizations WHERE id IN ($1, $2)', [
            ctx.orgAlphaId,
            ctx.orgBetaId,
          ]);
        } catch {
          // Best-effort cleanup
        } finally {
          adminClient.release();
        }
      }
      await appPool?.end();
      await platformPool?.end();
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
          expect(
            row.relrowsecurity,
            `table ${row.schemaname}.${row.tablename} must have relrowsecurity`,
          ).toBe(true);
          expect(
            row.relforcerowsecurity,
            `table ${row.schemaname}.${row.tablename} must have relforcerowsecurity`,
          ).toBe(true);
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
        const alphaRes = await client.query('SELECT * FROM app.find_user_for_login($1)', [
          ctx.userAlphaEmail,
        ]);
        expect(alphaRes.rows).toHaveLength(1);
        const alphaUser = alphaRes.rows[0];
        expect(alphaUser.id).toBe(ctx.userAlphaId);
        expect(alphaUser.org_id).toBe(ctx.orgAlphaId);
        expect(alphaUser.email).toBe(ctx.userAlphaEmail);
        expect(alphaUser.role).toBe('candidate');
        expect(alphaUser.org_status).toBe('paid_active');
        expect(alphaUser.password_hash).toBeTruthy();

        // Lookup Org Beta user
        const betaRes = await client.query('SELECT * FROM app.find_user_for_login($1)', [
          ctx.userBetaEmail,
        ]);
        expect(betaRes.rows).toHaveLength(1);
        const betaUser = betaRes.rows[0];
        expect(betaUser.id).toBe(ctx.userBetaId);
        expect(betaUser.org_id).toBe(ctx.orgBetaId);
        expect(betaUser.email).toBe(ctx.userBetaEmail);

        // Verify non-existent email returns 0 rows
        const noneRes = await client.query('SELECT * FROM app.find_user_for_login($1)', [
          'nonexistent@example.test',
        ]);
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

        const res = await appClient.query('SELECT * FROM app.find_user_for_login($1)', [
          deletedEmail,
        ]);
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

        const randomRes = await client.query('SELECT * FROM app.find_user_by_id($1)', [
          '00000000-0000-4000-8000-999999999999',
        ]);
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
        const validRes = await client.query('SELECT * FROM app.find_invitation_by_token_hash($1)', [
          ctx.tokenAlphaHash,
        ]);
        expect(validRes.rows).toHaveLength(1);
        const inv = validRes.rows[0];
        expect(inv.org_id).toBe(ctx.orgAlphaId);
        expect(inv.email).toBe(ctx.userAlphaEmail);
        expect(inv.role).toBe('candidate');
        expect(inv.used_at).toBeNull();

        // Backward-compatible alias app.lookup_invitation
        const aliasRes = await client.query('SELECT * FROM app.lookup_invitation($1)', [
          ctx.tokenAlphaHash,
        ]);
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
        const shortRes = await client.query('SELECT * FROM app.find_invitation_by_token_hash($1)', [
          shortHash,
        ]);
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
        const betaUserQuery = await client.query('SELECT * FROM app.users WHERE id = $1', [
          ctx.userBetaId,
        ]);
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

        const deleteRes = await client.query('DELETE FROM app.users WHERE id = $1', [
          ctx.userBetaId,
        ]);
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

        const alphaUserQuery = await client.query('SELECT * FROM app.users WHERE id = $1', [
          ctx.userAlphaId,
        ]);
        expect(alphaUserQuery.rows).toHaveLength(0);

        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });

    // 10a. Attack Test: hs_app setting app.is_platform = true CANNOT forge platform access (S0-T10-2)
    it('10a. Attack Test: hs_app setting app.is_platform = true evaluates app.is_platform() to false and yields 0 rows', async () => {
      const client = await appPool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT set_config('app.is_platform', 'true', true)");

        // Critical assertion: app.is_platform() MUST be false because SESSION_USER is hs_app!
        const check = await client.query('SELECT app.is_platform() AS is_plat');
        expect(check.rows[0].is_plat).toBe(false);

        // All cross-tenant reads return 0 rows under forged GUC
        const users = await client.query('SELECT * FROM app.users WHERE id IN ($1, $2)', [
          ctx.userAlphaId,
          ctx.userBetaId,
        ]);
        expect(users.rows).toHaveLength(0);

        const orgs = await client.query('SELECT * FROM app.organizations WHERE id IN ($1, $2)', [
          ctx.orgAlphaId,
          ctx.orgBetaId,
        ]);
        expect(orgs.rows).toHaveLength(0);

        const audit = await client.query('SELECT * FROM audit.events WHERE org_id IN ($1, $2)', [
          ctx.orgAlphaId,
          ctx.orgBetaId,
        ]);
        expect(audit.rows).toHaveLength(0);

        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });

    // 10b. Attack Test: hs_app cannot insert cross-tenant records under forged platform context
    it('10b. Attack Test: hs_app setting app.is_platform = true CANNOT insert cross-tenant records', async () => {
      const client = await appPool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT set_config('app.is_platform', 'true', true)");

        await expect(
          client.query(
            `
          INSERT INTO app.invitations (id, org_id, user_id, email, role, token_hash, expires_at)
          VALUES (gen_random_uuid(), $1, $2, 'forged@beta.test', 'candidate', decode('5555555555555555555555555555555555555555555555555555555555555555', 'hex'), now() + interval '24 hours')
        `,
            [ctx.orgBetaId, ctx.userBetaId],
          ),
        ).rejects.toThrow();

        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });

    // 10c. Attack Test: hs_app cannot execute SET ROLE hs_platform (denied at database kernel)
    it('10c. Attack Test: hs_app cannot execute SET ROLE hs_platform (denied at database kernel)', async () => {
      const client = await appPool.connect();
      try {
        await expect(client.query('SET ROLE hs_platform')).rejects.toThrow(
          expect.objectContaining({ code: '42501' }),
        );
      } finally {
        client.release();
      }
    });

    // 10d. Legitimate Platform Admin without GUC cannot read cross-tenant records (prevents accidental leak)
    it('10d. Legitimate hs_platform connection without app.is_platform GUC returns 0 rows', async () => {
      const client = await platformPool.connect();
      try {
        const users = await client.query('SELECT * FROM app.users WHERE id IN ($1, $2)', [
          ctx.userAlphaId,
          ctx.userBetaId,
        ]);
        expect(users.rows).toHaveLength(0);
      } finally {
        client.release();
      }
    });

    // 10e. Legitimate Platform Admin WITH app.is_platform = true can query across all tenants (S0-T10-2)
    it('10e. Legitimate hs_platform connection with app.is_platform = true can query across all tenants', async () => {
      const client = await platformPool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT set_config('app.is_platform', 'true', true)");

        const isPlat = await client.query('SELECT app.is_platform() AS is_plat');
        expect(isPlat.rows[0].is_plat).toBe(true);

        // Can see both Org A and Org B users
        const users = await client.query('SELECT id, org_id FROM app.users WHERE id IN ($1, $2)', [
          ctx.userAlphaId,
          ctx.userBetaId,
        ]);
        expect(users.rows).toHaveLength(2);

        // Can see both Org A and Org B organizations
        const orgs = await client.query('SELECT id FROM app.organizations WHERE id IN ($1, $2)', [
          ctx.orgAlphaId,
          ctx.orgBetaId,
        ]);
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
      const client = await platformPool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT set_config('app.is_platform', 'true', true)");

        await expect(
          client.query("UPDATE audit.events SET action = 'tampered' WHERE org_id = $1", [
            ctx.orgAlphaId,
          ]),
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
    it('12. Routine execution privileges are granted to hs_app & hs_platform, and revoked from PUBLIC', async () => {
      const client = await appPool.connect();
      try {
        const res = await client.query(`
        SELECT
          p.proname,
          has_function_privilege('hs_app', p.oid, 'EXECUTE') AS hs_app_can_exec,
          has_function_privilege('hs_platform', p.oid, 'EXECUTE') AS hs_platform_can_exec,
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
          expect(row.hs_platform_can_exec, `${row.proname} must be executable by hs_platform`).toBe(
            true,
          );
          expect(row.public_can_exec, `${row.proname} must NOT be executable by PUBLIC`).toBe(
            false,
          );
        }
      } finally {
        client.release();
      }
    });

    // 13. Multi-table Tenant Scoping Verification (BR-01)
    it('13. Multi-table query scoping strictly isolates all tenant tables under hs_app', async () => {
      const client = await appPool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT set_config('app.org_id', $1, true)", [ctx.orgAlphaId]);

        // app.users
        const users = await client.query('SELECT id, org_id FROM app.users');
        expect(users.rows.length).toBeGreaterThanOrEqual(1);
        expect(users.rows.every((r) => r.org_id === ctx.orgAlphaId)).toBe(true);

        // app.organizations
        const orgs = await client.query('SELECT id FROM app.organizations');
        expect(orgs.rows).toHaveLength(1);
        expect(orgs.rows[0].id).toBe(ctx.orgAlphaId);

        // app.entitlements
        const ents = await client.query('SELECT org_id FROM app.entitlements');
        expect(ents.rows).toHaveLength(1);
        expect(ents.rows[0].org_id).toBe(ctx.orgAlphaId);

        // app.invitations
        const invites = await client.query('SELECT id, org_id FROM app.invitations');
        expect(invites.rows.length).toBeGreaterThanOrEqual(1);
        expect(invites.rows.every((r) => r.org_id === ctx.orgAlphaId)).toBe(true);

        // audit.events
        const audits = await client.query('SELECT id, org_id FROM audit.events');
        expect(audits.rows.length).toBeGreaterThanOrEqual(1);
        expect(audits.rows.every((r) => r.org_id === ctx.orgAlphaId)).toBe(true);

        await client.query('ROLLBACK');
      } finally {
        await client.query('ROLLBACK').catch(() => {});
        client.release();
      }
    });

    // 14. Fail-Closed Tenant Access without Context (BR-01)
    it('14. Without tenant context (app.org_id NULL), all tenant tables return 0 rows under hs_app', async () => {
      const client = await appPool.connect();
      try {
        await client.query('BEGIN');
        // No app.org_id set

        const users = await client.query('SELECT * FROM app.users');
        expect(users.rows).toHaveLength(0);

        const orgs = await client.query('SELECT * FROM app.organizations');
        expect(orgs.rows).toHaveLength(0);

        const ents = await client.query('SELECT * FROM app.entitlements');
        expect(ents.rows).toHaveLength(0);

        const invites = await client.query('SELECT * FROM app.invitations');
        expect(invites.rows).toHaveLength(0);

        const audits = await client.query('SELECT * FROM audit.events');
        expect(audits.rows).toHaveLength(0);

        const pwds = await client.query('SELECT * FROM app.password_history');
        expect(pwds.rows).toHaveLength(0);

        // Direct query to mfa_backup_codes as hs_app fails with privilege error (least privilege)
        await expect(client.query('SELECT * FROM app.mfa_backup_codes')).rejects.toThrow(
          /permission denied for table mfa_backup_codes/i,
        );

        // Unauthenticated INSERT attempt fails closed
        await expect(
          client.query(
            `INSERT INTO app.users (id, org_id, email, name, role, status)
           VALUES (gen_random_uuid(), $1, 'unauth@leak.test', 'Unauth', 'candidate', 'active')`,
            [ctx.orgAlphaId],
          ),
        ).rejects.toThrow();

        await client.query('ROLLBACK');
      } finally {
        await client.query('ROLLBACK').catch(() => {});
        client.release();
      }
    });

    // 15. Cross-Tenant Write Isolation (WITH CHECK) (BR-01)
    it('15. Cross-tenant INSERT and UPDATE fail WITH CHECK; UPDATE and DELETE on another tenant affect 0 rows', async () => {
      const client = await appPool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT set_config('app.org_id', $1, true)", [ctx.orgAlphaId]);

        // 1. Cross-tenant INSERT: As Org Alpha, attempting to insert a user with Org Beta's org_id
        await client.query('SAVEPOINT sp_insert');
        await expect(
          client.query(
            `INSERT INTO app.users (id, org_id, email, name, role, status)
           VALUES (gen_random_uuid(), $1, 'forged-user@beta.test', 'Forged User', 'candidate', 'active')`,
            [ctx.orgBetaId],
          ),
        ).rejects.toThrow();
        await client.query('ROLLBACK TO SAVEPOINT sp_insert');

        // 2. Cross-tenant UPDATE: As Org Alpha, attempting to reassign own user to Org Beta
        await client.query('SAVEPOINT sp_update');
        await expect(
          client.query('UPDATE app.users SET org_id = $1 WHERE id = $2', [
            ctx.orgBetaId,
            ctx.userAlphaId,
          ]),
        ).rejects.toThrow();
        await client.query('ROLLBACK TO SAVEPOINT sp_update');

        // 3. Blind UPDATE on Org Beta user affects 0 rows
        const blindUpdate = await client.query(
          "UPDATE app.users SET name = 'Attacked' WHERE id = $1",
          [ctx.userBetaId],
        );
        expect(blindUpdate.rowCount).toBe(0);

        // 4. Blind DELETE on Org Beta user affects 0 rows
        const blindDelete = await client.query('DELETE FROM app.users WHERE id = $1', [
          ctx.userBetaId,
        ]);
        expect(blindDelete.rowCount).toBe(0);

        await client.query('ROLLBACK');
      } finally {
        await client.query('ROLLBACK').catch(() => {});
        client.release();
      }
    });

    // 16. Connection Pool Leakage Prevention (Single Connection Re-use) (BR-01)
    it('16. Reused pooled connection does not leak tenant context across consecutive transactions', async () => {
      const singleConnPool = new pg.Pool({
        connectionString: DATABASE_URL,
        max: 1,
        idleTimeoutMillis: 10_000,
      });

      const client = await singleConnPool.connect();
      try {
        // Transaction 1: Execute as Org Alpha
        await client.query('BEGIN');
        await client.query("SELECT set_config('app.org_id', $1, true)", [ctx.orgAlphaId]);
        const tx1Check = await client.query('SELECT app.current_org_id() AS org');
        expect(tx1Check.rows[0].org).toBe(ctx.orgAlphaId);
        const tx1Users = await client.query('SELECT id FROM app.users');
        expect(tx1Users.rows.length).toBeGreaterThanOrEqual(1);
        await client.query('COMMIT');

        // Assert: Outside transaction on the same connection, app.org_id is reset to NULL
        const postCommitCheck = await client.query('SELECT app.current_org_id() AS org');
        expect(postCommitCheck.rows[0].org).toBeNull();

        // Transaction 2: Execute as Org Beta on the SAME physical connection
        await client.query('BEGIN');
        await client.query("SELECT set_config('app.org_id', $1, true)", [ctx.orgBetaId]);
        const tx2Check = await client.query('SELECT app.current_org_id() AS org');
        expect(tx2Check.rows[0].org).toBe(ctx.orgBetaId);

        // Verify Org Alpha is completely invisible
        const tx2AlphaQuery = await client.query('SELECT * FROM app.users WHERE id = $1', [
          ctx.userAlphaId,
        ]);
        expect(tx2AlphaQuery.rows).toHaveLength(0);

        // Verify Org Beta is visible
        const tx2BetaQuery = await client.query('SELECT * FROM app.users WHERE id = $1', [
          ctx.userBetaId,
        ]);
        expect(tx2BetaQuery.rows).toHaveLength(1);
        await client.query('ROLLBACK');

        // Assert: After rollback on the same connection, app.org_id is reset to NULL
        const postRollbackCheck = await client.query('SELECT app.current_org_id() AS org');
        expect(postRollbackCheck.rows[0].org).toBeNull();
      } finally {
        client.release();
        await singleConnPool.end();
      }
    });

    // 17. MFA Backup Codes Privilege Revocation & Password History Tenant Scoping (BR-01, Task 4.1 Gap Fix)
    it('17. app.mfa_backup_codes rejects direct access under hs_app and app.password_history is strictly isolated', async () => {
      const client = await appPool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT set_config('app.org_id', $1, true)", [ctx.orgAlphaId]);

        // Direct query to password_history returns only Org Alpha user history
        const pwdRes = await client.query('SELECT id, user_id FROM app.password_history');
        expect(pwdRes.rows.length).toBeGreaterThanOrEqual(1);
        expect(pwdRes.rows.every((r) => r.user_id === ctx.userAlphaId)).toBe(true);

        const crossPwd = await client.query('SELECT * FROM app.password_history WHERE id = $1', [
          ctx.pwdBetaId,
        ]);
        expect(crossPwd.rows).toHaveLength(0);

        await client.query('ROLLBACK');

        // Direct query to mfa_backup_codes as hs_app is rejected with privilege error (least privilege)
        await expect(client.query('SELECT id, user_id FROM app.mfa_backup_codes')).rejects.toThrow(
          /permission denied for table mfa_backup_codes/i,
        );

        // Cross-tenant direct query by ID is also rejected with privilege error
        await expect(
          client.query('SELECT * FROM app.mfa_backup_codes WHERE id = $1', [ctx.codeBetaId]),
        ).rejects.toThrow(/permission denied for table mfa_backup_codes/i);
      } finally {
        await client.query('ROLLBACK').catch(() => {});
        client.release();
      }
    });

    // 18. MFA Backup Code SECURITY DEFINER Functions Pre-Login Isolation (Task 4)
    it('18. MFA backup-code SECURITY DEFINER functions execute pre-login without tenant context and enforce isolation', async () => {
      const client = await appPool.connect();
      try {
        // 1. hs_app calls functions without tenant context (pre-login state)
        const testHash = 'test_hash_prelogin_' + crypto.randomBytes(4).toString('hex');
        const insertRes = await client.query(
          'SELECT app.insert_mfa_backup_code_hash($1, $2) AS code_id',
          [ctx.userAlphaId, testHash],
        );
        expect(insertRes.rows[0].code_id).toBeDefined();

        // 2. Count unused backup codes pre-login
        const countBefore = await client.query(
          'SELECT app.count_unused_mfa_backup_codes($1) AS count',
          [ctx.userAlphaId],
        );
        expect(countBefore.rows[0].count).toBeGreaterThanOrEqual(1);

        // 3. User Beta cannot consume User Alpha\'s code
        const crossConsume = await client.query(
          'SELECT app.consume_mfa_backup_code($1, $2) AS consumed',
          [ctx.userBetaId, testHash],
        );
        expect(crossConsume.rows[0].consumed).toBe(false);

        // 4. User Alpha consumes own code pre-login
        const consumeRes = await client.query(
          'SELECT app.consume_mfa_backup_code($1, $2) AS consumed',
          [ctx.userAlphaId, testHash],
        );
        expect(consumeRes.rows[0].consumed).toBe(true);

        // 5. Consuming again fails (single-use)
        const consumeAgain = await client.query(
          'SELECT app.consume_mfa_backup_code($1, $2) AS consumed',
          [ctx.userAlphaId, testHash],
        );
        expect(consumeAgain.rows[0].consumed).toBe(false);

        // 6. Count unused backup codes decreased
        const countAfter = await client.query(
          'SELECT app.count_unused_mfa_backup_codes($1) AS count',
          [ctx.userAlphaId],
        );
        expect(countAfter.rows[0].count).toBe(countBefore.rows[0].count - 1);
      } finally {
        client.release();
      }
    });

    // 19. Audit Insert Policy Behavior (Task 5, Edge Case on audit_insert_policy)
    it('19. audit_insert_policy allows cross-org INSERTs with WITH CHECK (true), but SELECT strictly enforces tenant scoping', async () => {
      const client = await appPool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT set_config('app.org_id', $1, true)", [ctx.orgAlphaId]);

        // Cross-tenant audit insertion succeeds because audit_insert_policy is WITH CHECK (true)
        // Note: Must NOT use RETURNING because RETURNING requires SELECT permission under RLS.
        const uniqueAction = 'external.webhook.' + crypto.randomBytes(4).toString('hex');
        const dummyHash = crypto.createHash('sha256').update(uniqueAction).digest();
        await client.query(
          `INSERT INTO audit.events (org_id, actor_id, actor_role, action, entity, entity_id, ip, hash)
         VALUES ($1, $2, 'system', $3, 'org', $4, '127.0.0.1', $5)`,
          [ctx.orgBetaId, ctx.userAlphaId, uniqueAction, ctx.orgBetaId, dummyHash],
        );

        // However, Org Alpha CANNOT read the inserted event back
        const readBack = await client.query('SELECT * FROM audit.events WHERE action = $1', [
          uniqueAction,
        ]);
        expect(readBack.rows).toHaveLength(0);

        // In the same transaction, switch context to Org Beta: now the event IS visible!
        await client.query("SELECT set_config('app.org_id', $1, true)", [ctx.orgBetaId]);
        const readBackBeta = await client.query('SELECT * FROM audit.events WHERE action = $1', [
          uniqueAction,
        ]);
        expect(readBackBeta.rows).toHaveLength(1);
        expect(readBackBeta.rows[0].org_id).toBe(ctx.orgBetaId);

        await client.query('ROLLBACK');
      } finally {
        await client.query('ROLLBACK').catch(() => {});
        client.release();
      }
    });

    // 20. Platform Bypass Dual-Factor Enforcement (Task 7)
    it('20. Platform Admin RLS bypass requires dual-factor (role hs_platform AND app.is_platform = true)', async () => {
      // Factor 1: hs_platform role
      const platformClient = await platformPool.connect();
      try {
        // 1. hs_platform without app.is_platform = 'true' fails closed across orgs
        await platformClient.query('BEGIN');
        await platformClient.query("SELECT set_config('app.is_platform', 'false', true)");
        const noFlagQuery = await platformClient.query(
          'SELECT id FROM app.users WHERE org_id IN ($1, $2)',
          [ctx.orgAlphaId, ctx.orgBetaId],
        );
        expect(noFlagQuery.rows).toHaveLength(0);
        await platformClient.query('ROLLBACK');

        // 2. hs_platform with app.is_platform = 'true' succeeds across all orgs
        await platformClient.query('BEGIN');
        await platformClient.query("SELECT set_config('app.is_platform', 'true', true)");
        const flagQuery = await platformClient.query(
          'SELECT id FROM app.users WHERE org_id IN ($1, $2)',
          [ctx.orgAlphaId, ctx.orgBetaId],
        );
        expect(flagQuery.rows).toHaveLength(2);
        await platformClient.query('ROLLBACK');
      } finally {
        await platformClient.query('ROLLBACK').catch(() => {});
        platformClient.release();
      }

      // Factor 2: hs_app role attempting bypass
      const appClient = await appPool.connect();
      try {
        await appClient.query('BEGIN');
        // Even if an attacker on hs_app sets app.is_platform = 'true', is_platform() checks SESSION_USER
        await appClient.query("SELECT set_config('app.is_platform', 'true', true)");
        const attackQuery = await appClient.query(
          'SELECT id FROM app.users WHERE org_id IN ($1, $2)',
          [ctx.orgAlphaId, ctx.orgBetaId],
        );
        expect(attackQuery.rows).toHaveLength(0);
        await appClient.query('ROLLBACK');
      } finally {
        await appClient.query('ROLLBACK').catch(() => {});
        appClient.release();
      }
    });
  });
