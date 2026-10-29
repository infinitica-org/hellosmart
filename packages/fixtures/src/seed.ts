import { hash } from '@node-rs/argon2';
import pg from 'pg';
import { FIXTURE } from './constants.js';
import { withPlatform } from './db.js';

const DEFAULT_DATABASE_URL =
  'postgresql://hs_app:hs_app_local@127.0.0.1:5432/hellosmart';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
  const pool = new pg.Pool({ connectionString: databaseUrl });
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
    });

    console.log('Seed complete: platform admin + Aster Ridge (paid) + Brindle & Co (trial).');
  } finally {
    client.release();
    await pool.end();
  }
}

void main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
