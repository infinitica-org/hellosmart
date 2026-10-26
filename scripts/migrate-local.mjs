import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from '../apps/api/node_modules/pg/lib/index.js';

const SAMPLE_TOKEN = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

async function setup() {
  const adminPool = new pg.Pool({
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    database: 'postgres',
  });

  console.log('Recreating database hellosmart...');
  await adminPool.query('DROP DATABASE IF EXISTS hellosmart');
  await adminPool.query('CREATE DATABASE hellosmart');

  const hellosmartAdminPool = new pg.Pool({
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    database: 'hellosmart',
  });

  const rolesSql = fs.readFileSync(path.resolve('packages/contracts/db/init/001_roles.sql'), 'utf8')
    .replace(/CREATE ROLE [^;]+;/g, '');
  await hellosmartAdminPool.query(rolesSql);
  console.log('Roles and schemas initialized.');

  const migratorPool = new pg.Pool({
    host: '127.0.0.1',
    port: 5432,
    user: 'hs_migrator',
    password: 'hs_migrator_local',
    database: 'hellosmart',
  });

  const migrations = [
    'packages/contracts/db/migrations/0001_tenancy_foundation.sql',
    'packages/contracts/db/migrations/0002_invitations.sql',
    'packages/contracts/db/migrations/0003_auth_sessions.sql',
  ];

  for (const m of migrations) {
    console.log(`Applying ${m}...`);
    const sql = fs.readFileSync(path.resolve(m), 'utf8');
    await migratorPool.query(sql);
    console.log(`  ✓ ${m} applied.`);
  }

  // Seed sample data
  console.log('Seeding sample data...');
  const orgId = '11111111-1111-1111-1111-111111111111';
  const adminId = '00000000-0000-0000-0000-000000000001';
  const candidateId = '22222222-2222-2222-2222-222222222222';
  const invitationId = '33333333-3333-3333-3333-333333333333';

  const client = await hellosmartAdminPool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.is_platform', 'true', true)");

    await client.query(`
      INSERT INTO app.organizations (id, name, slug, status, created_by)
      VALUES ($1, 'Acme Corporation', 'acme-corp', 'paid_active', $2)
    `, [orgId, adminId]);

    await client.query(`
      INSERT INTO app.entitlements (org_id, max_templates, max_candidates)
      VALUES ($1, 10, 100)
    `, [orgId]);

    await client.query(`
      INSERT INTO app.users (id, org_id, email, name, role, status, must_reset_password)
      VALUES ($1, $2, 'jane.doe@example.com', 'Jane Doe', 'candidate', 'invited', true)
    `, [candidateId, orgId]);

    const tokenBytes = Buffer.from(SAMPLE_TOKEN, 'hex');
    const tokenHash = crypto.createHash('sha256').update(tokenBytes).digest();

    await client.query(`
      INSERT INTO app.invitations (id, org_id, user_id, email, role, token_hash, created_at, expires_at, used_at)
      VALUES ($1, $2, $3, 'jane.doe@example.com', 'candidate', $4, now(), now() + interval '71 hours', NULL)
    `, [invitationId, orgId, candidateId, tokenHash]);

    await client.query('COMMIT');
    console.log('✓ Seed completed successfully!');
  } finally {
    client.release();
  }

  // Quick verify query as hs_app
  const appPool = new pg.Pool({
    host: '127.0.0.1',
    port: 5432,
    user: 'hs_app',
    password: 'hs_app_local',
    database: 'hellosmart',
  });

  const tokenBytes = Buffer.from(SAMPLE_TOKEN, 'hex');
  const tokenHash = crypto.createHash('sha256').update(tokenBytes).digest();
  const testRes = await appPool.query('SELECT * FROM app.lookup_invitation($1::bytea)', [tokenHash]);
  console.log('Verified lookup_invitation result:', testRes.rows);

  await appPool.end();
  await migratorPool.end();
  await hellosmartAdminPool.end();
  await adminPool.end();
}

setup().catch(console.error);

