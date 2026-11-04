import { hash } from '@node-rs/argon2';
import pg from 'pg';
import { FIXTURE } from './constants.js';
import { withPlatform } from './db.js';

const DEFAULT_DATABASE_URL =
  'postgresql://hs_app:hs_app_local@127.0.0.1:5432/hellosmart';

export interface SeedGuardOptions {
  nodeEnv?: string | undefined;
  appEnv?: string | undefined;
  allowNonProductionSeed?: string | boolean | undefined;
}

/**
 * Pre-flight safety assertion for database fixture seeding.
 * Strictly guarantees:
 * 1. Execution is unconditionally blocked when NODE_ENV=production or APP_ENV=production (even if opt-in is provided).
 * 2. Execution is blocked if explicit opt-in ALLOW_NON_PRODUCTION_SEED=true is absent.
 * 3. Throws a fatal Error BEFORE any database connection, pool creation, or mutation can occur.
 */
export function assertSeedSafety(options?: SeedGuardOptions): void {
  const nodeEnv = (options?.nodeEnv ?? process.env.NODE_ENV ?? '').trim().toLowerCase();
  const appEnv = (options?.appEnv ?? process.env.APP_ENV ?? '').trim().toLowerCase();
  const allowOptIn = options?.allowNonProductionSeed ?? process.env.ALLOW_NON_PRODUCTION_SEED;

  // 1. Refuse unconditionally in production (even with opt-in)
  if (
    nodeEnv === 'production' ||
    nodeEnv === 'prod' ||
    appEnv === 'production' ||
    appEnv === 'prod'
  ) {
    throw new Error(
      'SECURITY FATAL: Database fixture seeding is strictly forbidden in production environments (NODE_ENV/APP_ENV=production). Execution blocked.',
    );
  }

  // 2. Require explicit opt-in in non-production environments
  const isOptedIn =
    allowOptIn === true ||
    (typeof allowOptIn === 'string' && allowOptIn.trim().toLowerCase() === 'true');

  if (!isOptedIn) {
    throw new Error(
      'SECURITY FATAL: Database fixture seeding requires explicit opt-in via ALLOW_NON_PRODUCTION_SEED=true. Execution blocked.',
    );
  }
}

export async function runFixtureSeed(
  options?: SeedGuardOptions & {
    databaseUrl?: string;
    poolFactory?: (url: string) => pg.Pool;
  },
): Promise<void> {
  // CRITICAL: Guard executes BEFORE any database connection, pool instantiation, or mutation
  assertSeedSafety(options);

  const databaseUrl = options?.databaseUrl ?? process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
  const pool = options?.poolFactory
    ? options.poolFactory(databaseUrl)
    : new pg.Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  const devPasswordHash = await hash('ChangeMe-Dev-Only-1', {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  try {
    await withPlatform(client, async (tx) => {
      await tx.query(
        `INSERT INTO app.users (id, org_id, email, email_verified_at, name, role, password_hash, mfa_secret_ref, status)
         VALUES ($1, NULL, $2, now(), $3, 'platform_admin', $4, $5, 'active')
         ON CONFLICT (id) DO UPDATE SET mfa_secret_ref = EXCLUDED.mfa_secret_ref`,
        [
          FIXTURE.platformAdmin.id,
          FIXTURE.platformAdmin.email,
          FIXTURE.platformAdmin.name,
          devPasswordHash,
          'env:PLATFORM_ADMIN_MFA_SECRET',
        ],
      );

      for (const org of [FIXTURE.asterRidge, FIXTURE.brindle]) {
        await tx.query(
          `INSERT INTO app.organizations (id, name, slug, status, created_by)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             slug = EXCLUDED.slug,
             status = EXCLUDED.status`,
          [org.id, org.name, org.slug, org.entitlements.status, FIXTURE.platformAdmin.id],
        );

        const trialEnds =
          org.entitlements.status === 'trial_active'
            ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
            : null;

        await tx.query(
          `INSERT INTO app.entitlements (org_id, max_templates, max_candidates, trial_ends_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (org_id) DO UPDATE SET
             max_templates = EXCLUDED.max_templates,
             max_candidates = EXCLUDED.max_candidates,
             trial_ends_at = EXCLUDED.trial_ends_at`,
          [org.id, org.entitlements.maxTemplates, org.entitlements.maxCandidates, trialEnds],
        );

        await tx.query(
          `INSERT INTO app.users (id, org_id, email, email_verified_at, name, role, password_hash, status)
           VALUES ($1, $2, $3, now(), $4, 'company_admin', $5, 'active')
           ON CONFLICT (id) DO NOTHING`,
          [org.admin.id, org.id, org.admin.email, org.admin.name, devPasswordHash],
        );
      }

      // Activate sample pricing catalog items strictly for local development and testing
      await tx.query(
        `UPDATE app.pricing_catalog
         SET is_active = true
         WHERE code IN (
           'plan_starter_monthly',
           'plan_growth_monthly',
           'plan_enterprise_monthly_usd',
           'template_custom_build',
           'template_custom_build_usd',
           'addon_extra_candidate_pack',
           'addon_whitelabel'
         )`,
      );
    });

    console.log('Seed complete: platform admin + Aster Ridge (paid) + Brindle & Co (trial) + dev catalog activated.');
  } finally {
    client.release();
    await pool.end();
  }
}

async function main(): Promise<void> {
  await runFixtureSeed();
}

// Only execute when invoked directly as a script
if (process.argv[1] && (process.argv[1].endsWith('seed.js') || process.argv[1].endsWith('seed.ts'))) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
