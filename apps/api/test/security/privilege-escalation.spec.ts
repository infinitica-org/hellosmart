import crypto from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { SessionService } from '../../src/modules/session/session.service.js';
import {
  createSecurityTestApp,
  EXPECTED_ROUTE_MATRIX,
  extractRegisteredRoutesFromApp,
  injectSecRequest,
  normalizeRoute,
  setupSecurityTestData,
  teardownSecurityTestData,
  CANDIDATE_ROUTE_PREFIXES,
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
let appRegisteredRoutes: Array<{ method: string; url: string }> = [];

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
  .sequential('[10.1] Privilege Escalation & RBAC Boundary Penetration Tests (BR-25)', () => {
    beforeAll(async () => {
      adminPool = new pg.Pool({ connectionString: DATABASE_ADMIN_URL });
      const booted = await createSecurityTestApp();
      app = booted.app;
      ctx = await setupSecurityTestData(app, adminPool);
      appRegisteredRoutes = extractRegisteredRoutesFromApp(app);
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
    // 1. Candidate Privilege Escalation Attacks (BR-25: Candidate Restricted)
    // =========================================================================
    describe('1. Candidate Privilege Escalation Attacks (BR-25: Candidate Boundary)', () => {
      it('candidate accessing /company/templates returns 403 ROLE_FORBIDDEN', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: '/api/v1/company/templates',
          sessionToken: ctx.candidateA.sessionToken,
        });

        expect(res.statusCode).toBe(403);
        expect(res.json?.code).toBe('ROLE_FORBIDDEN');
      });

      it('candidate accessing /company/templates/:id returns 403 ROLE_FORBIDDEN', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: `/api/v1/company/templates/${ctx.templateA.id}`,
          sessionToken: ctx.candidateA.sessionToken,
        });

        expect(res.statusCode).toBe(403);
        expect(res.json?.code).toBe('ROLE_FORBIDDEN');
      });

      it('candidate accessing /company/assessments returns 403 ROLE_FORBIDDEN', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: '/api/v1/company/assessments',
          sessionToken: ctx.candidateA.sessionToken,
        });

        expect(res.statusCode).toBe(403);
        expect(res.json?.code).toBe('ROLE_FORBIDDEN');
      });

      it('candidate attempting to create assessment returns 403 ROLE_FORBIDDEN', async () => {
        const res = await injectSecRequest(app, {
          method: 'POST',
          url: '/api/v1/company/assessments',
          sessionToken: ctx.candidateA.sessionToken,
          payload: {
            name: 'Unauthorized Assessment',
            templateId: ctx.templateA.id,
            templateVersionId: ctx.templateA.versionId,
            workspaceMode: 'cloud',
          },
        });

        expect(res.statusCode).toBe(403);
        expect(res.json?.code).toBe('ROLE_FORBIDDEN');
      });

      for (const item of CANDIDATE_ROUTE_PREFIXES) {
        it(`candidate accessing ${item.prefix} (${item.description}) returns 403 ROLE_FORBIDDEN`, async () => {
          const res = await injectSecRequest(app, {
            method: 'GET',
            url: `/api/v1${item.prefix}`,
            sessionToken: ctx.candidateA.sessionToken,
          });

          expect(res.statusCode).toBe(403);
          expect(res.json?.code).toBe('ROLE_FORBIDDEN');
        });

        it(`candidate attempting to create candidate under ${item.prefix} (${item.description}) returns 403 ROLE_FORBIDDEN`, async () => {
          const res = await injectSecRequest(app, {
            method: 'POST',
            url: `/api/v1${item.prefix}`,
            sessionToken: ctx.candidateA.sessionToken,
            payload: {
              name: 'Unauthorized Candidate',
              email: `unauth.${item.isAlias ? 'alias' : 'canon'}@example.test`,
            },
          });

          expect(res.statusCode).toBe(403);
          expect(res.json?.code).toBe('ROLE_FORBIDDEN');
        });

        it(`candidate attempting to delete candidate under ${item.prefix} (${item.description}) returns 403 ROLE_FORBIDDEN`, async () => {
          const res = await injectSecRequest(app, {
            method: 'DELETE',
            url: `/api/v1${item.prefix}/${ctx.candidateB.id}`,
            sessionToken: ctx.candidateA.sessionToken,
          });

          expect(res.statusCode).toBe(403);
          expect(res.json?.code).toBe('ROLE_FORBIDDEN');
        });
      }

      it('candidate attempting to fetch artifact download URL returns 403 ROLE_FORBIDDEN', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: `/api/v1/storage/download-url/${ctx.storageAssignmentIdA}/${ctx.storageObjectIdA}`,
          sessionToken: ctx.candidateA.sessionToken,
        });

        expect(res.statusCode).toBe(403);
        expect(res.json?.code).toBe('ROLE_FORBIDDEN');
      });

      it('candidate attacking admin routes returns 403 ROLE_FORBIDDEN', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: '/api/v1/admin/organizations',
          sessionToken: ctx.candidateA.sessionToken,
        });

        expect(res.statusCode).toBe(403);
        expect(res.json?.code).toBe('ROLE_FORBIDDEN');
      });
    });

    // =========================================================================
    // 2. Company Admin Privilege Escalation Attacks (Platform Admin Boundary)
    // =========================================================================
    describe('2. Company Admin Privilege Escalation Attacks (Platform Admin Boundary)', () => {
      it('company admin listing organizations in admin console returns 403 ROLE_FORBIDDEN', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: '/api/v1/admin/organizations',
          sessionToken: ctx.companyAdminA.sessionToken,
        });

        expect(res.statusCode).toBe(403);
        expect(res.json?.code).toBe('ROLE_FORBIDDEN');
      });

      it('company admin attempting to provision new organization returns 403 ROLE_FORBIDDEN', async () => {
        const res = await injectSecRequest(app, {
          method: 'POST',
          url: '/api/v1/admin/organizations',
          sessionToken: ctx.companyAdminA.sessionToken,
          payload: {
            name: 'Escalated Org',
            slug: `escalated-org-${ctx.nonce}`,
            adminEmail: `escalated.${ctx.nonce}@example.test`,
            adminName: 'Escalated Admin',
          },
        });

        expect(res.statusCode).toBe(403);
        expect(res.json?.code).toBe('ROLE_FORBIDDEN');
      });

      it('company admin attempting to update organization status returns 403 ROLE_FORBIDDEN', async () => {
        const res = await injectSecRequest(app, {
          method: 'PATCH',
          url: `/api/v1/admin/organizations/${ctx.orgB.id}/status`,
          sessionToken: ctx.companyAdminA.sessionToken,
          payload: { status: 'suspended' },
        });

        expect(res.statusCode).toBe(403);
        expect(res.json?.code).toBe('ROLE_FORBIDDEN');
      });

      it('company admin attempting to access master admin template catalog returns 403 ROLE_FORBIDDEN', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: '/api/v1/admin/templates',
          sessionToken: ctx.companyAdminA.sessionToken,
        });

        expect(res.statusCode).toBe(403);
        expect(res.json?.code).toBe('ROLE_FORBIDDEN');
      });

      it('company admin attempting to access platform metrics returns 403 ROLE_FORBIDDEN', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: '/api/v1/admin/metrics',
          sessionToken: ctx.companyAdminA.sessionToken,
        });

        expect(res.statusCode).toBe(403);
        expect(res.json?.code).toBe('ROLE_FORBIDDEN');
      });

      it('company admin attempting to access platform MFA status returns 403 ROLE_FORBIDDEN', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: '/api/v1/auth/mfa/status',
          sessionToken: ctx.companyAdminA.sessionToken,
        });

        expect(res.statusCode).toBe(403);
        expect(res.json?.code).toBe('ROLE_FORBIDDEN');
      });

      it('control-first: platform admin can view admin metrics', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: '/api/v1/admin/metrics',
          sessionToken: ctx.platformAdmin.sessionToken,
        });

        expect(res.statusCode).toBe(200);
      });
    });

    // =========================================================================
    // 3. Unauthenticated / Tampered Session Token Attacks
    // =========================================================================
    describe('3. Unauthenticated and Malformed Session Security', () => {
      it('missing session token returns 401 UNAUTHORIZED', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: '/api/v1/me',
        });

        expect(res.statusCode).toBe(401);
      });

      it('random fabricated session token returns 401 SESSION_NOT_FOUND', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: '/api/v1/me',
          sessionToken: 'hs_sess_fabricated_random_token_1234567890abcdef',
        });

        expect(res.statusCode).toBe(401);
        expect(['SESSION_EXPIRED', 'SESSION_NOT_FOUND']).toContain(res.json?.code);
      });

      it('synthesized token with invalid signature returns 401 SESSION_NOT_FOUND', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: '/api/v1/me',
          sessionToken: `${ctx.companyAdminA.sessionToken}.tampered`,
        });

        expect(res.statusCode).toBe(401);
      });
    });

    // =========================================================================
    // 4. Anti-CSRF Protection Verification
    // =========================================================================
    describe('4. Anti-CSRF Token and Origin Verification', () => {
      it('mutating request with missing x-hs-csrf header returns 403 CSRF_MISSING_HEADER', async () => {
        const res = await injectSecRequest(app, {
          method: 'POST',
          url: '/api/v1/candidates',
          sessionToken: ctx.companyAdminA.sessionToken,
          omitCsrf: true,
          payload: { name: 'Csrf Test', email: 'csrf@example.test' },
        });

        expect(res.statusCode).toBe(403);
        expect(res.json?.code).toBe('CSRF_TOKEN_MISSING');
      });

      it('mutating request with missing Origin header returns 403 CSRF_MISSING_ORIGIN', async () => {
        const res = await injectSecRequest(app, {
          method: 'POST',
          url: '/api/v1/candidates',
          sessionToken: ctx.companyAdminA.sessionToken,
          omitOrigin: true,
          payload: { name: 'Csrf Test', email: 'csrf@example.test' },
        });

        expect(res.statusCode).toBe(403);
        expect(res.json?.code).toBe('CSRF_ORIGIN_MISSING');
      });

      it('mutating request with untrusted foreign Origin header returns 403 CSRF_INVALID_ORIGIN', async () => {
        const res = await injectSecRequest(app, {
          method: 'POST',
          url: '/api/v1/candidates',
          sessionToken: ctx.companyAdminA.sessionToken,
          customOrigin: 'http://malicious-attacker-website.com',
          payload: { name: 'Csrf Test', email: 'csrf@example.test' },
        });

        expect(res.statusCode).toBe(403);
        expect(res.json?.code).toBe('CSRF_INVALID_ORIGIN');
      });
    });

    // =========================================================================
    // 5. Live DB Account & Organization Status Checks (SessionGuard)
    // =========================================================================
    describe('5. Live Account and Organization Status Verification (SessionGuard fail-closed)', () => {
      it('active session for suspended user returns 403 USER_SUSPENDED', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: '/api/v1/me',
          sessionToken: ctx.suspendedUserA.sessionToken,
        });

        expect(res.statusCode).toBe(403);
        expect(res.json?.code).toBe('USER_SUSPENDED');
      });

      it('active session for soft-deleted user returns 403 USER_DELETED', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: '/api/v1/me',
          sessionToken: ctx.deletedUserA.sessionToken,
        });

        expect(res.statusCode).toBe(403);
        expect(res.json?.code).toBe('USER_DELETED');
      });

      it('active session for user belonging to suspended organization returns 403 ORGANIZATION_SUSPENDED', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: '/api/v1/me',
          sessionToken: ctx.companyAdminC.sessionToken,
        });

        expect(res.statusCode).toBe(403);
        expect(res.json?.code).toBe('ORGANIZATION_SUSPENDED');
      });

      it('active session for user removed from database entirely returns 401 USER_NOT_FOUND', async () => {
        // Create session for non-existent user ID
        const fakeContext = {
          userId: crypto.randomUUID(),
          email: 'ghost@example.test',
          role: 'company_admin' as const,
          orgId: ctx.orgA.id,
        };
        const sessionService = app.get(SessionService);
        const fakeSession = await sessionService.createSession(fakeContext);

        const res = await injectSecRequest(app, {
          method: 'GET',
          url: '/api/v1/me',
          sessionToken: fakeSession.rawToken,
        });

        expect(res.statusCode).toBe(401);
        expect(res.json?.code).toBe('USER_NOT_FOUND');
      });
    });

    // =========================================================================
    // 6. Suspended Account Login Behavior Recording
    // =========================================================================
    describe('6. Suspended Account Login Disclosure Behavior', () => {
      it('calling /auth/login for suspended user returns 403 ACCOUNT_SUSPENDED before password check (current behavior; open question for Vishal V)', async () => {
        const res = await injectSecRequest(app, {
          method: 'POST',
          url: '/api/v1/auth/login',
          payload: {
            email: ctx.suspendedUserA.email,
            password: 'IncorrectPasswordAttempt1!',
          },
        });

        // assertAccountActive fires before password verification, returning 403 ACCOUNT_SUSPENDED
        expect(res.statusCode).toBe(403);
        expect(res.json?.code).toBe('ACCOUNT_SUSPENDED');
      });

      it('calling /auth/login for user in suspended org returns 403 ORG_SUSPENDED before password check (current behavior; open question for Vishal V)', async () => {
        const res = await injectSecRequest(app, {
          method: 'POST',
          url: '/api/v1/auth/login',
          payload: {
            email: ctx.companyAdminC.email,
            password: 'IncorrectPasswordAttempt1!',
          },
        });

        expect(res.statusCode).toBe(403);
        expect(res.json?.code).toBe('ORG_SUSPENDED');
      });

      it.skip('recommended behavior: wrong password on suspended user/org returns 401 INVALID_CREDENTIALS identical to unknown email (blocked on login-order decision; recommended, not yet agreed with Vishal V)', async () => {
        // When implemented: Calling /auth/login with incorrect credentials against an account
        // that is suspended should return HTTP 401 INVALID_CREDENTIALS identical in timing
        // and structure to non-existent accounts, preventing username and status enumeration.
      });

      it.skip('recommended behavior: correct password on suspended user/org returns 403 ACCOUNT_SUSPENDED or ORG_SUSPENDED (blocked on login-order decision; recommended, not yet agreed with Vishal V)', async () => {
        // When implemented: Calling /auth/login with valid credentials should verify the password
        // first, and only THEN return 403 ACCOUNT_SUSPENDED or ORG_SUSPENDED.
      });
    });

    // =========================================================================
    // 7. Dynamic Route Matrix Verification & Dev Controller Registration
    // =========================================================================
    describe('7. Dynamic Route Matrix Verification (All Registered Routes Covered)', () => {
      it('every registered Fastify route is declared and classified in the security matrix', () => {
        const registered =
          appRegisteredRoutes.length > 0
            ? appRegisteredRoutes
            : extractRegisteredRoutesFromApp(app);

        expect(registered.length).toBeGreaterThan(0);

        const unmappedRoutes: string[] = [];

        for (const route of registered) {
          const normalized = normalizeRoute(route.method, route.url);
          if (!EXPECTED_ROUTE_MATRIX[normalized]) {
            unmappedRoutes.push(normalized);
          }
        }

        expect(
          unmappedRoutes,
          `Found registered routes not declared in EXPECTED_ROUTE_MATRIX:\n${unmappedRoutes.join('\n')}`,
        ).toEqual([]);
      });

      it('production route exclusion: NODE_ENV=production registers no /_test controllers in AppModule', async () => {
        const origEnv = process.env.NODE_ENV;
        try {
          process.env.NODE_ENV = 'production';
          vi.resetModules();
          const { AppModule } = await import('../../src/app.module.js');
          const controllers = (Reflect.getMetadata('controllers', AppModule) as any[]) || [];
          const hasDevTest = controllers.some((c: any) => c.name === 'DevTestController');
          expect(hasDevTest).toBe(false);
        } finally {
          process.env.NODE_ENV = origEnv;
          vi.resetModules();
        }
      });

      it.skip('fail-closed: no /_test routes when NODE_ENV is unset or unknown (FINDING: currently registered when NODE_ENV is not "production")', () => {
        // Open question for Vishal V: DevTestController is conditionally registered via:
        // const devControllers = process.env.NODE_ENV === 'production' ? [] : [DevTestController];
        // This is fail-open (registered in staging or if NODE_ENV is unset or set to another value).
        // Recommendation: change to explicit opt-in:
        // const devControllers = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test' ? [DevTestController] : [];
      });
    });
  });
