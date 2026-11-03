import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as pg from 'pg';
import * as crypto from 'crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import {
  setupSecurityTestData,
  teardownSecurityTestData,
  createSecurityTestApp,
  injectSecRequest,
  assertZeroTenantLeak,
  checkDbConnection,
  CANDIDATE_ROUTE_PREFIXES,
  type SecurityTestContext,
} from './helpers/index.js';

/**
 * Multi-Tenant Data Isolation & Security Penetration Test Suite
 *
 * Requirements:
 * - BR-01: Tenant Isolation (Every query scoped by org_id; cross-org reads return 404)
 * - BR-02: Template Privacy (Private blueprints assigned per-org; no public catalog)
 * - BR-03: Version Pinning (Draft template versions used in test fixture to allow safe teardown)
 */

let app: NestFastifyApplication;
let adminPool: pg.Pool;
let ctx: SecurityTestContext;
let isDbAvailable = false;

const DATABASE_ADMIN_URL =
  process.env.DATABASE_OWNER_URL ??
  process.env.DATABASE_ADMIN_URL ??
  'postgres://hs_owner:hs_owner_local@127.0.0.1:5432/hellosmart_test';

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
    describe('1. Template Isolation (BR-02: Strict Private Blueprints, ID and Slug Lookup)', () => {
      // --- Control-First Tests ---
      it('control-first: Tenant B admin can view Tenant B assigned template by UUID', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: `/api/v1/company/templates/${ctx.templateB.id}`,
          sessionToken: ctx.companyAdminB.sessionToken,
        });

        expect(res.statusCode).toBe(200);
        expect([ctx.templateB.id, ctx.templateB.slug]).toContain(res.json?.id);
      });

      it('control-first: Tenant B admin can view Tenant B assigned template by slug', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: `/api/v1/company/templates/${ctx.templateB.slug}`,
          sessionToken: ctx.companyAdminB.sessionToken,
        });

        expect(res.statusCode).toBe(200);
        expect([ctx.templateB.id, ctx.templateB.slug]).toContain(res.json?.id);
      });

      it('control-first: Tenant A admin can view Tenant A assigned template by UUID', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: `/api/v1/company/templates/${ctx.templateA.id}`,
          sessionToken: ctx.companyAdminA.sessionToken,
        });

        expect(res.statusCode).toBe(200);
        expect([ctx.templateA.id, ctx.templateA.slug]).toContain(res.json?.id);
      });

      it('control-first: Tenant A admin can view Tenant A assigned template by slug', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: `/api/v1/company/templates/${ctx.templateA.slug}`,
          sessionToken: ctx.companyAdminA.sessionToken,
        });

        expect(res.statusCode).toBe(200);
        expect([ctx.templateA.id, ctx.templateA.slug]).toContain(res.json?.id);
      });

      // --- Cross-Tenant Attacks by UUID and Slug ---
      it('cross-tenant: Tenant A admin receives 404 requesting Tenant B template by UUID (zero leak)', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: `/api/v1/company/templates/${ctx.templateB.id}`,
          sessionToken: ctx.companyAdminA.sessionToken,
        });

        expect(res.statusCode).toBe(404);
        expect(res.json?.code).toBe('TEMPLATE_NOT_FOUND');
        assertZeroTenantLeak(res, ctx.allTenantBIdentifiers, {
          excludeTokens: [ctx.templateB.id, ctx.templateB.slug],
        });
      });

      it('cross-tenant: Tenant A admin receives 404 requesting Tenant B template by slug (zero leak)', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: `/api/v1/company/templates/${ctx.templateB.slug}`,
          sessionToken: ctx.companyAdminA.sessionToken,
        });

        expect(res.statusCode).toBe(404);
        expect(res.json?.code).toBe('TEMPLATE_NOT_FOUND');
        assertZeroTenantLeak(res, ctx.allTenantBIdentifiers, {
          excludeTokens: [ctx.templateB.id, ctx.templateB.slug],
        });
      });

      // --- Unassigned Template Access by UUID and Slug ---
      it('unassigned-template: Tenant A admin receives 404 requesting unassigned template by UUID (zero leak)', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: `/api/v1/company/templates/${ctx.templateUnassigned.id}`,
          sessionToken: ctx.companyAdminA.sessionToken,
        });

        expect(res.statusCode).toBe(404);
        expect(res.json?.code).toBe('TEMPLATE_NOT_FOUND');
        assertZeroTenantLeak(res, [ctx.templateUnassigned.id, ctx.templateUnassigned.slug], {
          excludeTokens: [ctx.templateUnassigned.id, ctx.templateUnassigned.slug],
        });
      });

      it('unassigned-template: Tenant A admin receives 404 requesting unassigned template by slug (zero leak)', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: `/api/v1/company/templates/${ctx.templateUnassigned.slug}`,
          sessionToken: ctx.companyAdminA.sessionToken,
        });

        expect(res.statusCode).toBe(404);
        expect(res.json?.code).toBe('TEMPLATE_NOT_FOUND');
        assertZeroTenantLeak(res, [ctx.templateUnassigned.id, ctx.templateUnassigned.slug], {
          excludeTokens: [ctx.templateUnassigned.id, ctx.templateUnassigned.slug],
        });
      });

      // --- Adversarial and Malformed Slug Requests ---
      it('adversarial slug: UUID-looking non-existent slug returns generic 404', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: '/api/v1/company/templates/00000000-0000-0000-0000-000000000000',
          sessionToken: ctx.companyAdminA.sessionToken,
        });

        expect(res.statusCode).toBe(404);
        expect(res.json?.code).toBe('TEMPLATE_NOT_FOUND');
      });

      it('adversarial slug: very long slug returns generic 404 with no crash', async () => {
        const longSlug = 'a'.repeat(250);
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: `/api/v1/company/templates/${longSlug}`,
          sessionToken: ctx.companyAdminA.sessionToken,
        });

        expect(res.statusCode).toBe(404);
        expect(['TEMPLATE_NOT_FOUND', 'NOT_FOUND']).toContain(res.json?.code);
      });

      it('adversarial slug: URL-encoded slug with special characters returns generic 404', async () => {
        const encodedSlug = encodeURIComponent('invalid/slug?foo=bar#frag');
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: `/api/v1/company/templates/${encodedSlug}`,
          sessionToken: ctx.companyAdminA.sessionToken,
        });

        expect(res.statusCode).toBe(404);
        expect(res.json?.code).toBe('TEMPLATE_NOT_FOUND');
      });

      it('no-oracle: Tenant A receives identical error response for Tenant B template vs nonexistent UUID vs unassigned template', async () => {
        const nonexistentId = crypto.randomUUID();

        const foreignUuidRes = await injectSecRequest(app, {
          method: 'GET',
          url: `/api/v1/company/templates/${ctx.templateB.id}`,
          sessionToken: ctx.companyAdminA.sessionToken,
        });

        const foreignSlugRes = await injectSecRequest(app, {
          method: 'GET',
          url: `/api/v1/company/templates/${ctx.templateB.slug}`,
          sessionToken: ctx.companyAdminA.sessionToken,
        });

        const unassignedUuidRes = await injectSecRequest(app, {
          method: 'GET',
          url: `/api/v1/company/templates/${ctx.templateUnassigned.id}`,
          sessionToken: ctx.companyAdminA.sessionToken,
        });

        const randomRes = await injectSecRequest(app, {
          method: 'GET',
          url: `/api/v1/company/templates/${nonexistentId}`,
          sessionToken: ctx.companyAdminA.sessionToken,
        });

        expect(foreignUuidRes.statusCode).toBe(404);
        expect(foreignSlugRes.statusCode).toBe(404);
        expect(unassignedUuidRes.statusCode).toBe(404);
        expect(randomRes.statusCode).toBe(404);

        expect(foreignUuidRes.json?.code).toBe(randomRes.json?.code);
        expect(foreignSlugRes.json?.code).toBe(randomRes.json?.code);
        expect(unassignedUuidRes.json?.code).toBe(randomRes.json?.code);
        expect(foreignUuidRes.json?.title).toBe(randomRes.json?.title);
        expect(foreignUuidRes.json?.status).toBe(randomRes.json?.status);
      });

      it('list-isolation: Tenant A admin template list contains only assigned templates, never Tenant B or unassigned templates', async () => {
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
        expect(returnedIds).not.toContain(ctx.templateUnassigned.id);
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
    describe('3. Candidate Isolation (Canonical and Alias Route Prefixes)', () => {
      for (const item of CANDIDATE_ROUTE_PREFIXES) {
        const { prefix, isAlias, description } = item;

        describe(`Prefix: ${prefix} (${description})`, () => {
          it(`control-first: Tenant B admin can view Tenant B candidate list under ${prefix}`, async () => {
            const res = await injectSecRequest(app, {
              method: 'GET',
              url: `/api/v1${prefix}`,
              sessionToken: ctx.companyAdminB.sessionToken,
            });

            expect(res.statusCode).toBe(200);
            const candidates: any[] = Array.isArray(res.json)
              ? res.json
              : res.json?.items || res.json?.data || [];
            expect(candidates.some((c) => c.email === ctx.candidateB.email)).toBe(true);
          });

          it(`list-isolation: Tenant A admin querying ${prefix} never sees Tenant B candidate`, async () => {
            const res = await injectSecRequest(app, {
              method: 'GET',
              url: `/api/v1${prefix}?page=1&limit=1000&status=all`,
              sessionToken: ctx.companyAdminA.sessionToken,
            });

            expect(res.statusCode).toBe(200);
            assertZeroTenantLeak(res, ctx.allTenantBIdentifiers);
          });

          it(`cross-tenant delete: Tenant A admin receives 404 deleting Tenant B candidate under ${prefix}`, async () => {
            const res = await injectSecRequest(app, {
              method: 'DELETE',
              url: `/api/v1${prefix}/${ctx.candidateB.id}`,
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

          it(`cross-tenant update: Tenant A admin receives 404 updating Tenant B candidate under ${prefix}`, async () => {
            const res = await injectSecRequest(app, {
              method: 'PATCH',
              url: `/api/v1${prefix}/${ctx.candidateB.id}`,
              sessionToken: ctx.companyAdminA.sessionToken,
              payload: { name: 'Attempted Tenant A Takeover' },
            });

            expect(res.statusCode).toBe(404);
            assertZeroTenantLeak(res, ctx.allTenantBIdentifiers);
          });

          it(`cross-tenant resend invite: Tenant A admin receives 404 under ${prefix}`, async () => {
            const res = await injectSecRequest(app, {
              method: 'POST',
              url: `/api/v1${prefix}/${ctx.candidateB.id}/resend-invite`,
              sessionToken: ctx.companyAdminA.sessionToken,
            });

            expect(res.statusCode).toBe(404);
            assertZeroTenantLeak(res, ctx.allTenantBIdentifiers);
          });

          it(`mass-assignment injection: foreign orgId payload rejected under ${prefix}, valid create strictly caller-scoped`, async () => {
            // Step 1: Prove strict schema rejects mass-assignment unknown keys (orgId, org_id) with 422
            const spoofEmail = `spoofed.${isAlias ? 'alias' : 'canon'}.${ctx.nonce}@example.test`;
            const resRejected = await injectSecRequest(app, {
              method: 'POST',
              url: `/api/v1${prefix}`,
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
            const validEmail = `valid.${isAlias ? 'alias' : 'canon'}.${ctx.nonce}@example.test`;
            const resValid = await injectSecRequest(app, {
              method: 'POST',
              url: `/api/v1${prefix}`,
              sessionToken: ctx.companyAdminA.sessionToken,
              payload: {
                name: `Valid Candidate ${isAlias ? 'Alias' : 'Canon'}`,
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
      }
    });

    // =========================================================================
    // 4. Storage Artifact Isolation & Signed Download URL Security (BR-01)
    // =========================================================================
    describe('4. Storage Artifact Isolation & Signed Download URL Security (BR-01)', () => {
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
      it('cross-tenant quote reading (blocked: quoting and billing entities not yet implemented in backend)', async () => {
        // Pending Quotes & Pricing Engine
      });

      it('cross-tenant submission reading (blocked: submission entities and review pipeline not yet implemented in backend)', async () => {
        // Pending Submissions table and service
      });

      it('cross-tenant assignment launch (blocked: candidate assignment and workspace orchestrator not yet implemented in backend)', async () => {
        // Pending candidate assignment & workspace orchestrator
      });
    });
  });
