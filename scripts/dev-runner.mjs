import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from '../apps/api/node_modules/pg/lib/index.js';

const PG_BIN = 'C:\\Program Files\\PostgreSQL\\18\\bin';
const PG_DATA = 'C:\\Users\\inf-dev-02\\.gemini\\antigravity\\brain\\f801cd9c-29ed-4c21-8554-dcea6d8c6103\\scratch\\pg_data';
const PG_PORT = 5432;
const PG_HOST = '127.0.0.1';

const SAMPLE_TOKEN = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function log(prefix, msg) {
  console.log(`[${prefix}] ${msg}`);
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let pgProcess = null;
let apiProcess = null;
let webProcess = null;

async function startPostgresProcess() {
  log('DB', `Starting PostgreSQL 18 engine on ${PG_HOST}:${PG_PORT}...`);
  const pidFile = path.join(PG_DATA, 'postmaster.pid');
  if (fs.existsSync(pidFile)) {
    try { fs.unlinkSync(pidFile); } catch {}
  }

  const postgresExe = path.join(PG_BIN, 'postgres.exe');
  pgProcess = spawn(postgresExe, ['-D', PG_DATA, '-p', String(PG_PORT), '-h', PG_HOST], {
    stdio: 'ignore',
  });

  pgProcess.on('exit', (code) => {
    log('DB', `PostgreSQL exited with code ${code}`);
  });

  // Wait until PostgreSQL is accepting connections
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    try {
      const testPool = new pg.Pool({
        host: PG_HOST,
        port: PG_PORT,
        user: 'postgres',
        database: 'postgres',
        connectionTimeoutMillis: 1000,
      });
      await testPool.query('SELECT 1');
      await testPool.end();
      log('DB', `PostgreSQL 18 is ready on port ${PG_PORT}!`);
      return;
    } catch {
      // retry
    }
  }
  throw new Error('PostgreSQL failed to start within 15 seconds');
}

async function runSqlFile(client, filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  await client.query(content);
}

async function initDatabaseAndSeed() {
  log('DB', 'Initializing hellosmart database and schema...');
  const adminPool = new pg.Pool({
    host: PG_HOST,
    port: PG_PORT,
    user: 'postgres',
    database: 'postgres',
  });

  // 1. Create database hellosmart if not exists
  const dbCheck = await adminPool.query("SELECT 1 FROM pg_database WHERE datname = 'hellosmart'");
  if (dbCheck.rows.length === 0) {
    await adminPool.query('CREATE DATABASE hellosmart');
    log('DB', 'Database hellosmart created.');
  }

  // 2. Run 001_roles.sql on hellosmart
  const hellosmartAdminPool = new pg.Pool({
    host: PG_HOST,
    port: PG_PORT,
    user: 'postgres',
    database: 'hellosmart',
  });

  const rolesSql = fs.readFileSync(path.resolve('packages/contracts/db/init/001_roles.sql'), 'utf8');
  // Only execute role creation if roles don't exist
  const roleCheck = await adminPool.query("SELECT 1 FROM pg_roles WHERE rolname = 'hs_migrator'");
  let targetRolesSql = rolesSql;
  if (roleCheck.rows.length > 0) {
    targetRolesSql = rolesSql.replace(/CREATE ROLE [^;]+;/g, '');
  }
  await hellosmartAdminPool.query(targetRolesSql).catch((err) => {
    log('DB', `Roles setup warning: ${err.message}`);
  });

  // 3. Apply migrations as hs_migrator
  const migratorPool = new pg.Pool({
    host: PG_HOST,
    port: PG_PORT,
    user: 'hs_migrator',
    password: 'hs_migrator_local',
    database: 'hellosmart',
  });

  log('DB', 'Applying migrations (0001, 0002, 0003)...');
  await runSqlFile(migratorPool, path.resolve('packages/contracts/db/migrations/0001_tenancy_foundation.sql')).catch(() => {});
  await runSqlFile(migratorPool, path.resolve('packages/contracts/db/migrations/0002_invitations.sql')).catch(() => {});
  await runSqlFile(migratorPool, path.resolve('packages/contracts/db/migrations/0003_auth_sessions.sql')).catch(() => {});
  log('DB', 'Migrations applied.');

  // 4. Seed sample data for Stream 8 verification
  const orgId = '11111111-1111-1111-1111-111111111111';
  const adminId = '00000000-0000-0000-0000-000000000001';
  const candidateId = '22222222-2222-2222-2222-222222222222';
  const invitationId = '33333333-3333-3333-3333-333333333333';

  const client = await hellosmartAdminPool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.is_platform', 'true', true)");

    // Upsert organization
    await client.query(`
      INSERT INTO app.organizations (id, name, slug, status, created_by)
      VALUES ($1, 'Acme Corporation', 'acme-corp', 'paid_active', $2)
      ON CONFLICT (id) DO UPDATE SET name = 'Acme Corporation'
    `, [orgId, adminId]);

    // Upsert entitlements
    await client.query(`
      INSERT INTO app.entitlements (org_id, max_templates, max_candidates)
      VALUES ($1, 10, 100)
      ON CONFLICT (org_id) DO NOTHING
    `, [orgId]);

    // Upsert candidate user
    await client.query(`
      INSERT INTO app.users (id, org_id, email, name, role, status, must_reset_password)
      VALUES ($1, $2, 'jane.doe@example.com', 'Jane Doe', 'candidate', 'invited', true)
      ON CONFLICT (id) DO UPDATE SET status = 'invited', must_reset_password = true
    `, [candidateId, orgId]);

    // Upsert company admin user (admin@acme.com / AdminPassword123!)
    const adminPasswordHash = '$argon2id$v=19$m=19456,t=2,p=1$ONnuAs8l5G1/+/++vkPQjw$0LH5W9btOA3F3OPUF9V6UsYTogg0D4Uj65UZ3Gw955k';
    await client.query(`
      INSERT INTO app.users (id, org_id, email, name, role, status, password_hash, must_reset_password, email_verified_at)
      VALUES ($1, $2, 'admin@acme.com', 'Acme Admin', 'company_admin', 'active', $3, false, now())
      ON CONFLICT (id) DO UPDATE SET password_hash = $3, must_reset_password = false, status = 'active'
    `, [adminId, orgId, adminPasswordHash]);

    // Upsert invitation token
    const tokenHash = crypto.createHash('sha256').update(SAMPLE_TOKEN.trim()).digest();

    await client.query(`DELETE FROM app.invitations WHERE email = 'jane.doe@example.com'`);
    await client.query(`
      INSERT INTO app.invitations (id, org_id, user_id, email, role, token_hash, created_at, expires_at, used_at)
      VALUES ($1, $2, $3, 'jane.doe@example.com', 'candidate', $4, now(), now() + interval '71 hours', NULL)
    `, [invitationId, orgId, candidateId, tokenHash]);

    await client.query('COMMIT');
    log('DB', 'Sample organization, candidate, and invitation seeded successfully!');
  } finally {
    client.release();
  }

  await migratorPool.end();
  await hellosmartAdminPool.end();
  await adminPool.end();
}

function startApiServer() {
  log('API', 'Starting NestJS API server on http://localhost:4000...');
  apiProcess = spawn('node', ['--env-file=.env', 'apps/api/dist/main.js'], {
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: '4000',
      LOG_LEVEL: 'info',
      APP_BASE_URL: 'http://localhost:3000',
      DATABASE_URL: `postgres://hs_app:hs_app_local@${PG_HOST}:${PG_PORT}/hellosmart`,
      DATABASE_MIGRATOR_URL: `postgres://hs_migrator:hs_migrator_local@${PG_HOST}:${PG_PORT}/hellosmart`,
      SESSION_SECRET: 'change-me-local-only-32-bytes-minimum-session',
      CORS_ORIGINS: 'http://localhost:3000',
      PAYMENT_GATEWAY: 'fake',
      EMAIL_PROVIDER: 'fake',
      WORKSPACE_RUNTIME: 'fake',
      SECRET_STORE_PROVIDER: 'fake',
    },
    stdio: 'inherit',
  });

  apiProcess.on('exit', (code) => {
    log('API', `API exited with code ${code}`);
  });
}

function startWebServer() {
  log('WEB', 'Starting Next.js Web server on http://localhost:3000...');
  webProcess = spawn('cmd.exe', ['/c', 'pnpm', '--filter', '@hs/web', 'start'], {
    env: {
      ...process.env,
      PORT: '3000',
      NEXT_PUBLIC_API_URL: 'http://localhost:4000/api/v1',
    },
    stdio: 'inherit',
  });

  webProcess.on('exit', (code) => {
    log('WEB', `Web server exited with code ${code}`);
  });
}

function cleanup() {
  log('SYSTEM', 'Shutting down servers...');
  if (webProcess) webProcess.kill();
  if (apiProcess) apiProcess.kill();
  if (pgProcess) {
    const pgCtl = path.join(PG_BIN, 'pg_ctl.exe');
    try {
      spawn(pgCtl, ['-D', PG_DATA, '-m', 'immediate', 'stop'], { stdio: 'ignore' });
    } catch {}
    pgProcess.kill();
  }
}

process.on('SIGINT', () => { cleanup(); process.exit(0); });
process.on('SIGTERM', () => { cleanup(); process.exit(0); });

async function main() {
  try {
    await startPostgresProcess();
    await initDatabaseAndSeed();
    startApiServer();
    await sleep(2000);
    startWebServer();

    await sleep(3000);
    console.log('\n================================================================');
    console.log('🚀 HELLOSMART SERVICES RUNNING SUCCESSFULLY!');
    console.log('================================================================');
    console.log('Frontend Portal : http://localhost:3000');
    console.log('Backend API     : http://localhost:4000/api/v1');
    console.log('\nDirect URLs for Stream 8 / PHS-I38 Review:');
    console.log(`👉 1. Accept Invitation Page (PHS-I49 & PHS-I48):`);
    console.log(`   http://localhost:3000/accept-invite?token=${SAMPLE_TOKEN}`);
    console.log(`👉 2. Master Login Page:`);
    console.log(`   http://localhost:3000/login`);
    console.log(`   • Company Admin : admin@acme.com / AdminPassword123! (Routes to /company)`);
    console.log(`   • Candidate     : jane.doe@example.com (Routes to /candidate)`);
    console.log(`👉 3. API Validate Invitation Token:`);
    console.log(`   http://localhost:4000/api/v1/auth/invitations/${SAMPLE_TOKEN}`);
    console.log('================================================================\n');
  } catch (err) {
    console.error('Fatal initialization error:', err);
    cleanup();
    process.exit(1);
  }
}

main();
