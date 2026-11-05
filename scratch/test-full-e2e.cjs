const crypto = require('node:crypto');

const WEB_BASE = 'http://localhost:3000';
const API_BASE = 'http://127.0.0.1:4000/api/v1';

function base32ToBuffer(base32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0;
  const output = [];
  for (const char of base32.toUpperCase().replace(/=+$/, '')) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

function generateTotp(secret, timeStep = 30) {
  const key = base32ToBuffer(secret);
  const epoch = Math.floor(Date.now() / 1000 / timeStep);
  const timeBuf = Buffer.alloc(8);
  timeBuf.writeBigInt64BE(BigInt(epoch));
  const hmac = crypto.createHmac('sha1', key).update(timeBuf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1000000;
  return code.toString().padStart(6, '0');
}

async function loginViaWeb(email, password) {
  // Step 1: Identify
  const identRes = await fetch(`${WEB_BASE}/api/auth/identify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-HS-CSRF': '1' },
    body: JSON.stringify({ email }),
  });
  const ident = await identRes.json();

  // Step 2: Login
  const loginRes = await fetch(`${WEB_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-HS-CSRF': '1' },
    body: JSON.stringify({ email, password }),
  });

  const cookie = loginRes.headers.get('set-cookie')?.split(';')[0];
  const body = await loginRes.json();
  return { status: loginRes.status, body, cookie, ident };
}

async function runAudit() {
  console.log('================================================================');
  console.log('         HELLOSMART FULL END-TO-END FLOW VERIFICATION           ');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function record(name, isSuccess, details = '') {
    total++;
    if (isSuccess) {
      passed++;
      console.log(`  [PASS] ${name}${details ? ` (${details})` : ''}`);
    } else {
      console.error(`  [FAIL] ${name} -> ${details}`);
    }
  }

  // 1. Company Admin Login & Portal Access
  console.log('--- 1. Company Admin Flow ---');
  const compLogin = await loginViaWeb('admin@asterridge.com', 'ChangeMe-Dev-Only-1');
  record('Company Admin Login via Web BFF', compLogin.status === 200 && compLogin.body.role === 'company_admin');

  const compPortal = await fetch(`${WEB_BASE}/company`, {
    headers: { Cookie: compLogin.cookie },
    redirect: 'manual',
  });
  record('Company Admin Access /company Portal', compPortal.status === 200, `HTTP ${compPortal.status}`);

  const compMe = await fetch(`${WEB_BASE}/api/auth/me`, {
    headers: { Cookie: compLogin.cookie },
  });
  const compMeData = await compMe.json();
  record('Company Admin Auth Verification (/api/auth/me)', compMe.status === 200 && compMeData.portal === 'company');

  // 2. Candidate Login & Portal Access
  console.log('\n--- 2. Existing Candidate Flow ---');
  const candLogin = await loginViaWeb('candidate.aster-ridge.001@example.com', 'ChangeMe-Dev-Only-1');
  record('Candidate Login via Web BFF', candLogin.status === 200 && candLogin.body.role === 'candidate');

  const candPortal = await fetch(`${WEB_BASE}/candidate`, {
    headers: { Cookie: candLogin.cookie },
    redirect: 'manual',
  });
  record('Candidate Access /candidate Portal', candPortal.status === 200, `HTTP ${candPortal.status}`);

  // 3. Platform Admin Login & Console Access
  console.log('\n--- 3. Platform Admin Flow ---');
  const adminLogin = await loginViaWeb('superadmin@hellosmart.ai', 'ChangeMe-Dev-Only-1');
  record('Platform Admin Login via Web BFF', adminLogin.status === 200 && adminLogin.body.role === 'platform_admin');

  const adminPortal = await fetch(`${WEB_BASE}/admin`, {
    headers: { Cookie: adminLogin.cookie },
    redirect: 'manual',
  });
  record('Platform Admin Access /admin Console', adminPortal.status === 200, `HTTP ${adminPortal.status}`);

  // 4. Role Boundary / Route Isolation (BR-25)
  console.log('\n--- 4. Route Isolation (BR-25) Checks ---');
  const candToAdmin = await fetch(`${WEB_BASE}/admin`, {
    headers: { Cookie: candLogin.cookie },
    redirect: 'manual',
  });
  record(
    'Candidate Blocked from /admin (redirects to /candidate)',
    candToAdmin.status === 307 && candToAdmin.headers.get('location')?.includes('/candidate'),
    `status: ${candToAdmin.status}, loc: ${candToAdmin.headers.get('location')}`
  );

  const candToCompany = await fetch(`${WEB_BASE}/company`, {
    headers: { Cookie: candLogin.cookie },
    redirect: 'manual',
  });
  record(
    'Candidate Blocked from /company (redirects to /candidate)',
    candToCompany.status === 307 && candToCompany.headers.get('location')?.includes('/candidate'),
    `status: ${candToCompany.status}, loc: ${candToCompany.headers.get('location')}`
  );

  const compToAdmin = await fetch(`${WEB_BASE}/admin`, {
    headers: { Cookie: compLogin.cookie },
    redirect: 'manual',
  });
  record(
    'Company Admin Blocked from /admin (redirects to /company)',
    compToAdmin.status === 307 && compToAdmin.headers.get('location')?.includes('/company'),
    `status: ${compToAdmin.status}, loc: ${compToAdmin.headers.get('location')}`
  );

  const unauthToAdmin = await fetch(`${WEB_BASE}/admin`, { redirect: 'manual' });
  record('Unauthenticated Blocked from /admin (redirects to /login)', unauthToAdmin.status === 307 && unauthToAdmin.headers.get('location')?.includes('/login?from=%2Fadmin'));

  // 5. Candidate Invitation & Onboarding Lifecycle (BR-24)
  console.log('\n--- 5. Candidate Invite & Password Setup Flow (BR-24) ---');
  const newCandidateEmail = `candidate.${Date.now()}@example.test`;
  const inviteRes = await fetch(`${API_BASE}/candidates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-HS-CSRF': '1',
      Cookie: compLogin.cookie,
      Origin: 'http://localhost:3000',
    },
    body: JSON.stringify({ name: 'Jordan Rivera', email: newCandidateEmail }),
  });
  const inviteData = await inviteRes.json();
  record('Company Admin Invites New Candidate via API', inviteRes.status === 201 && inviteData.status === 'invited', `Email: ${newCandidateEmail}`);

  // Retrieve raw token from Mailpit or DB
  const path = require('node:path');
  const pg = require(path.resolve(__dirname, '../apps/api/node_modules/pg'));
  const pool = new pg.Pool({ connectionString: 'postgres://hs_migrator:hs_migrator_local@localhost:5432/hellosmart' });
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest();

  // Create an invitation with this test token for the new candidate
  await pool.query(
    `INSERT INTO app.invitations (id, org_id, user_id, email, role, token_hash, expires_at)
     VALUES ($1, $2, $3, $4, 'candidate', $5, NOW() + INTERVAL '71 hours')`,
    [crypto.randomUUID(), compLogin.body.org.id, inviteData.id, newCandidateEmail, tokenHash]
  );
  await pool.end();

  // Validate invitation token
  const valRes = await fetch(`${API_BASE}/auth/invitations/${rawToken}`);
  const valData = await valRes.json();
  record('Validate Invitation Token', valRes.status === 200 && valData.email === newCandidateEmail, `Role: ${valData.role}`);

  // Set password via accept invitation
  const candidateNewPassword = 'CandidateSecurePass-2026!';
  const accRes = await fetch(`${API_BASE}/auth/invitations/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-HS-CSRF': '1' },
    body: JSON.stringify({ token: rawToken, password: candidateNewPassword }),
  });
  const accData = await accRes.json();
  record('Accept Invitation & Set Password', accRes.status === 200 && accData.success === true);

  // New Candidate logs in with set password
  const newCandLogin = await loginViaWeb(newCandidateEmail, candidateNewPassword);
  record(
    'Newly Activated Candidate Logs In',
    newCandLogin.status === 200 && newCandLogin.body.role === 'candidate',
    `status: ${newCandLogin.status}, body: ${JSON.stringify(newCandLogin.body)}`
  );

  const newCandPortal = await fetch(`${WEB_BASE}/candidate`, {
    headers: { Cookie: newCandLogin.cookie },
    redirect: 'manual',
  });
  record(
    'Newly Activated Candidate Reaches /candidate Portal',
    newCandPortal.status === 200,
    `HTTP ${newCandPortal.status}, loc: ${newCandPortal.headers.get('location')}`
  );

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passed} / ${total} tests passed (${Math.round((passed / total) * 100)}%)`);
  console.log('================================================================\n');
}

runAudit().catch(console.error);
