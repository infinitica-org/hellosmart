import { loadConfig } from './config.ts';
import { assertEnvironmentSafe } from './lib/guard.ts';
import { createDbClient, withPlatformTx } from './lib/db.ts';
import { hashPassword } from './lib/hasher.ts';
import { RunReporter } from './lib/reporter.ts';
import { upsertRecord } from './lib/upsert.ts';
import { getPlatformAdmins } from './fixtures/platform-admins.ts';
import { getOrganizations } from './fixtures/organizations.ts';
import { getCompanyUsers } from './fixtures/company-users.ts';
import { getCandidates } from './fixtures/candidates.ts';

import type { SeedConfig } from './config.ts';

export async function runSeed(
  customConfig?: Partial<SeedConfig>,
): Promise<{ reporter: RunReporter }> {
  const baseConfig = loadConfig();
  const config: SeedConfig = { ...baseConfig, ...customConfig };
  const reporter = new RunReporter();

  // 1. Environment & safety guard
  const target = assertEnvironmentSafe(config);
  const log = config.logger || console.log;
  log(`\nStarting HelloSmart seed loader...`);
  log(`Environment: ${config.nodeEnv}`);
  log(`Target:      ${target.user}@${target.host}:${target.port}/${target.dbName}`);
  if (config.dryRun) {
    log(`Mode:        DRY RUN (no database changes will be committed)`);
  }

  // 2. Database client connection
  const client = await createDbClient(config.databaseUrl);

  try {
    // 3. Hash dev password once (argon2id)
    const passwordHash = await hashPassword(config.defaultPassword);

    // 4. Run seeding inside a platform-scoped transaction (RLS respected)
    await withPlatformTx(client, async (tx) => {
      // Step A: Platform Admins
      const platformAdmins = getPlatformAdmins(config.referenceDate);
      for (const admin of platformAdmins) {
        const outcome = await upsertRecord({
          client: tx,
          table: 'app.users',
          keyFields: { email: admin.email, org_id: null },
          values: {
            id: admin.id,
            email: admin.email,
            org_id: null,
            name: admin.name,
            role: admin.role,
            status: admin.status,
            email_verified_at: admin.email_verified_at,
            must_reset_password: admin.must_reset_password,
            mfa_secret_ref: admin.mfa_secret_ref,
            password_hash: passwordHash,
          },
          dryRun: config.dryRun,
          plainPassword: config.defaultPassword,
        });
        reporter.record('platform_admin', outcome);
      }

      const adminSuperId = platformAdmins.find((a) => a.key === 'admin_super')!.id;

      // Step B: Organizations (created_by = admin_super.id)
      const organizations = getOrganizations(config.referenceDate, adminSuperId);
      for (const org of organizations) {
        const outcome = await upsertRecord({
          client: tx,
          table: 'app.organizations',
          keyFields: { slug: org.slug },
          values: {
            id: org.id,
            name: org.name,
            slug: org.slug,
            status: org.status,
            logo_key: org.logo_key,
            custom_domain: org.custom_domain,
            retention_days: org.retention_days,
            created_by: org.created_by,
          },
          dryRun: config.dryRun,
        });
        reporter.record('organizations', outcome);

        // Step C: Entitlements for each organization
        const entOutcome = await upsertRecord({
          client: tx,
          table: 'app.entitlements',
          keyFields: { org_id: org.id },
          values: org.entitlements,
          dryRun: config.dryRun,
        });
        reporter.record('entitlements', entOutcome);
      }

      const asterOrg = organizations.find((o) => o.key === 'aster')!;
      const brindleOrg = organizations.find((o) => o.key === 'brindle')!;

      // Step D: Company Users (role: company_admin)
      const companyUsers = getCompanyUsers(config.referenceDate, {
        asterId: asterOrg.id,
        brindleId: brindleOrg.id,
      });
      for (const user of companyUsers) {
        const outcome = await upsertRecord({
          client: tx,
          table: 'app.users',
          keyFields: { org_id: user.org_id, email: user.email },
          values: {
            id: user.id,
            org_id: user.org_id,
            email: user.email,
            name: user.name,
            role: user.role,
            status: user.status,
            email_verified_at: user.email_verified_at,
            must_reset_password: user.must_reset_password,
            failed_logins: user.failed_logins,
            locked_until: user.locked_until,
            deleted_at: user.deleted_at,
            password_hash: passwordHash,
          },
          dryRun: config.dryRun,
          plainPassword: config.defaultPassword,
        });
        reporter.record('company_admin', outcome);
      }

      // Step E: Candidates (role: candidate)
      const candidates = getCandidates(config.referenceDate, {
        asterId: asterOrg.id,
        brindleId: brindleOrg.id,
      });
      for (const cand of candidates) {
        const outcome = await upsertRecord({
          client: tx,
          table: 'app.users',
          keyFields: { org_id: cand.org_id, email: cand.email },
          values: {
            id: cand.id,
            org_id: cand.org_id,
            email: cand.email,
            name: cand.name,
            role: cand.role,
            status: cand.status,
            email_verified_at: cand.email_verified_at,
            must_reset_password: cand.must_reset_password,
            failed_logins: cand.failed_logins,
            locked_until: cand.locked_until,
            deleted_at: cand.deleted_at,
            password_hash: passwordHash,
          },
          dryRun: config.dryRun,
          plainPassword: config.defaultPassword,
        });
        reporter.record('candidate', outcome);
      }

      // If dry-run, rollback transaction intentionally
      if (config.dryRun) {
        throw new Error('__DRY_RUN_ROLLBACK__');
      }
    });
  } catch (err: any) {
    if (err.message === '__DRY_RUN_ROLLBACK__') {
      // Dry-run expected rollback, not an error
    } else {
      throw err;
    }
  } finally {
    client.release();
  }

  // 5. Output summary
  reporter.printSummary({
    dryRun: config.dryRun,
    targetDb: `${target.user}@${target.host}:${target.port}/${target.dbName}`,
    logger: log,
  });

  return { reporter };
}

// Auto-run if executed directly as script
const isDirectCli =
  process.argv[1] && (process.argv[1].endsWith('index.ts') || process.argv[1].endsWith('index.js'));

if (isDirectCli) {
  runSeed().catch((err: any) => {
    console.error('\nSeed failed with error:', err.message || err);
    process.exit(1);
  });
}
