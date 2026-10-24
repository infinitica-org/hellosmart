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

export interface SeedSummary {
  organizationsUpserted: number;
  entitlementsUpserted: number;
  platformAdminsUpserted: number;
  companyAdminsUpserted: number;
  candidatesUpserted: number;
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
 * Upserts an organization record using ON CONFLICT (id) DO UPDATE.
 * Does NOT overwrite created_at; updates updated_at.
 */
export async function upsertOrganization(
  client: ClientBase,
  org: OrganizationEntity,
): Promise<void> {
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
 */
export async function upsertUser(client: ClientBase, user: UserEntity): Promise<void> {
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
 * Executes the entire database seed in a single, safe transaction.
 *
 * Foreign-key dependency order:
 * 1. Platform Admin (app.users with org_id = null; required because organizations.created_by references user.id)
 * 2. Organizations (app.organizations; references platform admin)
 * 3. Entitlements (app.entitlements; references organization)
 * 4. Company Admins (app.users with org_id set)
 * 5. Candidates (app.users with org_id set)
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

  // Load datasets from 6.1 entities
  const platformAdmins = getPlatformAdmins(refDate);
  const organizations = getOrganizations(refDate, platformAdmins[0]!.id);
  const companyAdmins = getCompanyAdmins(refDate);
  const candidates = getCandidates(refDate);

  let orgsCount = 0;
  let entsCount = 0;
  let platAdminsCount = 0;
  let compAdminsCount = 0;
  let candsCount = 0;

  // 2. Execute within an atomic transaction
  await client.query('BEGIN;');

  try {
    // Set RLS platform bypass context for transaction
    await client.query('SET search_path TO app, public;');
    await client.query("SELECT set_config('app.is_platform', 'true', true);");

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
    totalRecordsUpserted: orgsCount + entsCount + platAdminsCount + compAdminsCount + candsCount,
  };

  log(`Seed completed successfully: ${summary.totalRecordsUpserted} total records processed.`);
  return summary;
}
