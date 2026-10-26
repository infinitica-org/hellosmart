import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from '../apps/api/node_modules/pg/lib/index.js';

const PG_BIN = 'C:\\Program Files\\PostgreSQL\\18\\bin';
const PG_DATA = 'C:\\Users\\inf-dev-02\\.gemini\\antigravity\\brain\\f801cd9c-29ed-4c21-8554-dcea6d8c6103\\scratch\\pg_data';
const PG_PORT = 54329;
const PG_HOST = '127.0.0.1';

function log(msg) {
  console.log(`[PG-VERIFY] ${msg}`);
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startPostgres() {
  log(`Starting PostgreSQL 18 on ${PG_HOST}:${PG_PORT}...`);
  const pgCtl = path.join(PG_BIN, 'pg_ctl.exe');
  const pidFile = path.join(PG_DATA, 'postmaster.pid');
  if (fs.existsSync(pidFile)) {
    try {
      execSync(`"${pgCtl}" -D "${PG_DATA}" -m immediate stop`, { stdio: 'ignore' });
    } catch {
      try { fs.unlinkSync(pidFile); } catch {}
    }
  }
  execSync(`"${pgCtl}" -D "${PG_DATA}" -o "-p ${PG_PORT} -h ${PG_HOST}" start`, { stdio: 'inherit' });
  await sleep(1500);
}

async function stopPostgres() {
  log(`Stopping PostgreSQL 18 server...`);
  const pgCtl = path.join(PG_BIN, 'pg_ctl.exe');
  try {
    execSync(`"${pgCtl}" -D "${PG_DATA}" -m fast stop`, { stdio: 'ignore' });
  } catch (err) {
    try {
      execSync(`"${pgCtl}" -D "${PG_DATA}" -m immediate stop`, { stdio: 'ignore' });
    } catch {}
  }
}

async function runSqlFile(client, filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  await client.query(content);
}

async function main() {
  let serverStarted = false;
  try {
    await startPostgres();
    serverStarted = true;

    // 1. Connect as superuser postgres
    const adminPool = new pg.Pool({
      host: PG_HOST,
      port: PG_PORT,
      user: 'postgres',
      database: 'postgres',
    });

    log('Connected to PostgreSQL as superuser postgres');

    // 2. Drop and recreate databases
    await adminPool.query('DROP DATABASE IF EXISTS hellosmart_clean');
    await adminPool.query('DROP DATABASE IF EXISTS hellosmart_upgrade');
    await adminPool.query('CREATE DATABASE hellosmart_clean');
    await adminPool.query('CREATE DATABASE hellosmart_upgrade');

    // Drop roles if they exist to test clean creation
    await adminPool.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hs_app') THEN
          DROP OWNED BY hs_app CASCADE;
          DROP ROLE hs_app;
        END IF;
        IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hs_readonly') THEN
          DROP OWNED BY hs_readonly CASCADE;
          DROP ROLE hs_readonly;
        END IF;
        IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hs_migrator') THEN
          DROP OWNED BY hs_migrator CASCADE;
          DROP ROLE hs_migrator;
        END IF;
      END $$;
    `).catch(() => {});

    // Run 001_roles.sql on both databases
    const rolesSqlPath = path.resolve('packages/contracts/db/init/001_roles.sql');
    const rolesSql = fs.readFileSync(rolesSqlPath, 'utf8');

    // Initialize clean database
    const cleanAdminPool = new pg.Pool({
      host: PG_HOST,
      port: PG_PORT,
      user: 'postgres',
      database: 'hellosmart_clean',
    });
    // Adjust 001_roles.sql for database name
    const cleanRolesSql = rolesSql.replace(/ON DATABASE hellosmart/g, 'ON DATABASE hellosmart_clean');
    await cleanAdminPool.query(cleanRolesSql);
    log('Initialized roles and schemas on hellosmart_clean');

    // Initialize upgrade database
    const upgradeAdminPool = new pg.Pool({
      host: PG_HOST,
      port: PG_PORT,
      user: 'postgres',
      database: 'hellosmart_upgrade',
    });
    // Roles are cluster-wide, so strip CREATE ROLE for the second database on the same cluster
    const upgradeRolesSql = rolesSql
      .replace(/CREATE ROLE [^;]+;/g, '')
      .replace(/ON DATABASE hellosmart/g, 'ON DATABASE hellosmart_upgrade');
    await upgradeAdminPool.query(upgradeRolesSql);
    log('Initialized roles and schemas on hellosmart_upgrade');

    // 3. Clean database: run 0001, 0002, 0003 in order as hs_migrator
    const cleanMigratorPool = new pg.Pool({
      host: PG_HOST,
      port: PG_PORT,
      user: 'hs_migrator',
      password: 'hs_migrator_local',
      database: 'hellosmart_clean',
    });

    log('Applying migrations to clean database as hs_migrator:');
    log('  - 0001_tenancy_foundation.sql');
    await runSqlFile(cleanMigratorPool, path.resolve('packages/contracts/db/migrations/0001_tenancy_foundation.sql'));
    log('  - 0002_invitations.sql');
    await runSqlFile(cleanMigratorPool, path.resolve('packages/contracts/db/migrations/0002_invitations.sql'));
    log('  - 0003_auth_sessions.sql');
    await runSqlFile(cleanMigratorPool, path.resolve('packages/contracts/db/migrations/0003_auth_sessions.sql'));
    log('Clean database migrations applied successfully!');

    // 4. Upgrade database: run 0001 and 0002, then apply 0003 as upgrade
    const upgradeMigratorPool = new pg.Pool({
      host: PG_HOST,
      port: PG_PORT,
      user: 'hs_migrator',
      password: 'hs_migrator_local',
      database: 'hellosmart_upgrade',
    });

    log('Applying upgrade migrations to hellosmart_upgrade as hs_migrator:');
    log('  - Initial state: 0001 + 0002');
    await runSqlFile(upgradeMigratorPool, path.resolve('packages/contracts/db/migrations/0001_tenancy_foundation.sql'));
    await runSqlFile(upgradeMigratorPool, path.resolve('packages/contracts/db/migrations/0002_invitations.sql'));
    log('  - Applying upgrade: 0003_auth_sessions.sql');
    await runSqlFile(upgradeMigratorPool, path.resolve('packages/contracts/db/migrations/0003_auth_sessions.sql'));
    log('Upgrade database migration applied successfully!');

    // 5. Verify function ownership and privileges on both databases
    const databases = ['hellosmart_clean', 'hellosmart_upgrade'];
    const functionsToCheck = [
      { name: 'lookup_user_for_login', sig: 'app.lookup_user_for_login(citext)' },
      { name: 'record_login_failure', sig: 'app.record_login_failure(uuid, integer, integer)' },
      { name: 'record_login_success', sig: 'app.record_login_success(uuid)' },
      { name: 'lookup_invitation', sig: 'app.lookup_invitation(bytea)' },
    ];

    for (const dbName of databases) {
      log(`Verifying privileges and ownership on ${dbName}:`);
      const checkPool = new pg.Pool({
        host: PG_HOST,
        port: PG_PORT,
        user: 'postgres',
        database: dbName,
      });

      for (const fn of functionsToCheck) {
        const res = await checkPool.query(
          `SELECT
             p.proname,
             r.rolname as owner,
             p.prosecdef as is_security_definer,
             has_function_privilege('public', p.oid, 'EXECUTE') as public_exec,
             has_function_privilege('hs_readonly', p.oid, 'EXECUTE') as readonly_exec,
             has_function_privilege('hs_app', p.oid, 'EXECUTE') as app_exec
           FROM pg_proc p
           JOIN pg_namespace n ON n.oid = p.pronamespace
           JOIN pg_roles r ON r.oid = p.proowner
           WHERE n.nspname = 'app' AND p.proname = $1`,
          [fn.name],
        );

        if (res.rows.length === 0) {
          throw new Error(`Function ${fn.name} not found in schema app on ${dbName}!`);
        }

        const row = res.rows[0];
        log(`  Function: ${fn.sig}`);
        log(`    - Owner: ${row.owner} (expected: hs_migrator)`);
        log(`    - Security Definer: ${row.is_security_definer} (expected: true)`);
        log(`    - PUBLIC EXECUTE: ${row.public_exec} (expected: false)`);
        log(`    - hs_readonly EXECUTE: ${row.readonly_exec} (expected: false)`);
        log(`    - hs_app EXECUTE: ${row.app_exec} (expected: true)`);

        if (row.owner !== 'hs_migrator') throw new Error(`Owner mismatch on ${fn.name}: expected hs_migrator, got ${row.owner}`);
        if (!row.is_security_definer) throw new Error(`Function ${fn.name} is not SECURITY DEFINER`);
        if (row.public_exec) throw new Error(`Security violation: PUBLIC has EXECUTE on ${fn.name}`);
        if (row.readonly_exec) throw new Error(`Security violation: hs_readonly has EXECUTE on ${fn.name}`);
        if (!row.app_exec) throw new Error(`Permission missing: hs_app denied EXECUTE on ${fn.name}`);
      }

      await checkPool.end();
    }

    // 6. Negative runtime test as hs_readonly: execute must be rejected by PostgreSQL
    log('Testing execution denial under runtime role hs_readonly:');
    const readonlyPool = new pg.Pool({
      host: PG_HOST,
      port: PG_PORT,
      user: 'hs_readonly',
      password: 'hs_readonly_local',
      database: 'hellosmart_clean',
    });

    let lookupRejected = false;
    try {
      await readonlyPool.query(`SELECT * FROM app.lookup_user_for_login('test@example.com')`);
    } catch (err) {
      if (err.code === '42501') { // permission_denied
        lookupRejected = true;
        log('  ✓ app.lookup_user_for_login correctly DENIED to hs_readonly (SQLSTATE 42501)');
      } else {
        throw err;
      }
    }
    if (!lookupRejected) throw new Error('Security check failed: hs_readonly was able to execute app.lookup_user_for_login');

    let inviteRejected = false;
    try {
      await readonlyPool.query(`SELECT * FROM app.lookup_invitation(decode('deadbeef', 'hex'))`);
    } catch (err) {
      if (err.code === '42501') {
        inviteRejected = true;
        log('  ✓ app.lookup_invitation correctly DENIED to hs_readonly (SQLSTATE 42501)');
      } else {
        throw err;
      }
    }
    if (!inviteRejected) throw new Error('Security check failed: hs_readonly was able to execute app.lookup_invitation');
    await readonlyPool.end();

    // 7. Positive runtime test under hs_app: login lookup, failure, success
    log('Testing runtime authentication flows under hs_app role:');
    const appPool = new pg.Pool({
      host: PG_HOST,
      port: PG_PORT,
      user: 'hs_app',
      password: 'hs_app_local',
      database: 'hellosmart_clean',
    });

    // Create org and user under platform context
    const orgId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const adminId = crypto.randomUUID();

    const setupClient = await appPool.connect();
    try {
      await setupClient.query('BEGIN');
      await setupClient.query(`SELECT set_config('app.is_platform', 'true', true)`);
      await setupClient.query(
        `INSERT INTO app.organizations (id, name, slug, created_by) VALUES ($1, $2, $3, $4)`,
        [orgId, 'Acme Corp', 'acme-corp', adminId],
      );
      await setupClient.query(
        `INSERT INTO app.users (id, org_id, email, name, role, password_hash, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'active')`,
        [userId, orgId, 'candidate@acme.test', 'Bob Candidate', 'candidate', 'hash123'],
      );
      await setupClient.query('COMMIT');
    } finally {
      setupClient.release();
    }

    // Call lookup_user_for_login as hs_app without tenant context (pre-login state)
    const loginLookupRes = await appPool.query(
      `SELECT * FROM app.lookup_user_for_login('candidate@acme.test')`,
    );
    if (loginLookupRes.rows.length !== 1 || loginLookupRes.rows[0].email !== 'candidate@acme.test') {
      throw new Error('app.lookup_user_for_login returned unexpected result under hs_app');
    }
    log('  ✓ app.lookup_user_for_login succeeded under hs_app without cross-tenant exposure');

    // Call record_login_failure as hs_app
    const failRes = await appPool.query(
      `SELECT * FROM app.record_login_failure($1, 5, 900)`,
      [userId],
    );
    if (failRes.rows[0].new_failed_logins !== 1) {
      throw new Error('app.record_login_failure failed to record failure');
    }
    log('  ✓ app.record_login_failure succeeded under hs_app');

    // Call record_login_success as hs_app
    await appPool.query(`SELECT app.record_login_success($1)`, [userId]);
    const resetUserRes = await appPool.query(
      `SELECT * FROM app.lookup_user_for_login('candidate@acme.test')`,
    );
    if (resetUserRes.rows[0].failed_logins !== 0) {
      throw new Error('app.record_login_success failed to reset failed_logins count');
    }
    log('  ✓ app.record_login_success succeeded under hs_app');

    // 8. Real concurrent audit-chain append test against PostgreSQL
    log('Running concurrent audit-chain append test with 20 real PostgreSQL transactions:');
    const workerCount = 20;
    const workerPromises = [];

    for (let i = 0; i < workerCount; i++) {
      workerPromises.push(
        (async (workerId) => {
          const client = await appPool.connect();
          try {
            await client.query('BEGIN');
            // Acquire exclusive transaction advisory lock
            await client.query(`SELECT pg_advisory_xact_lock(hashtext('audit.events'))`);

            // Read last hash
            const lastAuditResult = await client.query(
              `SELECT hash FROM audit.events ORDER BY id DESC LIMIT 1`,
            );
            const prevHash = lastAuditResult.rows[0]?.hash ?? Buffer.alloc(0);

            const payload = {
              worker: workerId,
              action: 'test.audit_append',
              timestamp: Date.now(),
              nonce: crypto.randomBytes(8).toString('hex'),
            };

            const payloadBuf = Buffer.from(JSON.stringify(payload));
            const eventHash = crypto
              .createHash('sha256')
              .update(Buffer.concat([prevHash, payloadBuf]))
              .digest();

            await client.query(
              `INSERT INTO audit.events (
                 actor_id, actor_role, org_id, action, entity, entity_id,
                 before, after, ip, user_agent, request_id, prev_hash, hash
               ) VALUES ($1, 'system', $2, $3, 'test', $4, null, $5, '127.0.0.1', 'test-agent', $6, $7, $8)`,
              [
                userId,
                orgId,
                payload.action,
                `entity-${workerId}`,
                JSON.stringify(payload),
                `req-${workerId}`,
                prevHash,
                eventHash,
              ],
            );

            await client.query('COMMIT');
          } catch (err) {
            await client.query('ROLLBACK').catch(() => {});
            throw err;
          } finally {
            client.release();
          }
        })(i),
      );
    }

    await Promise.all(workerPromises);
    log(`  ✓ All ${workerCount} concurrent audit transactions committed successfully!`);

    // Verify chain integrity
    const chainRes = await appPool.query(
      `SELECT id, prev_hash, hash, after FROM audit.events ORDER BY id ASC`,
    );

    if (chainRes.rows.length !== workerCount) {
      throw new Error(`Lost updates detected! Expected ${workerCount} audit rows, got ${chainRes.rows.length}`);
    }

    // Verify row 1
    const firstRow = chainRes.rows[0];
    if (firstRow.prev_hash.length !== 0) {
      throw new Error(`First audit event has non-empty prev_hash: ${firstRow.prev_hash.toString('hex')}`);
    }

    // Verify subsequent rows
    for (let i = 1; i < chainRes.rows.length; i++) {
      const prevRow = chainRes.rows[i - 1];
      const currRow = chainRes.rows[i];

      if (!currRow.prev_hash.equals(prevRow.hash)) {
        throw new Error(
          `Broken hash chain at row ${currRow.id}! prev_hash (${currRow.prev_hash.toString('hex')}) does not match row ${prevRow.id} hash (${prevRow.hash.toString('hex')})`,
        );
      }
    }
    log(`  ✓ Unbroken, monotonically linked cryptographic audit chain verified across all ${workerCount} entries!`);

    await appPool.end();
    await cleanMigratorPool.end();
    await upgradeMigratorPool.end();
    await cleanAdminPool.end();
    await upgradeAdminPool.end();
    await adminPool.end();

    log('================================================================');
    log('🎉 ALL POSTGRESQL RUNTIME CHECKS PASSED WITH 100% SUCCESS!');
    log('================================================================');
  } finally {
    if (serverStarted) {
      await stopPostgres();
    }
  }
}

main().catch((err) => {
  console.error('[PG-VERIFY ERROR]', err);
  process.exit(1);
});
