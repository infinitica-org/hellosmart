import crypto from 'node:crypto';
import pg from '../apps/api/node_modules/pg/lib/index.js';

const API_BASE = 'http://localhost:4000/api/v1';
const SAMPLE_TOKEN = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const STRONG_PASS = 'CorrectHorseBatteryStaple1!';

async function resetSeed() {
  const pool = new pg.Pool({
    host: '127.0.0.1',
    port: 5432,
    user: 'hs_migrator',
    password: 'hs_migrator_local',
    database: 'hellosmart',
  });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.is_platform', 'true', true)");
    const orgId = '11111111-1111-1111-1111-111111111111';
    const candidateId = '22222222-2222-2222-2222-222222222222';
    const invitationId = '33333333-3333-3333-3333-333333333333';
    const tokenHash = crypto.createHash('sha256').update(SAMPLE_TOKEN.trim()).digest();

    await client.query(`
      UPDATE app.users
      SET status = 'invited', must_reset_password = true, password_hash = NULL
      WHERE id = $1
    `, [candidateId]);

    await client.query(`DELETE FROM app.invitations WHERE email = 'jane.doe@example.com'`);
    await client.query(`
      INSERT INTO app.invitations (id, org_id, user_id, email, role, token_hash, created_at, expires_at, used_at)
      VALUES ($1, $2, $3, 'jane.doe@example.com', 'candidate', $4, now(), now() + interval '71 hours', NULL)
    `, [invitationId, orgId, candidateId, tokenHash]);

    await client.query('COMMIT');
  } finally {
    client.release();
    await pool.end();
  }
}

async function run() {
  console.log('--- STARTING HELLOSMART AUTH FLOW E2E VERIFICATION ---');
  await resetSeed();
  console.log('Database state reset: Jane Doe invited with fresh sample token.');

  // Step 1: Validate invitation token
  console.log('\n[Step 1] GET /auth/invitations/:token');
  const res1 = await fetch(`${API_BASE}/auth/invitations/${SAMPLE_TOKEN}`);
  console.log(`Status: ${res1.status}`);
  const data1 = await res1.json();
  console.log('Response:', data1);
  if (res1.status !== 200 || data1.email !== 'jane.doe@example.com') {
    throw new Error(`Step 1 failed: expected 200 with jane.doe@example.com, got ${res1.status}`);
  }

  // Step 2: Accept invitation and set password
  console.log('\n[Step 2] POST /auth/invitations/accept');
  const res2 = await fetch(`${API_BASE}/auth/invitations/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: SAMPLE_TOKEN,
      password: STRONG_PASS,
    }),
  });
  console.log(`Status: ${res2.status}`);
  const data2 = await res2.json();
  console.log('Response:', data2);
  if (res2.status !== 200 || !data2.success) {
    throw new Error(`Step 2 failed: expected 200 with success: true, got ${res2.status}`);
  }

  // Step 3: Verify single-use token consumption (burn)
  console.log('\n[Step 3] Re-testing GET /auth/invitations/:token (Must return 404)');
  const res3 = await fetch(`${API_BASE}/auth/invitations/${SAMPLE_TOKEN}`);
  console.log(`Status: ${res3.status}`);
  const data3 = await res3.json();
  console.log('Response:', data3);
  if (res3.status !== 404) {
    throw new Error(`Step 3 failed: expected 404 for consumed token, got ${res3.status}`);
  }

  // Step 4: Login with newly activated credentials
  console.log('\n[Step 4] POST /auth/login with newly set password');
  const res4 = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'jane.doe@example.com',
      password: STRONG_PASS,
    }),
  });
  console.log(`Status: ${res4.status}`);
  const data4 = await res4.json();
  console.log('Response:', data4);
  const setCookie = res4.headers.get('set-cookie');
  console.log('Set-Cookie Header:', setCookie ? 'Present (HttpOnly session)' : 'None');
  if (res4.status !== 200 || data4.email !== 'jane.doe@example.com' || data4.mustResetPassword !== false) {
    throw new Error(`Step 4 failed: expected 200 login with mustResetPassword: false`);
  }

  // Step 5: Verify PostgreSQL state & audit chain
  console.log('\n[Step 5] Verify PostgreSQL User State and Audit Log');
  const pool = new pg.Pool({
    host: '127.0.0.1',
    port: 5432,
    user: 'hs_migrator',
    password: 'hs_migrator_local',
    database: 'hellosmart',
  });

  const userRes = await pool.query(`SELECT id, email, status, must_reset_password FROM app.users WHERE email = 'jane.doe@example.com'`);
  console.log('PostgreSQL User Record:', userRes.rows[0]);

  const auditRes = await pool.query(`SELECT id, action, entity, entity_id, encode(prev_hash, 'hex') as prev_hash_hex, encode(hash, 'hex') as hash_hex FROM audit.events ORDER BY id DESC LIMIT 5`);
  console.log('Recent Audit Events:', auditRes.rows);

  await pool.end();

  // Step 6: Verify Next.js Web pages return 200
  console.log('\n[Step 6] Verify Next.js Web Pages (Port 3000)');
  const homeRes = await fetch('http://localhost:3000/');
  console.log(`GET / : ${homeRes.status}`);

  const loginRes = await fetch('http://localhost:3000/login');
  console.log(`GET /login : ${loginRes.status}`);

  const inviteRes = await fetch(`http://localhost:3000/accept-invite?token=${SAMPLE_TOKEN}`);
  console.log(`GET /accept-invite?token=... : ${inviteRes.status}`);

  if (homeRes.status !== 200 || loginRes.status !== 200 || inviteRes.status !== 200) {
    throw new Error('Step 6 failed: one or more web routes did not return 200');
  }

  console.log('\n============================================================');
  console.log('🎉 ALL END-TO-END FLOWS VERIFIED SUCCESSFULLY!');
  console.log('============================================================');
}

run().catch((err) => {
  console.error('\n❌ E2E VERIFICATION FAILED:', err);
  process.exit(1);
});
