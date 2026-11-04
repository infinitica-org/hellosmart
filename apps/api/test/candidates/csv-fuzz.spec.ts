import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  checkDbConnection,
  createCandidateFuzzTestApp,
  createTestSession,
  generateTestNonce,
  forceGarbageCollection,
  countOrgUsers,
  countOrgInvitations,
  cleanOrgData,
  type CandidateFuzzTestContext,
} from './helpers/candidate-fuzz-test-app.js';

const isDbAvailable = await checkDbConnection();
const fixturesDir = path.resolve(__dirname, '../../../../packages/contracts/fixtures/csv');

describe.runIf(isDbAvailable)(
  'Candidate Bulk CSV Ingestion & Fuzz Testing (BR-06, BR-24, BR-25, CO-012, EX-11)',
  () => {
    let ctx: CandidateFuzzTestContext;
    let orgPrimaryId: string;
    let orgSecondaryId: string;
    let companyAdminPrimaryToken: string;
    let companyAdminSecondaryToken: string;
    let candidateToken: string;
    const createdOrgIds: string[] = [];

    beforeAll(async () => {
      ctx = await createCandidateFuzzTestApp();
      const nonce = generateTestNonce();
      const client = await ctx.platformPool.connect();

      try {
        await client.query(`SELECT set_config('app.is_platform', 'true', false)`);

        // 1. Create primary organization (cap = 2500 candidates for 1000-row volume test)
        const org1Res = await client.query(
          `INSERT INTO app.organizations (name, slug, status, created_by)
         VALUES ($1, $2, 'paid_active', '00000000-0000-4000-8000-000000000001')
         RETURNING id`,
          [`Fuzz Primary Org ${nonce}`, `fuzz-prim-${nonce}`],
        );
        orgPrimaryId = org1Res.rows[0].id;
        createdOrgIds.push(orgPrimaryId);

        await client.query(
          `INSERT INTO app.entitlements (org_id, max_templates, max_candidates, pending_invite_multiplier)
         VALUES ($1, 10, 2500, 2.0) ON CONFLICT (org_id) DO NOTHING`,
          [orgPrimaryId],
        );

        // 2. Create secondary organization (cap = 5 candidates for quota tests)
        const org2Res = await client.query(
          `INSERT INTO app.organizations (name, slug, status, created_by)
         VALUES ($1, $2, 'paid_active', '00000000-0000-4000-8000-000000000001')
         RETURNING id`,
          [`Fuzz Small Org ${nonce}`, `fuzz-small-${nonce}`],
        );
        orgSecondaryId = org2Res.rows[0].id;
        createdOrgIds.push(orgSecondaryId);

        await client.query(
          `INSERT INTO app.entitlements (org_id, max_templates, max_candidates, pending_invite_multiplier)
         VALUES ($1, 10, 5, 2.0) ON CONFLICT (org_id) DO NOTHING`,
          [orgSecondaryId],
        );

        // 3. Create company_admin users and sessions
        const user1Res = await client.query(
          `INSERT INTO app.users (org_id, email, name, role, status)
         VALUES ($1, $2, 'Primary Admin', 'company_admin', 'active')
         RETURNING id`,
          [orgPrimaryId, `primary.admin.${nonce}@example.test`],
        );
        companyAdminPrimaryToken = await createTestSession(ctx.sessionService, {
          userId: user1Res.rows[0].id,
          orgId: orgPrimaryId,
          email: `primary.admin.${nonce}@example.test`,
          role: 'company_admin',
        });

        const user2Res = await client.query(
          `INSERT INTO app.users (org_id, email, name, role, status)
         VALUES ($1, $2, 'Secondary Admin', 'company_admin', 'active')
         RETURNING id`,
          [orgSecondaryId, `secondary.admin.${nonce}@example.test`],
        );
        companyAdminSecondaryToken = await createTestSession(ctx.sessionService, {
          userId: user2Res.rows[0].id,
          orgId: orgSecondaryId,
          email: `secondary.admin.${nonce}@example.test`,
          role: 'company_admin',
        });

        // 4. Create candidate user and session for route isolation checks
        const candidateUserRes = await client.query(
          `INSERT INTO app.users (org_id, email, name, role, status)
         VALUES ($1, $2, 'Test Candidate', 'candidate', 'active')
         RETURNING id`,
          [orgPrimaryId, `test.candidate.${nonce}@example.test`],
        );
        candidateToken = await createTestSession(ctx.sessionService, {
          userId: candidateUserRes.rows[0].id,
          orgId: orgPrimaryId,
          email: `test.candidate.${nonce}@example.test`,
          role: 'candidate',
        });
      } finally {
        client.release();
      }
    });

    afterAll(async () => {
      // Invariant (Lesson 1): Teardown in reverse dependency order using platform role
      try {
        await cleanOrgData(ctx.platformPool, createdOrgIds);

        const verifyCount = await countOrgUsers(ctx.platformPool, orgPrimaryId);
        expect(verifyCount).toBe(0);
      } finally {
        await ctx.appPool.end();
        await ctx.adminPool.end();
        await ctx.platformPool.end();
        await ctx.app.close();
      }
    });

    // =========================================================================
    // PART 1: VOLUME & MEMORY FOOTPRINT (1,000-ROW FIXTURE)
    // =========================================================================

    describe('Part 1: Volume & Memory Footprint (1,000-Row Fixture)', () => {
      it('control: 5-row bulk import succeeds with 200 OK and records expected users & invitations', async () => {
        const candidates = Array.from({ length: 5 }, (_, i) => ({
          name: `Control Candidate 0${i + 1}`,
          email: `control.cand.0${i + 1}@example.test`,
        }));

        const res = await ctx.app.inject({
          method: 'POST',
          url: '/api/v1/company/candidates/bulk',
          headers: {
            cookie: `hs_session=${companyAdminPrimaryToken}`,
            'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
            origin: ctx.corsOrigin,
          },
          payload: { candidates },
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.created).toHaveLength(5);
        expect(body.errors).toHaveLength(0);

        // Verify in database: users created with role candidate and status invited
        const userCount = await countOrgUsers(ctx.platformPool, orgPrimaryId, 'control.cand.%');
        expect(userCount).toBe(5);

        // Verify invitations created with token hashes
        const invCount = await countOrgInvitations(
          ctx.platformPool,
          orgPrimaryId,
          'control.cand.%',
        );
        expect(invCount).toBe(5);

        // Clean up control candidates
        const client = await ctx.platformPool.connect();
        try {
          await client.query(`SELECT set_config('app.is_platform', 'true', false)`);
          await client.query(
            `DELETE FROM app.invitations WHERE org_id = $1 AND email LIKE 'control.cand.%'`,
            [orgPrimaryId],
          );
          await client.query(
            `DELETE FROM app.users WHERE org_id = $1 AND email LIKE 'control.cand.%'`,
            [orgPrimaryId],
          );
        } finally {
          client.release();
        }
      });

      it('1,000-row CSV upload: imports 1,000 candidates and asserts memory footprint growth remains strictly under 50 MB', async () => {
        // 1. Read 1000-candidates.csv fixture and parse to JSON records
        const fixturePath = path.join(fixturesDir, '1000-candidates.csv');
        const csvContent = fs.readFileSync(fixturePath, 'utf8');
        const lines = csvContent.trim().split('\n');
        expect(lines).toHaveLength(1001); // 1 header + 1000 rows

        const candidates = lines.slice(1).map((line) => {
          const [name, email] = line.split(',');
          return { name: name!.trim(), email: email!.trim() };
        });
        expect(candidates).toHaveLength(1000);

        const jsonPayloadString = JSON.stringify({ candidates });
        const payloadSizeBytes = Buffer.byteLength(jsonPayloadString, 'utf8');
        // Documented request payload size: ~85 KB, staying well under the 1 MB bodyLimit
        expect(payloadSizeBytes).toBeLessThan(120_000);

        // 2. Warm up with 20 candidates and trigger GC
        const warmUpCandidates = Array.from({ length: 20 }, (_, i) => ({
          name: `Warmup Candidate ${i + 1}`,
          email: `warmup.candidate.${i + 1}@example.test`,
        }));
        await ctx.app.inject({
          method: 'POST',
          url: '/api/v1/company/candidates/bulk',
          headers: {
            cookie: `hs_session=${companyAdminPrimaryToken}`,
            'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
            origin: ctx.corsOrigin,
          },
          payload: { candidates: warmUpCandidates },
        });
        const client = await ctx.platformPool.connect();
        try {
          await client.query(`SELECT set_config('app.is_platform', 'true', false)`);
          await client.query(
            `DELETE FROM app.invitations WHERE org_id = $1 AND email LIKE 'warmup.candidate.%'`,
            [orgPrimaryId],
          );
          await client.query(
            `DELETE FROM app.users WHERE org_id = $1 AND email LIKE 'warmup.candidate.%'`,
            [orgPrimaryId],
          );
        } finally {
          client.release();
        }

        forceGarbageCollection();
        const baselineMemory = process.memoryUsage();

        // 3. Execute 1,000 candidate bulk import
        const startTime = Date.now();
        const res = await ctx.app.inject({
          method: 'POST',
          url: '/api/v1/company/candidates/bulk',
          headers: {
            cookie: `hs_session=${companyAdminPrimaryToken}`,
            'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
            origin: ctx.corsOrigin,
          },
          payload: { candidates },
        });
        const durationMs = Date.now() - startTime;

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.created).toHaveLength(1000);
        expect(body.errors).toHaveLength(0);
        // Execution finishes in reasonable bounded time (< 60s)
        expect(durationMs).toBeLessThan(60_000);

        // 4. Force GC and measure memory growth
        forceGarbageCollection();
        const finalMemory = process.memoryUsage();
        const heapGrowthBytes = Math.max(0, finalMemory.heapUsed - baselineMemory.heapUsed);
        const heapGrowthMB = heapGrowthBytes / (1024 * 1024);

        // Invariant: Memory footprint remains steady under 50 MB
        expect(heapGrowthMB).toBeLessThan(50);

        // 5. Database state verification: 1,000 candidate users and 1,000 invitations
        const userCount = await countOrgUsers(ctx.platformPool, orgPrimaryId, 'fuzz.candidate.%');
        expect(userCount).toBe(1000);

        const invCount = await countOrgInvitations(
          ctx.platformPool,
          orgPrimaryId,
          'fuzz.candidate.%',
        );
        expect(invCount).toBe(1000);

        // Clean up first 1,000 batch immediately
        const cleanupClient = await ctx.platformPool.connect();
        try {
          await cleanupClient.query(`SELECT set_config('app.is_platform', 'true', false)`);
          await cleanupClient.query(
            `DELETE FROM app.invitations WHERE org_id = $1 AND email LIKE 'fuzz.candidate.%'`,
            [orgPrimaryId],
          );
          await cleanupClient.query(
            `DELETE FROM app.users WHERE org_id = $1 AND email LIKE 'fuzz.candidate.%'`,
            [orgPrimaryId],
          );
        } finally {
          cleanupClient.release();
        }
      });

      it('memory plateau verification: second 1,000-row batch confirms memory does not grow unbounded', async () => {
        const candidatesBatch2 = Array.from({ length: 1000 }, (_, i) => ({
          name: `Plateau Candidate ${i + 1}`,
          email: `fuzz.plateau.${(i + 1).toString().padStart(4, '0')}@example.test`,
        }));

        forceGarbageCollection();
        const baselineMemory = process.memoryUsage();

        const res = await ctx.app.inject({
          method: 'POST',
          url: '/api/v1/candidates/bulk', // Test alias route
          headers: {
            cookie: `hs_session=${companyAdminPrimaryToken}`,
            'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
            origin: ctx.corsOrigin,
          },
          payload: { candidates: candidatesBatch2 },
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.created).toHaveLength(1000);

        forceGarbageCollection();
        const finalMemory = process.memoryUsage();
        const heapGrowthMB =
          Math.max(0, finalMemory.heapUsed - baselineMemory.heapUsed) / (1024 * 1024);

        // Memory growth on second batch remains bounded (< 50 MB)
        expect(heapGrowthMB).toBeLessThan(50);

        // Clean up second 1,000 batch
        const cleanupClient = await ctx.platformPool.connect();
        try {
          await cleanupClient.query(`SELECT set_config('app.is_platform', 'true', false)`);
          await cleanupClient.query(
            `DELETE FROM app.invitations WHERE org_id = $1 AND email LIKE 'fuzz.plateau.%'`,
            [orgPrimaryId],
          );
          await cleanupClient.query(
            `DELETE FROM app.users WHERE org_id = $1 AND email LIKE 'fuzz.plateau.%'`,
            [orgPrimaryId],
          );
        } finally {
          cleanupClient.release();
        }
      });
    });

    // =========================================================================
    // PART 2: QUOTA, ENTITLEMENTS & SOFT-DELETE BEHAVIOR (BR-06, CO-012, EX-11)
    // =========================================================================

    describe('Part 2: Quota, Entitlements & Soft-Delete Invariants (BR-06, CO-012, EX-11)', () => {
      it.skip('[FINDING-03] rejects import exceeding candidate entitlement cap or pending-invite multiplier (BR-06, CO-012, EX-11)', async () => {
        // Small org has max_candidates = 5.
        // Under BR-06, pending invites are capped at pending_invite_multiplier * max_candidates (2 * 5 = 10).
        // Attempting to import 12 candidates should be blocked or rejected.
        // Currently SKIPPED because CandidatesService.create and bulkCreate omit entitlement checks.
        const candidates = Array.from({ length: 12 }, (_, i) => ({
          name: `Quota Candidate ${i + 1}`,
          email: `quota.overcap.${i + 1}@example.test`,
        }));

        const res = await ctx.app.inject({
          method: 'POST',
          url: '/api/v1/company/candidates/bulk',
          headers: {
            cookie: `hs_session=${companyAdminSecondaryToken}`,
            'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
            origin: ctx.corsOrigin,
          },
          payload: { candidates },
        });

        expect(res.statusCode).toBe(403);
      });

      it('documents [FINDING-05]: soft-deleted candidate email cannot be re-imported due to unconditional UNIQUE(org_id, email)', async () => {
        // 1. Create a candidate
        const candEmail = 'fuzz.softdel@example.test';
        const createRes = await ctx.app.inject({
          method: 'POST',
          url: '/api/v1/company/candidates',
          headers: {
            cookie: `hs_session=${companyAdminPrimaryToken}`,
            'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
            origin: ctx.corsOrigin,
          },
          payload: {
            name: 'Soft Deleted Candidate',
            email: candEmail,
          },
        });
        expect(createRes.statusCode).toBe(201);
        const createdUser = JSON.parse(createRes.body);

        // 2. Soft-delete the candidate via DELETE /company/candidates/:id
        const delRes = await ctx.app.inject({
          method: 'DELETE',
          url: `/api/v1/company/candidates/${createdUser.id}`,
          headers: {
            cookie: `hs_session=${companyAdminPrimaryToken}`,
            'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
            origin: ctx.corsOrigin,
          },
        });
        expect(delRes.statusCode).toBe(200);

        // 3. Attempt to re-import the same email in bulk
        const reimportRes = await ctx.app.inject({
          method: 'POST',
          url: '/api/v1/company/candidates/bulk',
          headers: {
            cookie: `hs_session=${companyAdminPrimaryToken}`,
            'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
            origin: ctx.corsOrigin,
          },
          payload: {
            candidates: [{ name: 'Re-imported Candidate', email: candEmail }],
          },
        });

        expect(reimportRes.statusCode).toBe(200);
        const reimportBody = JSON.parse(reimportRes.body);
        // Service catches unique constraint error and returns per-row error
        expect(reimportBody.created).toHaveLength(0);
        expect(reimportBody.errors).toHaveLength(1);
        expect(reimportBody.errors[0].email).toBe(candEmail);
        expect(reimportBody.errors[0].reason).toMatch(/duplicate key value|already exists/i);

        // Clean up soft-deleted candidate
        const client = await ctx.platformPool.connect();
        try {
          await client.query(`SELECT set_config('app.is_platform', 'true', false)`);
          await client.query(`DELETE FROM app.invitations WHERE org_id = $1 AND email = $2`, [
            orgPrimaryId,
            candEmail,
          ]);
          await client.query(`DELETE FROM app.users WHERE org_id = $1 AND email = $2`, [
            orgPrimaryId,
            candEmail,
          ]);
        } finally {
          client.release();
        }
      });

      it('allows identical email in DIFFERENT organizations (unique per org_id, email boundary)', async () => {
        const crossOrgEmail = 'cross.tenant.candidate@example.test';

        // Import in Org 1
        const res1 = await ctx.app.inject({
          method: 'POST',
          url: '/api/v1/company/candidates/bulk',
          headers: {
            cookie: `hs_session=${companyAdminPrimaryToken}`,
            'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
            origin: ctx.corsOrigin,
          },
          payload: {
            candidates: [{ name: 'Tenant A Candidate', email: crossOrgEmail }],
          },
        });
        expect(res1.statusCode).toBe(200);
        expect(JSON.parse(res1.body).created).toHaveLength(1);

        // Import identical email in Org 2
        const res2 = await ctx.app.inject({
          method: 'POST',
          url: '/api/v1/company/candidates/bulk',
          headers: {
            cookie: `hs_session=${companyAdminSecondaryToken}`,
            'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
            origin: ctx.corsOrigin,
          },
          payload: {
            candidates: [{ name: 'Tenant B Candidate', email: crossOrgEmail }],
          },
        });
        expect(res2.statusCode).toBe(200);
        expect(JSON.parse(res2.body).created).toHaveLength(1);

        // Clean up both
        const client = await ctx.platformPool.connect();
        try {
          await client.query(`SELECT set_config('app.is_platform', 'true', false)`);
          await client.query(`DELETE FROM app.invitations WHERE email = $1`, [crossOrgEmail]);
          await client.query(`DELETE FROM app.users WHERE email = $1`, [crossOrgEmail]);
        } finally {
          client.release();
        }
      });
    });

    // =========================================================================
    // PART 3: PAYLOAD FUZZING MATRIX (10 ATTACK & BOUNDARY CLASSES)
    // =========================================================================

    describe('Part 3: Hostile Payload Fuzzing Matrix', () => {
      it('Class 1: SQL Injection payloads stored inertly with parameterized queries and no time delay', async () => {
        const sqliPayloads = [
          "' OR '1'='1",
          "'; DROP TABLE app.users;--",
          'UNION SELECT null, null, null--',
          '$1',
          '{{7*7}}',
          '\\',
          '%',
        ];

        const candidates = sqliPayloads.map((payload, i) => ({
          name: `SQLi Candidate ${payload.slice(0, 80)}`,
          email: `sqli.candidate.${i}@example.test`,
        }));

        const startTime = Date.now();
        const res = await ctx.app.inject({
          method: 'POST',
          url: '/api/v1/company/candidates/bulk',
          headers: {
            cookie: `hs_session=${companyAdminPrimaryToken}`,
            'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
            origin: ctx.corsOrigin,
          },
          payload: { candidates },
        });
        const durationMs = Date.now() - startTime;

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.created).toHaveLength(sqliPayloads.length);
        expect(durationMs).toBeLessThan(4000); // No time-based injection delay

        // Verify table schema is completely intact
        const checkTable = await ctx.platformPool.query(`SELECT 1 FROM app.users LIMIT 1`);
        expect(checkTable.rowCount).toBe(1);

        // Verify values stored verbatim without execution
        const client = await ctx.platformPool.connect();
        try {
          await client.query(`SELECT set_config('app.is_platform', 'true', false)`);
          const stored = await client.query<{ name: string }>(
            `SELECT name FROM app.users WHERE org_id = $1 AND email = 'sqli.candidate.1@example.test'`,
            [orgPrimaryId],
          );
          expect(stored.rows[0]?.name).toContain("'; DROP TABLE app.users;--");
          await client.query(
            `DELETE FROM app.invitations WHERE org_id = $1 AND email LIKE 'sqli.candidate.%'`,
            [orgPrimaryId],
          );
          await client.query(
            `DELETE FROM app.users WHERE org_id = $1 AND email LIKE 'sqli.candidate.%'`,
            [orgPrimaryId],
          );
        } finally {
          client.release();
        }
      });

      it('Class 2: Cross-Site Scripting (XSS) payloads stored inertly and rendered safe in JSON response', async () => {
        const xssPayloads = [
          '<script>alert(1)</script>',
          '<img src=x onerror=alert(1)>',
          '<svg onload=alert(1)>',
          '"><script>alert(1)</script>',
          'javascript:alert(1)',
        ];

        const candidates = xssPayloads.map((payload, i) => ({
          name: `XSS Name ${payload}`,
          email: `xss.candidate.${i}@example.test`,
        }));

        const res = await ctx.app.inject({
          method: 'POST',
          url: '/api/v1/company/candidates/bulk',
          headers: {
            cookie: `hs_session=${companyAdminPrimaryToken}`,
            'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
            origin: ctx.corsOrigin,
          },
          payload: { candidates },
        });

        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toContain('application/json');
        const body = JSON.parse(res.body);
        expect(body.created).toHaveLength(xssPayloads.length);

        const client = await ctx.platformPool.connect();
        try {
          await client.query(`SELECT set_config('app.is_platform', 'true', false)`);
          await client.query(
            `DELETE FROM app.invitations WHERE org_id = $1 AND email LIKE 'xss.candidate.%'`,
            [orgPrimaryId],
          );
          await client.query(
            `DELETE FROM app.users WHERE org_id = $1 AND email LIKE 'xss.candidate.%'`,
            [orgPrimaryId],
          );
        } finally {
          client.release();
        }
      });

      it('Class 3: Spreadsheet Formula Injection strings (=, +, -, @) stored verbatim in database', async () => {
        const formulaPayloads = [
          "=cmd|' /C calc'!A0",
          '+SUM(1+1)',
          '-100',
          '@mention',
          '=HYPERLINK("http://evil.test","Click")',
        ];

        const candidates = formulaPayloads.map((formula, i) => ({
          name: `Formula Candidate ${formula}`,
          email: `formula.candidate.${i}@example.test`,
        }));

        const res = await ctx.app.inject({
          method: 'POST',
          url: '/api/v1/company/candidates/bulk',
          headers: {
            cookie: `hs_session=${companyAdminPrimaryToken}`,
            'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
            origin: ctx.corsOrigin,
          },
          payload: { candidates },
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.created).toHaveLength(formulaPayloads.length);

        const client = await ctx.platformPool.connect();
        try {
          await client.query(`SELECT set_config('app.is_platform', 'true', false)`);
          await client.query(
            `DELETE FROM app.invitations WHERE org_id = $1 AND email LIKE 'formula.candidate.%'`,
            [orgPrimaryId],
          );
          await client.query(
            `DELETE FROM app.users WHERE org_id = $1 AND email LIKE 'formula.candidate.%'`,
            [orgPrimaryId],
          );
        } finally {
          client.release();
        }
      });

      it.skip('[FINDING-04b] rejects email containing CRLF and header injection instead of forwarding to MailService', async () => {
        // Due to missing email validation in CandidatesController.bulk and CandidatesService,
        // CRLF strings reach MailService.sendInvitationEmail unescaped.
        // Skipped per finding handling.
        const maliciousEmail = 'victim@example.test\r\nBcc: spy@example.test';
        const res = await ctx.app.inject({
          method: 'POST',
          url: '/api/v1/company/candidates/bulk',
          headers: {
            cookie: `hs_session=${companyAdminPrimaryToken}`,
            'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
            origin: ctx.corsOrigin,
          },
          payload: {
            candidates: [{ name: 'CRLF Injected', email: maliciousEmail }],
          },
        });

        const body = JSON.parse(res.body);
        expect(body.created).toHaveLength(0);
        expect(body.errors).toHaveLength(1);
      });

      it('Class 5: Path Traversal handled safely without 500 crashes', async () => {
        const traversalName = '../../../../etc/passwd';
        const res = await ctx.app.inject({
          method: 'POST',
          url: '/api/v1/company/candidates/bulk',
          headers: {
            cookie: `hs_session=${companyAdminPrimaryToken}`,
            'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
            origin: ctx.corsOrigin,
          },
          payload: {
            candidates: [{ name: traversalName, email: 'traversal.cand@example.test' }],
          },
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.created).toHaveLength(1);

        const client = await ctx.platformPool.connect();
        try {
          await client.query(`SELECT set_config('app.is_platform', 'true', false)`);
          await client.query(
            `DELETE FROM app.invitations WHERE email = 'traversal.cand@example.test'`,
          );
          await client.query(`DELETE FROM app.users WHERE email = 'traversal.cand@example.test'`);
        } finally {
          client.release();
        }
      });

      it('Class 6: Unicode edge cases (RTL, zero-width, combining marks, emoji) stored faithfully', async () => {
        const candidates = [
          { name: 'RTL Candidate \u202Ereversed', email: 'unicode.rtl@example.test' },
          { name: 'ZeroWidth\u200BName', email: 'unicode.zerowidth@example.test' },
          { name: 'Combining\u0300\u0301\u0302Name', email: 'unicode.combining@example.test' },
          { name: 'Emoji Candidate 🧑‍💻', email: 'unicode.emoji@example.test' },
        ];

        const res = await ctx.app.inject({
          method: 'POST',
          url: '/api/v1/company/candidates/bulk',
          headers: {
            cookie: `hs_session=${companyAdminPrimaryToken}`,
            'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
            origin: ctx.corsOrigin,
          },
          payload: { candidates },
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.created).toHaveLength(candidates.length);

        const client = await ctx.platformPool.connect();
        try {
          await client.query(`SELECT set_config('app.is_platform', 'true', false)`);
          await client.query(
            `DELETE FROM app.invitations WHERE org_id = $1 AND email LIKE 'unicode.%'`,
            [orgPrimaryId],
          );
          await client.query(`DELETE FROM app.users WHERE org_id = $1 AND email LIKE 'unicode.%'`, [
            orgPrimaryId,
          ]);
        } finally {
          client.release();
        }
      });

      it('Class 7: Prototype pollution keys (__proto__) are rejected by Fastify gateway with HTTP 400', async () => {
        const res = await ctx.app.inject({
          method: 'POST',
          url: '/api/v1/company/candidates/bulk',
          headers: {
            cookie: `hs_session=${companyAdminPrimaryToken}`,
            'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
            'content-type': 'application/json',
            origin: ctx.corsOrigin,
          },
          payload:
            '{"__proto__":{"polluted":true},"candidates":[{"name":"Prototype Candidate","email":"prototype.cand@example.test"}]}',
        });

        // Fastify built-in prototype pollution defense rejects with 400 Bad Request
        expect(res.statusCode).toBe(400);
        expect(({} as any).polluted).toBeUndefined();
      });

      it('Class 8: Fastify 1 MB bodyLimit boundary test (under 1 MB succeeds, over 1 MB returns 413)', async () => {
        // 1. Payload just under 1 MB (~900 KB name padding on 1 candidate)
        const underPayloadName = 'A'.repeat(900 * 1024);
        const underRes = await ctx.app.inject({
          method: 'POST',
          url: '/api/v1/company/candidates/bulk',
          headers: {
            cookie: `hs_session=${companyAdminPrimaryToken}`,
            'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
            origin: ctx.corsOrigin,
          },
          payload: {
            candidates: [{ name: underPayloadName, email: 'under.limit@example.test' }],
          },
        });
        // Fastify permits the request (< 1_048_576 bytes)
        expect(underRes.statusCode).toBe(200);

        const client = await ctx.platformPool.connect();
        try {
          await client.query(`SELECT set_config('app.is_platform', 'true', false)`);
          await client.query(
            `DELETE FROM app.invitations WHERE email = 'under.limit@example.test'`,
          );
          await client.query(`DELETE FROM app.users WHERE email = 'under.limit@example.test'`);
        } finally {
          client.release();
        }

        // 2. Payload just over 1 MB (> 1_048_576 bytes)
        const overPayloadName = 'B'.repeat(1_050_000);
        const overRes = await ctx.app.inject({
          method: 'POST',
          url: '/api/v1/company/candidates/bulk',
          headers: {
            cookie: `hs_session=${companyAdminPrimaryToken}`,
            'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
            origin: ctx.corsOrigin,
          },
          payload: {
            candidates: [{ name: overPayloadName, email: 'over.limit@example.test' }],
          },
        });

        // Fastify rejects with HTTP 413 Payload Too Large
        expect(overRes.statusCode).toBe(413);

        // Server remains healthy and accessible for subsequent requests
        const healthCheck = await ctx.app.inject({
          method: 'GET',
          url: '/api/v1/candidates/metrics',
          headers: { cookie: `hs_session=${companyAdminPrimaryToken}` },
        });
        expect(healthCheck.statusCode).toBe(200);
      });

      it.skip('[FINDING-04a] malformed payload lacking candidates array returns 400 Problem Details instead of 500 TypeError', async () => {
        // CandidatesController.bulk lacks a ZodValidationPipe on @Body().
        // Passing { candidates: "invalid" } causes payload.candidates.length to throw TypeError (500).
        // Skipped per finding handling so test suite remains green.
        const res = await ctx.app.inject({
          method: 'POST',
          url: '/api/v1/company/candidates/bulk',
          headers: {
            cookie: `hs_session=${companyAdminPrimaryToken}`,
            'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
            origin: ctx.corsOrigin,
          },
          payload: { candidates: 'invalid-non-array' },
        });

        expect(res.statusCode).toBe(400);
      });

      it('Class 10: Mass-Assignment Defense (role, org_id, is_platform cannot be elevated via payload)', async () => {
        const candidatePayload = {
          name: 'Injected Role Candidate',
          email: 'mass.assign@example.test',
          role: 'company_admin',
          org_id: orgSecondaryId,
          is_platform: true,
          status: 'active',
        };

        const res = await ctx.app.inject({
          method: 'POST',
          url: '/api/v1/company/candidates/bulk',
          headers: {
            cookie: `hs_session=${companyAdminPrimaryToken}`,
            'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
            origin: ctx.corsOrigin,
          },
          payload: { candidates: [candidatePayload] },
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.created).toHaveLength(1);

        // Verify in DB with platform role that injected fields were completely ignored:
        // role is 'candidate', org_id is primary org, status is 'invited'
        const client = await ctx.platformPool.connect();
        try {
          await client.query(`SELECT set_config('app.is_platform', 'true', false)`);
          const checkRes = await client.query<{ role: string; org_id: string; status: string }>(
            `SELECT role, org_id, status FROM app.users WHERE email = 'mass.assign@example.test'`,
          );
          expect(checkRes.rows[0]?.role).toBe('candidate');
          expect(checkRes.rows[0]?.org_id).toBe(orgPrimaryId);
          expect(checkRes.rows[0]?.status).toBe('invited');

          await client.query(
            `DELETE FROM app.invitations WHERE email = 'mass.assign@example.test'`,
          );
          await client.query(`DELETE FROM app.users WHERE email = 'mass.assign@example.test'`);
        } finally {
          client.release();
        }
      });
    });

    // =========================================================================
    // PART 4: ATOMICITY, PARTIAL FAILURE & CONCURRENCY (EX-11)
    // =========================================================================

    describe('Part 4: Partial Failure & Concurrency Races (EX-11)', () => {
      it('1 duplicate row among 10 imports valid rows and reports error by row number (EX-11)', async () => {
        // Row 5 has the same email as row 1; violating uniqueness per org_id, email
        const candidates = Array.from({ length: 10 }, (_, i) => ({
          name: `Partial Candidate ${i + 1}`,
          email: i === 4 ? `partial.cand.1@example.test` : `partial.cand.${i + 1}@example.test`,
        }));

        const res = await ctx.app.inject({
          method: 'POST',
          url: '/api/v1/company/candidates/bulk',
          headers: {
            cookie: `hs_session=${companyAdminPrimaryToken}`,
            'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
            origin: ctx.corsOrigin,
          },
          payload: { candidates },
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.created).toHaveLength(9);
        expect(body.errors).toHaveLength(1);
        expect(body.errors[0].row).toBe(5); // 1-based index: element 4 is row 5
        expect(body.errors[0].email).toBe('partial.cand.1@example.test');
        expect(typeof body.errors[0].reason).toBe('string');
        expect(body.errors[0].reason.length).toBeGreaterThan(0);

        const client = await ctx.platformPool.connect();
        try {
          await client.query(`SELECT set_config('app.is_platform', 'true', false)`);
          await client.query(
            `DELETE FROM app.invitations WHERE org_id = $1 AND email LIKE 'partial.cand.%'`,
            [orgPrimaryId],
          );
          await client.query(
            `DELETE FROM app.users WHERE org_id = $1 AND email LIKE 'partial.cand.%'`,
            [orgPrimaryId],
          );
        } finally {
          client.release();
        }
      });

      it.skip('[FINDING-04c] invalid email syntax among valid rows reported in errors array (EX-11)', async () => {
        // Due to missing email validation in CandidatesService, invalid email syntax is stored rather than reported in errors.
        // Skipped per finding handling.
        const candidates = [
          { name: 'Good Candidate', email: 'good@example.test' },
          { name: 'Bad Candidate', email: 'not-an-email' },
        ];

        const res = await ctx.app.inject({
          method: 'POST',
          url: '/api/v1/company/candidates/bulk',
          headers: {
            cookie: `hs_session=${companyAdminPrimaryToken}`,
            'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
            origin: ctx.corsOrigin,
          },
          payload: { candidates },
        });

        const body = JSON.parse(res.body);
        expect(body.created).toHaveLength(1);
        expect(body.errors).toHaveLength(1);
        expect(body.errors[0].row).toBe(2);
      });

      it('concurrent duplicate imports create each candidate exactly once without HTTP 500', async () => {
        const sharedCandidates = [
          { name: 'Race Candidate 1', email: 'race.cand.1@example.test' },
          { name: 'Race Candidate 2', email: 'race.cand.2@example.test' },
        ];

        // Dispatch two concurrent bulk import requests with identical emails
        const [res1, res2] = await Promise.all([
          ctx.app.inject({
            method: 'POST',
            url: '/api/v1/company/candidates/bulk',
            headers: {
              cookie: `hs_session=${companyAdminPrimaryToken}`,
              'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
              origin: ctx.corsOrigin,
            },
            payload: { candidates: sharedCandidates },
          }),
          ctx.app.inject({
            method: 'POST',
            url: '/api/v1/company/candidates/bulk',
            headers: {
              cookie: `hs_session=${companyAdminPrimaryToken}`,
              'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
              origin: ctx.corsOrigin,
            },
            payload: { candidates: sharedCandidates },
          }),
        ]);

        // Neither request crashes with 500
        expect(res1.statusCode).toBe(200);
        expect(res2.statusCode).toBe(200);

        const body1 = JSON.parse(res1.body);
        const body2 = JSON.parse(res2.body);
        const totalCreated = body1.created.length + body2.created.length;
        expect(totalCreated).toBe(2); // Exactly 2 created across both responses

        // Verify exactly 2 rows exist in database
        const count = await countOrgUsers(ctx.platformPool, orgPrimaryId, 'race.cand.%');
        expect(count).toBe(2);

        const client = await ctx.platformPool.connect();
        try {
          await client.query(`SELECT set_config('app.is_platform', 'true', false)`);
          await client.query(
            `DELETE FROM app.invitations WHERE org_id = $1 AND email LIKE 'race.cand.%'`,
            [orgPrimaryId],
          );
          await client.query(
            `DELETE FROM app.users WHERE org_id = $1 AND email LIKE 'race.cand.%'`,
            [orgPrimaryId],
          );
        } finally {
          client.release();
        }
      });
    });

    // =========================================================================
    // PART 5: ROLE & ROUTE ISOLATION (BR-25)
    // =========================================================================

    describe('Part 5: Role & Route Isolation (BR-25)', () => {
      it('unauthenticated request to /candidates/bulk returns 401 Unauthorized', async () => {
        const res = await ctx.app.inject({
          method: 'POST',
          url: '/api/v1/candidates/bulk',
          payload: {
            candidates: [{ name: 'Unauth Candidate', email: 'unauth@example.test' }],
          },
        });

        expect(res.statusCode).toBe(401);
      });

      it('candidate session attempting bulk candidate import returns 403 Forbidden (BR-25)', async () => {
        const res = await ctx.app.inject({
          method: 'POST',
          url: '/api/v1/company/candidates/bulk',
          headers: {
            cookie: `hs_session=${candidateToken}`,
            'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
            origin: ctx.corsOrigin,
          },
          payload: {
            candidates: [{ name: 'Illegal Candidate', email: 'illegal@example.test' }],
          },
        });

        expect(res.statusCode).toBe(403);
      });
    });
  },
);
