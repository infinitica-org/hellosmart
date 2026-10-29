import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contractsDir = path.resolve(__dirname, '..');
const prismBin = path.join(contractsDir, 'node_modules', '.bin', process.platform === 'win32' ? 'prism.CMD' : 'prism');
const specFile = path.join(contractsDir, 'openapi', 'openapi.yaml');

console.log('Spawning Prism mock server on port 4010...');
const prism = spawn(prismBin, ['mock', '-p', '4010', specFile], {
  shell: true,
  stdio: 'inherit'
});

async function waitForServer() {
  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    try {
      const res = await fetch('http://127.0.0.1:4010/admin/metrics', {
        headers: { Cookie: 'hs_session=token' }
      });
      if (res.status === 200) {
        console.log(`Prism connected after ${i + 1}s`);
        return;
      }
    } catch {}
  }
  throw new Error('Prism failed to respond within 30s');
}

async function runTests() {
  await waitForServer();

  console.log('\n--- Test 1: GET /admin/organizations without auth -> 401 Unauthorized ---');
  const res1 = await fetch('http://127.0.0.1:4010/admin/organizations');
  console.log('Status:', res1.status);
  assert.equal(res1.status, 401, 'Unauthenticated request must return 401');
  const body1 = await res1.json();
  console.log('Response body:', JSON.stringify(body1, null, 2));

  console.log('\n--- Test 2: GET /admin/organizations (Default List) -> 200 OK ---');
  const res2 = await fetch('http://127.0.0.1:4010/admin/organizations', {
    headers: {
      Cookie: 'hs_session=token_admin',
      Prefer: 'example=defaultList'
    }
  });
  console.log('Status:', res2.status);
  assert.equal(res2.status, 200);
  const body2 = await res2.json();
  console.log('Response body:', JSON.stringify(body2, null, 2));
  assert.equal(body2.items.length, 3);
  assert.equal(body2.items[0].name, 'Aster Ridge Inc.');
  assert.equal(body2.items[0].status, 'paid_active');
  assert.equal(body2.items[1].name, 'Brindle & Co');
  assert.equal(body2.items[1].status, 'trial_active');
  assert.equal(body2.items[2].name, 'Apex Labs');
  assert.equal(body2.items[2].status, 'suspended');
  assert.equal(body2.total, 3);

  console.log('\n--- Test 3: GET /admin/organizations (Filtered Trial) -> 200 OK ---');
  const res3 = await fetch('http://127.0.0.1:4010/admin/organizations?page=1&pageSize=20&status=trial_active&search=Brindle', {
    headers: {
      Cookie: 'hs_session=token_admin',
      Prefer: 'example=filteredTrial'
    }
  });
  console.log('Status:', res3.status);
  assert.equal(res3.status, 200);
  const body3 = await res3.json();
  console.log('Response body:', JSON.stringify(body3, null, 2));
  assert.equal(body3.items.length, 1);
  assert.equal(body3.items[0].slug, 'brindle-co');
  assert.equal(body3.items[0].candidateCount, 24);
  assert.equal(body3.items[0].trialEndsAt, '2026-11-01T10:00:00.000Z');

  console.log('\n--- Test 4: GET /admin/metrics -> 200 OK ---');
  const res4 = await fetch('http://127.0.0.1:4010/admin/metrics', {
    headers: {
      Cookie: 'hs_session=token_admin'
    }
  });
  console.log('Status:', res4.status);
  assert.equal(res4.status, 200);
  const body4 = await res4.json();
  console.log('Response body:', JSON.stringify(body4, null, 2));
  assert.equal(body4.totalCompanies, 3);
  assert.equal(body4.activeTrials, 1);
  assert.equal(body4.totalCandidates, 42);

  console.log('\n--- Test 5: GET /admin/organizations -> 403 Forbidden ---');
  const res5 = await fetch('http://127.0.0.1:4010/admin/organizations', {
    headers: {
      Cookie: 'hs_session=token_candidate',
      Prefer: 'code=403, example=forbidden'
    }
  });
  console.log('Status:', res5.status);
  assert.equal(res5.status, 403, 'Forbidden request must return 403');
  const body5 = await res5.json();
  console.log('Response body:', JSON.stringify(body5, null, 2));

  console.log('\n>>> ALL 5 PRISM MOCK ENDPOINT TESTS PASSED SUCCESSFULLY! <<<');
}

runTests()
  .catch((err) => {
    console.error('Test failed:', err);
    process.exitCode = 1;
  })
  .finally(() => {
    console.log('Stopping Prism child process...');
    prism.kill();
  });
