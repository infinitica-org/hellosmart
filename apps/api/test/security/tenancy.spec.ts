import crypto from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import {
  assertZeroTenantLeak,
  createSecurityTestApp,
  injectSecRequest,
  setupSecurityTestData,
  teardownSecurityTestData,
  type SecurityTestContext,
} from './helpers/index.js';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://hs_app:hs_app_local@127.0.0.1:5432/hellosmart_test';
const DATABASE_ADMIN_URL =
  process.env.DATABASE_ADMIN_URL ??
  'postgres://hs_owner:hs_owner_local@127.0.0.1:5432/hellosmart_test';

let app: NestFastifyApplication;
let adminPool: pg.Pool;
let ctx: SecurityTestContext;
let isDbAvailable = false;

async function checkDbConnection(): Promise<boolean> {
  try {
    const probe = new pg.Pool({
      connectionString: DATABASE_URL,
      connectionTimeoutMillis: 3000,
      max: 1,
    });
    const client = await probe.connect();
    await client.query('SELECT 1');
    client.release();
    await probe.end();
    return true;
  } catch {
    return false;
  }
}

isDbAvailable = await checkDbConnection();

describe
  .runIf(isDbAvailable)
  .sequential('[10.1] Multi-Tenant Data Isolation Penetration Tests (BR-01, BR-02)', () => {
    beforeAll(async () => {
      adminPool = new pg.Pool({ connectionString: DATABASE_ADMIN_URL });
      const booted = await createSecurityTestApp();
      app = booted.app;
      ctx = await setupSecurityTestData(app, adminPool);
    }, 45_000);

    afterAll(async () => {
      if (adminPool && ctx) {
        await teardownSecurityTestData(ctx, adminPool);
      }
      if (app) {
        await app.close();
      }
      await adminPool?.end();
    }, 30_000);

    // =========================================================================
    // 1. Template Isolation (BR-02: Private Templates Assigned Per-Tenant)
    // =========================================================================
    describe('1. Template Isolation (BR-02: No Public Marketplace, Strict Private Blueprints)', () => {
      it('control-first: Tenant B admin can view Tenant B assigned template', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: `/api/v1/company/templates/${ctx.templateB.id}`,
          sessionToken: ctx.companyAdminB.sessionToken,
        });

        expect(res.statusCode).toBe(200);
        expect([ctx.templateB.id, ctx.templateB.slug]).toContain(res.json?.id);
      });

      it('cross-tenant: Tenant A admin receives 404 when requesting Tenant B template', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: `/api/v1/company/templates/${ctx.templateB.id}`,
          sessionToken: ctx.companyAdminA.sessionToken,
        });

        expect(res.statusCode).toBe(404);
        assertZeroTenantLeak(res, ctx.allTenantBIdentifiers, {
          excludeTokens: [ctx.templateB.id, ctx.templateB.slug],
        });
      });

      it('no-oracle: Tenant A receives identical error response for Tenant B template vs nonexistent UUID', async () => {
        const nonexistentId = crypto.randomUUID();

        const attackRes = await injectSecRequest(app, {
          method: 'GET',
          url: `/api/v1/company/templates/${ctx.templateB.id}`,
          sessionToken: ctx.companyAdminA.sessionToken,
        });

        const randomRes = await injectSecRequest(app, {
          method: 'GET',
          url: `/api/v1/company/templates/${nonexistentId}`,
          sessionToken: ctx.companyAdminA.sessionToken,
        });

        expect(attackRes.statusCode).toBe(404);
        expect(randomRes.statusCode).toBe(404);
        expect(attackRes.json?.code).toBe(randomRes.json?.code);
        expect(attackRes.json?.title).toBe(randomRes.json?.title);
        expect(attackRes.json?.status).toBe(randomRes.json?.status);
      });

      it('list-isolation: Tenant A admin template list contains only assigned templates, never Tenant B templates', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: '/api/v1/company/templates',
          sessionToken: ctx.companyAdminA.sessionToken,
        });

        expect(res.statusCode).toBe(200);
        assertZeroTenantLeak(res, ctx.allTenantBIdentifiers);

        const items: any[] = Array.isArray(res.json) ? res.json : res.json?.data || [];
        const returnedIds = items.map((t) => t.id);
        expect(returnedIds).not.toContain(ctx.templateB.id);
      });
    });

    // =========================================================================
    // 2. Assessment Isolation (BR-01, BR-03: Version Pinning & Tenant Scoping)
    // =========================================================================
    describe('2. Assessment Isolation (BR-01: Scoped Queries & Zero Data Leaks)', () => {
      it('control-first: Tenant B admin can view Tenant B assessment', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: `/api/v1/company/assessments/${ctx.assessmentB.id}`,
          sessionToken: ctx.companyAdminB.sessionToken,
        });

        expect(res.statusCode).toBe(200);
        expect(res.json).toHaveProperty('id', ctx.assessmentB.id);
      });

      it('cross-tenant read: Tenant A admin receives 404 on Tenant B assessment', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: `/api/v1/company/assessments/${ctx.assessmentB.id}`,
          sessionToken: ctx.companyAdminA.sessionToken,
        });

        expect(res.statusCode).toBe(404);
        assertZeroTenantLeak(res, ctx.allTenantBIdentifiers, {
          excludeTokens: [ctx.assessmentB.id],
        });
      });

      it('cross-tenant mutation: Tenant A admin receives 404 when updating Tenant B assessment brief', async () => {
        const res = await injectSecRequest(app, {
          method: 'PATCH',
          url: `/api/v1/company/assessments/${ctx.assessmentB.id}/brief`,
          sessionToken: ctx.companyAdminA.sessionToken,
          payload: {
            briefOverrides: {
              scenario: 'Hacked scenario override from Tenant A',
            },
          },
        });

        expect(res.statusCode).toBe(404);
        assertZeroTenantLeak(res, ctx.allTenantBIdentifiers, {
          excludeTokens: [ctx.assessmentB.id],
        });

        // Verify no side-effects in database: Tenant B assessment remains intact
        const checkClient = await adminPool.connect();
        try {
          const dbRes = await checkClient.query(
            'SELECT name, brief_overrides FROM app.assessments WHERE id = $1',
            [ctx.assessmentB.id],
          );
          expect(dbRes.rows[0].name).toBe(ctx.assessmentB.name);
          expect(JSON.stringify(dbRes.rows[0].brief_overrides || {})).not.toContain(
            'Hacked scenario',
          );
        } finally {
          checkClient.release();
        }
      });

      it('list-isolation: Tenant A admin assessment list excludes Tenant B assessments', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: '/api/v1/company/assessments',
          sessionToken: ctx.companyAdminA.sessionToken,
        });

        expect(res.statusCode).toBe(200);
        assertZeroTenantLeak(res, ctx.allTenantBIdentifiers);

        const items: any[] = Array.isArray(res.json) ? res.json : res.json?.data || [];
        const ids = items.map((a) => a.id);
        expect(ids).not.toContain(ctx.assessmentB.id);
      });
    });

    // =========================================================================
    // 3. Candidate Isolation across both /candidates and /company/candidates
    // =========================================================================
    describe('3. Candidate Isolation (Dual-Prefix Serving: /candidates and /company/candidates)', () => {
      describe('Prefix: /candidates', () => {
        it('control-first: Tenant B admin can view Tenant B candidate list', async () => {
          const res = await injectSecRequest(app, {
            method: 'GET',
            url: '/api/v1/candidates',
            sessionToken: ctx.companyAdminB.sessionToken,
          });

          expect(res.statusCode).toBe(200);
          const candidates: any[] = Array.isArray(res.json)
            ? res.json
            : res.json?.items || res.json?.data || [];
          expect(candidates.some((c) => c.email === ctx.candidateB.email)).toBe(true);
        });

        it('list-isolation: Tenant A admin querying with wide pagination never sees Tenant B candidate', async () => {
          const res = await injectSecRequest(app, {
            method: 'GET',
            url: '/api/v1/candidates?page=1&limit=1000&status=all',
            sessionToken: ctx.companyAdminA.sessionToken,
          });

          expect(res.statusCode).toBe(200);
          assertZeroTenantLeak(res, ctx.allTenantBIdentifiers);
        });

        it('cross-tenant delete: Tenant A admin receives 404 deleting Tenant B candidate with no side effects', async () => {
          const res = await injectSecRequest(app, {
            method: 'DELETE',
            url: `/api/v1/candidates/${ctx.candidateB.id}`,
            sessionToken: ctx.companyAdminA.sessionToken,
          });

          expect(res.statusCode).toBe(404);
          assertZeroTenantLeak(res, ctx.allTenantBIdentifiers);

          // Verify no side effects in DB
          const client = await adminPool.connect();
          try {
            const dbRes = await client.query(
              'SELECT status, deleted_at FROM app.users WHERE id = $1',
              [ctx.candidateB.id],
            );
            expect(dbRes.rows[0].status).toBe('active');
            expect(dbRes.rows[0].deleted_at).toBeNull();
          } finally {
            client.release();
          }
        });

        it('cross-tenant update: Tenant A admin receives 404 updating Tenant B candidate', async () => {
          const res = await injectSecRequest(app, {
            method: 'PATCH',
            url: `/api/v1/candidates/${ctx.candidateB.id}`,
            sessionToken: ctx.companyAdminA.sessionToken,
            payload: { name: 'Attempted Tenant A Takeover' },
          });

          expect(res.statusCode).toBe(404);
          assertZeroTenantLeak(res, ctx.allTenantBIdentifiers);
        });

        it('cross-tenant resend invite: Tenant A admin receives 404 resending invite for Tenant B candidate', async () => {
          const res = await injectSecRequest(app, {
            method: 'POST',
            url: `/api/v1/candidates/${ctx.candidateB.id}/resend-invite`,
            sessionToken: ctx.companyAdminA.sessionToken,
          });

          expect(res.statusCode).toBe(404);
          assertZeroTenantLeak(res, ctx.allTenantBIdentifiers);
        });

        it('mass-assignment / tenant impersonation: foreign orgId payload rejected by strict schema, valid create strictly caller-scoped', async () => {
          // Step 1: Prove strict schema rejects mass-assignment unknown keys (orgId, org_id) with 422
          const spoofEmail = `spoofed.cand.1.${ctx.nonce}@example.test`;
          const resRejected = await injectSecRequest(app, {
            method: 'POST',
            url: '/api/v1/candidates',
            sessionToken: ctx.companyAdminA.sessionToken,
            payload: {
              name: 'Spoofed Candidate',
              email: spoofEmail,
              orgId: ctx.orgB.id,
              org_id: ctx.orgB.id,
            },
          });

          expect(resRejected.statusCode).toBe(422);
          expect(resRejected.json?.code).toBe('VALIDATION_ERROR');

          // Step 2: Valid candidate creation creates candidate strictly in caller tenant (orgA), never Tenant B
          const validEmail = `valid.cand.1.${ctx.nonce}@example.test`;
          const resValid = await injectSecRequest(app, {
            method: 'POST',
            url: '/api/v1/candidates',
            sessionToken: ctx.companyAdminA.sessionToken,
            payload: {
              name: 'Valid Candidate 1',
              email: validEmail,
            },
          });

          expect(resValid.statusCode).toBe(201);
          const createdId = resValid.json?.id;
          expect(createdId).toBeDefined();
          if (createdId) {
            ctx.trackedUserIds.push(createdId);
          }

          const client = await adminPool.connect();
          try {
            const dbRes = await client.query('SELECT org_id FROM app.users WHERE id = $1', [
              createdId,
            ]);
            expect(dbRes.rows[0].org_id).toBe(ctx.orgA.id);
            expect(dbRes.rows[0].org_id).not.toBe(ctx.orgB.id);
          } finally {
            client.release();
          }
        });
      });

      describe('Prefix: /company/candidates', () => {
        it('control-first: Tenant B admin can view Tenant B candidate list under /company/candidates', async () => {
          const res = await injectSecRequest(app, {
            method: 'GET',
            url: '/api/v1/company/candidates',
            sessionToken: ctx.companyAdminB.sessionToken,
          });

          expect(res.statusCode).toBe(200);
          const candidates: any[] = Array.isArray(res.json)
            ? res.json
            : res.json?.items || res.json?.data || [];
          expect(candidates.some((c) => c.email === ctx.candidateB.email)).toBe(true);
        });

        it('list-isolation: Tenant A admin querying /company/candidates never sees Tenant B candidate', async () => {
          const res = await injectSecRequest(app, {
            method: 'GET',
            url: '/api/v1/company/candidates?page=1&limit=1000&status=all',
            sessionToken: ctx.companyAdminA.sessionToken,
          });

          expect(res.statusCode).toBe(200);
          assertZeroTenantLeak(res, ctx.allTenantBIdentifiers);
        });

        it('cross-tenant delete: Tenant A admin receives 404 deleting Tenant B candidate under /company/candidates', async () => {
          const res = await injectSecRequest(app, {
            method: 'DELETE',
            url: `/api/v1/company/candidates/${ctx.candidateB.id}`,
            sessionToken: ctx.companyAdminA.sessionToken,
          });

          expect(res.statusCode).toBe(404);
          assertZeroTenantLeak(res, ctx.allTenantBIdentifiers);
        });

        it('cross-tenant update: Tenant A admin receives 404 updating Tenant B candidate under /company/candidates', async () => {
          const res = await injectSecRequest(app, {
            method: 'PATCH',
            url: `/api/v1/company/candidates/${ctx.candidateB.id}`,
            sessionToken: ctx.companyAdminA.sessionToken,
            payload: { name: 'Attempted Tenant A Takeover Via Company Prefix' },
          });

          expect(res.statusCode).toBe(404);
          assertZeroTenantLeak(res, ctx.allTenantBIdentifiers);
        });

        it('cross-tenant resend invite: Tenant A admin receives 404 under /company/candidates', async () => {
          const res = await injectSecRequest(app, {
            method: 'POST',
            url: `/api/v1/company/candidates/${ctx.candidateB.id}/resend-invite`,
            sessionToken: ctx.companyAdminA.sessionToken,
          });

          expect(res.statusCode).toBe(404);
          assertZeroTenantLeak(res, ctx.allTenantBIdentifiers);
        });

        it('mass-assignment / tenant impersonation: foreign orgId payload rejected under /company/candidates, valid create strictly caller-scoped', async () => {
          // Step 1: Prove strict schema rejects mass-assignment unknown keys (orgId, org_id) with 422
          const spoofEmail = `spoofed.cand.2.${ctx.nonce}@example.test`;
          const resRejected = await injectSecRequest(app, {
            method: 'POST',
            url: '/api/v1/company/candidates',
            sessionToken: ctx.companyAdminA.sessionToken,
            payload: {
              name: 'Spoofed Candidate 2',
              email: spoofEmail,
              orgId: ctx.orgB.id,
              org_id: ctx.orgB.id,
            },
          });

          expect(resRejected.statusCode).toBe(422);
          expect(resRejected.json?.code).toBe('VALIDATION_ERROR');

          // Step 2: Valid candidate creation creates candidate strictly in caller tenant (orgA)
          const validEmail = `valid.cand.2.${ctx.nonce}@example.test`;
          const resValid = await injectSecRequest(app, {
            method: 'POST',
            url: '/api/v1/company/candidates',
            sessionToken: ctx.companyAdminA.sessionToken,
            payload: {
              name: 'Valid Candidate 2',
              email: validEmail,
            },
          });

          expect(resValid.statusCode).toBe(201);
          const createdId = resValid.json?.id;
          expect(createdId).toBeDefined();
          if (createdId) {
            ctx.trackedUserIds.push(createdId);
          }

          const client = await adminPool.connect();
          try {
            const dbRes = await client.query('SELECT org_id FROM app.users WHERE id = $1', [
              createdId,
            ]);
            expect(dbRes.rows[0].org_id).toBe(ctx.orgA.id);
            expect(dbRes.rows[0].org_id).not.toBe(ctx.orgB.id);
          } finally {
            client.release();
          }
        });
      });
    });

    // =========================================================================
    // 4. Storage Isolation & Artifact Access Penetration Tests
    // =========================================================================
    describe('4. Storage Artifact Isolation & Signed Download URL Security (BR-01, BR-11)', () => {
      it('control-first: Tenant B admin can generate download URL for Tenant B submission artifact', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: `/api/v1/storage/download-url/${ctx.storageAssignmentIdB}/${ctx.storageObjectIdB}`,
          sessionToken: ctx.companyAdminB.sessionToken,
        });

        expect(res.statusCode).toBe(200);
        expect(res.json).toHaveProperty('url');
        expect(res.json).toHaveProperty('expiresInSeconds', 900);
      });

      it('cross-tenant: Tenant A admin requesting Tenant B artifact download URL returns 404 (zero leak)', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: `/api/v1/storage/download-url/${ctx.storageAssignmentIdB}/${ctx.storageObjectIdB}`,
          sessionToken: ctx.companyAdminA.sessionToken,
        });

        expect(res.statusCode).toBe(404);
        expect(res.json?.detail).toBe('Artifact not found');
        assertZeroTenantLeak(res, ctx.allTenantBIdentifiers);
      });

      it('cross-tenant override attempt: Tenant A admin passing ?orgId=TenantB returns 404', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: `/api/v1/storage/download-url/${ctx.storageAssignmentIdB}/${ctx.storageObjectIdB}?orgId=${ctx.orgB.id}`,
          sessionToken: ctx.companyAdminA.sessionToken,
        });

        expect(res.statusCode).toBe(404);
        expect(res.json?.detail).toBe('Artifact not found');
        assertZeroTenantLeak(res, ctx.allTenantBIdentifiers);
      });

      it('mixed pair cross-check: Tenant A assignmentId + Tenant B objectId returns 404', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: `/api/v1/storage/download-url/${ctx.storageAssignmentIdA}/${ctx.storageObjectIdB}`,
          sessionToken: ctx.companyAdminA.sessionToken,
        });

        expect(res.statusCode).toBe(404);
        expect(res.json?.detail).toBe('Artifact not found');
        assertZeroTenantLeak(res, ctx.allTenantBIdentifiers);
      });

      it('mixed pair cross-check: Tenant B assignmentId + Tenant A objectId returns 404', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: `/api/v1/storage/download-url/${ctx.storageAssignmentIdB}/${ctx.storageObjectIdA}`,
          sessionToken: ctx.companyAdminA.sessionToken,
        });

        expect(res.statusCode).toBe(404);
        expect(res.json?.detail).toBe('Artifact not found');
        assertZeroTenantLeak(res, ctx.allTenantBIdentifiers);
      });

      it('no-oracle: error response for foreign object matches nonexistent UUID error response', async () => {
        const randomAssignmentId = crypto.randomUUID();
        const randomObjectId = crypto.randomUUID();

        const attackRes = await injectSecRequest(app, {
          method: 'GET',
          url: `/api/v1/storage/download-url/${ctx.storageAssignmentIdB}/${ctx.storageObjectIdB}`,
          sessionToken: ctx.companyAdminA.sessionToken,
        });

        const randomRes = await injectSecRequest(app, {
          method: 'GET',
          url: `/api/v1/storage/download-url/${randomAssignmentId}/${randomObjectId}`,
          sessionToken: ctx.companyAdminA.sessionToken,
        });

        expect(attackRes.statusCode).toBe(404);
        expect(randomRes.statusCode).toBe(404);
        expect(attackRes.json?.code).toBe(randomRes.json?.code);
        expect(attackRes.json?.title).toBe(randomRes.json?.title);
        expect(attackRes.json?.detail).toBe(randomRes.json?.detail);
      });

      it('public download stream /storage/download rejects invalid or non-local requests with 404', async () => {
        // Missing token
        const resMissing = await injectSecRequest(app, {
          method: 'GET',
          url: '/api/v1/storage/download',
        });
        expect(resMissing.statusCode).toBe(404);

        // Malformed token
        const resMalformed = await injectSecRequest(app, {
          method: 'GET',
          url: '/api/v1/storage/download?token=not-a-valid-hmac-token',
        });
        expect(resMalformed.statusCode).toBe(404);

        // Tampered / synthesized token
        const tamperedToken = Buffer.from(
          JSON.stringify({
            key: ctx.storageKeyB,
            orgId: ctx.orgB.id,
            exp: Math.floor(Date.now() / 1000) + 3600,
          }),
        ).toString('base64url');

        const resTampered = await injectSecRequest(app, {
          method: 'GET',
          url: `/api/v1/storage/download?token=${tamperedToken}.forgedsignature`,
        });
        expect(resTampered.statusCode).toBe(404);
        expect(resTampered.json?.detail).toBe('Artifact not found');
      });
    });

    // =========================================================================
    // 5. Header Forgery & Parameterized Org Scoping
    // =========================================================================
    describe('5. Header Forgery Rejection & Parameterized Route Scoping (OrgScopeGuard)', () => {
      it('header forgery: injecting X-Org-Id or X-Tenant-Id header has zero effect on tenant boundary', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: '/api/v1/company/templates',
          sessionToken: ctx.companyAdminA.sessionToken,
          headers: {
            'x-org-id': ctx.orgB.id,
            'x-tenant-id': ctx.orgB.id,
            'X-Org-Id': ctx.orgB.id,
            'X-Tenant-Id': ctx.orgB.id,
          },
        });

        expect(res.statusCode).toBe(200);
        assertZeroTenantLeak(res, ctx.allTenantBIdentifiers);
      });

      it('parameterized route: OrgScopeGuard allows matching orgId parameter', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: `/api/v1/_test/org/${ctx.orgA.id}/ping`,
          sessionToken: ctx.companyAdminA.sessionToken,
        });

        expect(res.statusCode).toBe(200);
        expect(res.json).toHaveProperty('orgId', ctx.orgA.id);
      });

      it('parameterized route: OrgScopeGuard blocks cross-tenant orgId parameter with 404', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: `/api/v1/_test/org/${ctx.orgB.id}/ping`,
          sessionToken: ctx.companyAdminA.sessionToken,
        });

        expect(res.statusCode).toBe(404);
        expect(res.json?.code).toBe('TENANT_NOT_FOUND');
        assertZeroTenantLeak(res, ctx.allTenantBIdentifiers);
      });
    });

    // =========================================================================
    // 6. Router 404s (Methods with No Defined Endpoint)
    // =========================================================================
    describe('6. Endpoints with no router match (router generic 404 - NOT counted as isolation proofs)', () => {
      it('route does not exist: PATCH /company/templates/:id returns generic router 404', async () => {
        const res = await injectSecRequest(app, {
          method: 'PATCH',
          url: `/api/v1/company/templates/${ctx.templateB.id}`,
          sessionToken: ctx.companyAdminA.sessionToken,
          payload: { name: 'Attempted Patch' },
        });
        expect(res.statusCode).toBe(404);
      });

      it('route does not exist: DELETE /company/templates/:id returns generic router 404', async () => {
        const res = await injectSecRequest(app, {
          method: 'DELETE',
          url: `/api/v1/company/templates/${ctx.templateB.id}`,
          sessionToken: ctx.companyAdminA.sessionToken,
        });
        expect(res.statusCode).toBe(404);
      });

      it('route does not exist: PATCH /company/assessments/:id returns generic router 404', async () => {
        const res = await injectSecRequest(app, {
          method: 'PATCH',
          url: `/api/v1/company/assessments/${ctx.assessmentB.id}`,
          sessionToken: ctx.companyAdminA.sessionToken,
          payload: { name: 'Attempted Patch' },
        });
        expect(res.statusCode).toBe(404);
      });

      it('route does not exist: DELETE /company/assessments/:id returns generic router 404', async () => {
        const res = await injectSecRequest(app, {
          method: 'DELETE',
          url: `/api/v1/company/assessments/${ctx.assessmentB.id}`,
          sessionToken: ctx.companyAdminA.sessionToken,
        });
        expect(res.statusCode).toBe(404);
      });

      it('route does not exist: GET /company/candidates/:id returns generic router 404', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: `/api/v1/company/candidates/${ctx.candidateB.id}`,
          sessionToken: ctx.companyAdminA.sessionToken,
        });
        expect(res.statusCode).toBe(404);
      });

      it('route does not exist: GET /candidates/:id returns generic router 404', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: `/api/v1/candidates/${ctx.candidateB.id}`,
          sessionToken: ctx.companyAdminA.sessionToken,
        });
        expect(res.statusCode).toBe(404);
      });
    });

    // =========================================================================
    // 7. Skipped Tests for Unimplemented Entities (With Specific Blockers)
    // =========================================================================
    describe.skip('7. Future Entity Isolation Tests (Blocked: Entities not yet implemented in backend)', () => {
      it('cross-tenant quote reading (blocked: Stream 8 commercial quoting not yet implemented)', async () => {
        // Pending Quotes & Pricing Engine
      });

      it('cross-tenant submission reading (blocked: Stream 5 reviewer agent engine not yet implemented)', async () => {
        // Pending Stream 5 Submissions table and service
      });

      it('cross-tenant assignment launch (blocked: Stream 2 workspace session provisioning not yet implemented)', async () => {
        // Pending Stream 2 candidate assignment & workspace orchestrator
      });
    });
  });
