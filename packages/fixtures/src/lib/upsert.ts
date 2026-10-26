import type { ClientBase } from 'pg';
import { assertEnvironmentSafe } from './guard.js';
import { maskSensitiveData } from './masker.js';
import {
  getOrganizations,
  type OrganizationEntity,
  type EntitlementEntity,
} from '../entities/organizations.js';
import {
  getPlatformAdmins,
  getCompanyAdmins,
  getCandidates,
  type UserEntity,
} from '../entities/users.js';
import { getInvitations, type InvitationEntity } from '../entities/invitations.js';

export interface SeedSummary {
  organizationsUpserted: number;
  entitlementsUpserted: number;
  platformAdminsUpserted: number;
  companyAdminsUpserted: number;
  candidatesUpserted: number;
  invitationsUpserted: number;
  totalRecordsUpserted: number;
}

export interface SeedOptions {
  referenceDate?: Date;
  logger?: (msg: string) => void;
  nodeEnv?: string;
  databaseUrl?: string;
  skipSafetyCheck?: boolean; // Only for unit test harness with mock clients
}

/**
 * Ensures the app.invitations table exists with strict tenant isolation,
 * indexes, and foreign keys matching HelloSmart specifications.
 * Uses an advisory transaction lock to avoid concurrent DDL race conditions.
 */
export async function ensureInvitationsTable(client: ClientBase): Promise<void> {
  const check = await client.query(`
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'app' AND table_name = 'invitations'
  `);
  if (check.rowCount && check.rowCount > 0) {
    return;
  }

  const ddl = `
    SELECT pg_advisory_xact_lock(hashtext('app.invitations'));
    CREATE TABLE IF NOT EXISTS app.invitations (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id      uuid NOT NULL REFERENCES app.organizations(id),
      user_id     uuid NOT NULL REFERENCES app.users(id),
      token_hash  text NOT NULL UNIQUE,
      invited_by  uuid REFERENCES app.users(id),
      expires_at  timestamptz NOT NULL,
      used_at     timestamptz,
      created_at  timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS invitations_org_idx ON app.invitations (org_id);
    CREATE INDEX IF NOT EXISTS invitations_user_idx ON app.invitations (user_id);
    ALTER TABLE app.invitations ENABLE ROW LEVEL SECURITY;
    ALTER TABLE app.invitations FORCE ROW LEVEL SECURITY;
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'app' AND tablename = 'invitations' AND policyname = 'tenant_isolation'
      ) THEN
        CREATE POLICY tenant_isolation ON app.invitations
          USING (org_id = app.current_org_id() OR app.is_platform())
          WITH CHECK (org_id = app.current_org_id() OR app.is_platform());
      END IF;
    END $$;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE app.invitations TO hs_app;
    GRANT SELECT ON TABLE app.invitations TO hs_readonly;
  `;
  await client.query(ddl);
}

/**
 * Upserts an organization record using ON CONFLICT (id) DO UPDATE.
 * Does NOT overwrite created_at; updates updated_at.
 * If an organization with the same slug exists under an outdated ID,
 * its stale hierarchy is cleaned up so deterministic UUIDs are preserved.
 */
export async function upsertOrganization(
  client: ClientBase,
  org: OrganizationEntity,
): Promise<void> {
  const existingBySlug = await client.query('SELECT id FROM app.organizations WHERE slug = $1', [
    org.slug,
  ]);
  if (existingBySlug.rows.length > 0 && existingBySlug.rows[0].id !== org.id) {
    const staleId = existingBySlug.rows[0].id;
    await client.query('DELETE FROM app.invitations WHERE org_id = $1', [staleId]);
    await client.query('DELETE FROM app.users WHERE org_id = $1', [staleId]);
    await client.query('DELETE FROM app.entitlements WHERE org_id = $1', [staleId]);
    await client.query('DELETE FROM app.organizations WHERE id = $1', [staleId]);
  }

  const query = `
    INSERT INTO app.organizations (
      id, name, slug, status, logo_key, custom_domain, retention_days, created_by, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, now()
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      slug = EXCLUDED.slug,
      status = EXCLUDED.status,
      logo_key = EXCLUDED.logo_key,
      custom_domain = EXCLUDED.custom_domain,
      retention_days = EXCLUDED.retention_days,
      updated_at = now();
  `;

  await client.query(query, [
    org.id,
    org.name,
    org.slug,
    org.status,
    org.logo_key,
    org.custom_domain,
    org.retention_days,
    org.created_by,
  ]);
}

/**
 * Upserts an entitlement record using ON CONFLICT (org_id) DO UPDATE.
 * Updates updated_at on conflict.
 */
export async function upsertEntitlement(client: ClientBase, ent: EntitlementEntity): Promise<void> {
  const query = `
    INSERT INTO app.entitlements (
      org_id, max_templates, max_candidates, trial_ends_at, pending_invite_multiplier, flags, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, now()
    )
    ON CONFLICT (org_id) DO UPDATE SET
      max_templates = EXCLUDED.max_templates,
      max_candidates = EXCLUDED.max_candidates,
      trial_ends_at = EXCLUDED.trial_ends_at,
      pending_invite_multiplier = EXCLUDED.pending_invite_multiplier,
      flags = EXCLUDED.flags,
      updated_at = now();
  `;

  await client.query(query, [
    ent.org_id,
    ent.max_templates,
    ent.max_candidates,
    ent.trial_ends_at,
    ent.pending_invite_multiplier,
    JSON.stringify(ent.flags),
  ]);
}

/**
 * Upserts a user record using ON CONFLICT (id) DO UPDATE.
 * Does NOT overwrite created_at; schema has no updated_at column on app.users.
 * If a user with the same email exists under an outdated ID in the same tenant,
 * the stale record is cleaned up so deterministic UUIDs are preserved.
 */
export async function upsertUser(client: ClientBase, user: UserEntity): Promise<void> {
  const existingUser = await client.query(
    user.org_id
      ? 'SELECT id FROM app.users WHERE org_id = $1 AND email = $2'
      : 'SELECT id FROM app.users WHERE org_id IS NULL AND email = $1',
    user.org_id ? [user.org_id, user.email] : [user.email],
  );
  if (existingUser.rows.length > 0 && existingUser.rows[0].id !== user.id) {
    const staleUserId = existingUser.rows[0].id;
    await client.query('DELETE FROM app.invitations WHERE user_id = $1', [staleUserId]);
    await client.query('DELETE FROM app.users WHERE id = $1', [staleUserId]);
  }

  const query = `
    INSERT INTO app.users (
      id, org_id, email, name, role, status, email_verified_at,
      must_reset_password, mfa_secret_ref, password_hash, failed_logins,
      locked_until, last_login_at, deleted_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
    )
    ON CONFLICT (id) DO UPDATE SET
      org_id = EXCLUDED.org_id,
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      role = EXCLUDED.role,
      status = EXCLUDED.status,
      email_verified_at = EXCLUDED.email_verified_at,
      must_reset_password = EXCLUDED.must_reset_password,
      mfa_secret_ref = EXCLUDED.mfa_secret_ref,
      password_hash = EXCLUDED.password_hash,
      failed_logins = EXCLUDED.failed_logins,
      locked_until = EXCLUDED.locked_until,
      last_login_at = EXCLUDED.last_login_at,
      deleted_at = EXCLUDED.deleted_at;
  `;

  await client.query(query, [
    user.id,
    user.org_id,
    user.email,
    user.name,
    user.role,
    user.status,
    user.email_verified_at,
    user.must_reset_password,
    user.mfa_secret_ref,
    user.password_hash,
    user.failed_logins,
    user.locked_until,
    user.last_login_at,
    user.deleted_at,
  ]);
}

/**
 * Upserts an invitation record using ON CONFLICT (id) DO UPDATE.
 * Preserves used_at if already set in the database (idempotency requirement).
 * If an invitation with the same token_hash exists under an outdated ID,
 * the stale record is cleaned up.
 */
export async function upsertInvitation(
  client: ClientBase,
  invitation: InvitationEntity,
): Promise<void> {
  const existingInv = await client.query('SELECT id FROM app.invitations WHERE token_hash = $1', [
    invitation.token_hash,
  ]);
  if (existingInv.rows.length > 0 && existingInv.rows[0].id !== invitation.id) {
    await client.query('DELETE FROM app.invitations WHERE id = $1', [existingInv.rows[0].id]);
  }

  const query = `
    INSERT INTO app.invitations (
      id, org_id, user_id, token_hash, invited_by, expires_at, used_at, created_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8
    )
    ON CONFLICT (id) DO UPDATE SET
      org_id = EXCLUDED.org_id,
      user_id = EXCLUDED.user_id,
      token_hash = EXCLUDED.token_hash,
      invited_by = EXCLUDED.invited_by,
      expires_at = EXCLUDED.expires_at,
      used_at = COALESCE(app.invitations.used_at, EXCLUDED.used_at);
  `;

  await client.query(query, [
    invitation.id,
    invitation.org_id,
    invitation.user_id,
    invitation.token_hash,
    invitation.invited_by,
    invitation.expires_at,
    invitation.used_at,
    invitation.created_at,
  ]);
}

/**
 * Executes the entire database seed in a single, safe transaction.
 *
 * Foreign-key dependency order:
 * 1. Platform Admin (app.users with org_id = null; required because organizations.created_by references user.id)
 * 2. Organizations (app.organizations; references platform admin)
 * 3. Entitlements (app.entitlements; references organization)
 * 4. Company Admins (app.users with org_id set)
 * 5. Candidates (app.users with org_id set)
 * 6. Invitations (app.invitations; references organization and users)
 *
 * Rolls back atomically on any failure so no partial data is written.
 */
export async function runSafeSeed(
  client: ClientBase,
  options: SeedOptions = {},
): Promise<SeedSummary> {
  const log = (msg: string) => {
    const sanitized = maskSensitiveData(msg);
    if (options.logger) {
      options.logger(sanitized);
    } else {
      console.log(sanitized);
    }
  };

  // 1. Safety Guard Check FIRST before any write
  if (!options.skipSafetyCheck) {
    const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;
    const dbUrl = options.databaseUrl ?? process.env.DATABASE_URL;
    assertEnvironmentSafe(nodeEnv, dbUrl);
  }

  const refDate = options.referenceDate ?? new Date('2026-10-23T00:00:00Z');

  // Load datasets from 6.1 & 6.3 entities
  const platformAdmins = getPlatformAdmins(refDate);
  const organizations = getOrganizations(refDate, platformAdmins[0]!.id);
  const companyAdmins = getCompanyAdmins(refDate);
  const candidates = getCandidates(refDate);
  const invitations = getInvitations(refDate);

  let orgsCount = 0;
  let entsCount = 0;
  let platAdminsCount = 0;
  let compAdminsCount = 0;
  let candsCount = 0;
  let invsCount = 0;

  // 2. Execute within an atomic transaction
  await client.query('BEGIN;');

  try {
    // Set RLS platform bypass context for transaction
    await client.query('SET search_path TO app, public;');
    await client.query("SELECT set_config('app.is_platform', 'true', true);");

    // Ensure table structure exists before inserting
    await ensureInvitationsTable(client);

    // Step A: Platform Admin
    for (const admin of platformAdmins) {
      await upsertUser(client, admin);
      platAdminsCount++;
    }
    log(`Upserted ${platAdminsCount} platform admin(s) (superadmin@hellosmart.ai)`);

    // Step B: Organizations
    for (const org of organizations) {
      await upsertOrganization(client, org);
      orgsCount++;

      // Step C: Entitlements for Organization
      await upsertEntitlement(client, org.entitlements);
      entsCount++;
    }
    log(`Upserted ${orgsCount} organization(s) and ${entsCount} entitlement record(s)`);

    // Step D: Company Admins
    for (const admin of companyAdmins) {
      await upsertUser(client, admin);
      compAdminsCount++;
    }
    log(`Upserted ${compAdminsCount} company admin(s)`);

    // Step E: Candidates
    for (const cand of candidates) {
      await upsertUser(client, cand);
      candsCount++;
    }
    log(`Upserted ${candsCount} candidate(s)`);

    // Step F: Invitations (valid, expired, used)
    for (const inv of invitations) {
      await upsertInvitation(client, inv);
      invsCount++;
    }
    log(`Upserted ${invsCount} candidate invitation token(s) (valid, expired, used)`);

    await client.query('COMMIT;');
  } catch (err) {
    await client.query('ROLLBACK;');
    throw err;
  }

  const summary: SeedSummary = {
    organizationsUpserted: orgsCount,
    entitlementsUpserted: entsCount,
    platformAdminsUpserted: platAdminsCount,
    companyAdminsUpserted: compAdminsCount,
    candidatesUpserted: candsCount,
    invitationsUpserted: invsCount,
    totalRecordsUpserted:
      orgsCount + entsCount + platAdminsCount + compAdminsCount + candsCount + invsCount,
  };

  log(`Seed completed successfully: ${summary.totalRecordsUpserted} total records processed.`);
  return summary;
}
