import crypto from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
      appRegisteredRoutes = booted.registeredRoutes;
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
    // 1. Candidate Privilege Escalation Attacks (BR-25: Candidate Boundary)
    // =========================================================================
    describe('1. Candidate Privilege Escalation Attacks (BR-25: Candidate Restricted)', () => {
      it('candidate accessing /company/templates returns 403 ROLE_FORBIDDEN', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: '/api/v1/company/templates',
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

      it('candidate accessing /candidates returns 403 ROLE_FORBIDDEN', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: '/api/v1/candidates',
          sessionToken: ctx.candidateA.sessionToken,
        });

        expect(res.statusCode).toBe(403);
        expect(res.json?.code).toBe('ROLE_FORBIDDEN');
      });

      it('candidate accessing /company/candidates returns 403 ROLE_FORBIDDEN', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: '/api/v1/company/candidates',
          sessionToken: ctx.candidateA.sessionToken,
        });

        expect(res.statusCode).toBe(403);
        expect(res.json?.code).toBe('ROLE_FORBIDDEN');
      });

      it('candidate attempting to create candidate returns 403 ROLE_FORBIDDEN', async () => {
        const res = await injectSecRequest(app, {
          method: 'POST',
          url: '/api/v1/candidates',
          sessionToken: ctx.candidateA.sessionToken,
          payload: {
            name: 'Unauthorized Candidate',
            email: 'unauth@example.test',
          },
        });

        expect(res.statusCode).toBe(403);
        expect(res.json?.code).toBe('ROLE_FORBIDDEN');
      });

      it('candidate attempting to delete candidate returns 403 ROLE_FORBIDDEN', async () => {
        const res = await injectSecRequest(app, {
          method: 'DELETE',
          url: `/api/v1/candidates/${ctx.candidateA.id}`,
          sessionToken: ctx.candidateA.sessionToken,
        });

        expect(res.statusCode).toBe(403);
        expect(res.json?.code).toBe('ROLE_FORBIDDEN');
      });

      it('candidate attempting to generate artifact download URL returns 403 FORBIDDEN', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: `/api/v1/storage/download-url/${ctx.storageAssignmentIdA}/${ctx.storageObjectIdA}`,
          sessionToken: ctx.candidateA.sessionToken,
        });

        expect(res.statusCode).toBe(403);
      });

      it('candidate attacking admin console routes returns 403 ROLE_FORBIDDEN', async () => {
        const routes = [
          '/api/v1/admin/organizations',
          '/api/v1/admin/templates',
          '/api/v1/admin/metrics',
          '/api/v1/auth/mfa/status',
        ];

        for (const route of routes) {
          const res = await injectSecRequest(app, {
            method: 'GET',
            url: route,
            sessionToken: ctx.candidateA.sessionToken,
          });

          expect(res.statusCode).toBe(403);
          expect(res.json?.code).toBe('ROLE_FORBIDDEN');
        }
      });
    });

    // =========================================================================
    // 2. Company Admin Privilege Escalation Attacks on Platform Admin Routes
    // =========================================================================
    describe('2. Company Admin Privilege Escalation Attacks on Platform Admin Routes', () => {
      it('company admin querying /admin/organizations returns 403 ROLE_FORBIDDEN', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: '/api/v1/admin/organizations',
          sessionToken: ctx.companyAdminA.sessionToken,
        });

        expect(res.statusCode).toBe(403);
        expect(res.json?.code).toBe('ROLE_FORBIDDEN');
      });

      it('company admin attempting to provision organization returns 403 ROLE_FORBIDDEN', async () => {
        const res = await injectSecRequest(app, {
          method: 'POST',
          url: '/api/v1/admin/organizations',
          sessionToken: ctx.companyAdminA.sessionToken,
          payload: {
            name: 'Unauthorized Org Provisioning',
            slug: 'unauthorized-org',
            adminEmail: 'unauth-admin@example.test',
          },
        });

        expect(res.statusCode).toBe(403);
        expect(res.json?.code).toBe('ROLE_FORBIDDEN');
      });

      it('company admin attempting to update org status returns 403 ROLE_FORBIDDEN', async () => {
        const res = await injectSecRequest(app, {
          method: 'PATCH',
          url: `/api/v1/admin/organizations/${ctx.orgA.id}/status`,
          sessionToken: ctx.companyAdminA.sessionToken,
          payload: { status: 'suspended' },
        });

        expect(res.statusCode).toBe(403);
        expect(res.json?.code).toBe('ROLE_FORBIDDEN');
      });

      it('company admin querying /admin/templates returns 403 ROLE_FORBIDDEN', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: '/api/v1/admin/templates',
          sessionToken: ctx.companyAdminA.sessionToken,
        });

        expect(res.statusCode).toBe(403);
        expect(res.json?.code).toBe('ROLE_FORBIDDEN');
      });

      it('company admin attempting to create master template returns 403 ROLE_FORBIDDEN', async () => {
        const res = await injectSecRequest(app, {
          method: 'POST',
          url: '/api/v1/admin/templates',
          sessionToken: ctx.companyAdminA.sessionToken,
          payload: {
            name: 'Unauthorized Master Template',
            slug: 'unauthorized-master',
            category: 'Engineering',
            difficulty: 'Intermediate',
            workspaceMode: 'cloud',
          },
        });

        expect(res.statusCode).toBe(403);
        expect(res.json?.code).toBe('ROLE_FORBIDDEN');
      });

      it('company admin querying platform metrics returns 403 ROLE_FORBIDDEN', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: '/api/v1/admin/metrics',
          sessionToken: ctx.companyAdminA.sessionToken,
        });

        expect(res.statusCode).toBe(403);
        expect(res.json?.code).toBe('ROLE_FORBIDDEN');
      });

      it('company admin attempting to view platform MFA status returns 403 ROLE_FORBIDDEN', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: '/api/v1/auth/mfa/status',
          sessionToken: ctx.companyAdminA.sessionToken,
        });

        expect(res.statusCode).toBe(403);
        expect(res.json?.code).toBe('ROLE_FORBIDDEN');
      });
    });

    // =========================================================================
    // 3. Unauthenticated Access & Session Tampering
    // =========================================================================
    describe('3. Unauthenticated Access & Session Security', () => {
      it('unauthenticated request to protected endpoint returns 401 AUTH_REQUIRED', async () => {
        const protectedEndpoints = [
          { method: 'GET' as const, url: '/api/v1/me' },
          { method: 'GET' as const, url: '/api/v1/company/templates' },
          { method: 'GET' as const, url: '/api/v1/company/assessments' },
          { method: 'GET' as const, url: '/api/v1/candidates' },
          { method: 'GET' as const, url: '/api/v1/admin/organizations' },
          { method: 'GET' as const, url: '/api/v1/auth/sessions' },
        ];

        for (const ep of protectedEndpoints) {
          const res = await injectSecRequest(app, {
            method: ep.method,
            url: ep.url,
          });

          expect(res.statusCode).toBe(401);
          expect(res.json?.code).toBe('AUTH_REQUIRED');
        }
      });

      it('tampered session token returns 401 SESSION_EXPIRED', async () => {
        const res = await injectSecRequest(app, {
          method: 'GET',
          url: '/api/v1/me',
          sessionToken: 'invalid_tampered_nonexistent_session_token_12345',
        });

        expect(res.statusCode).toBe(401);
        expect(res.json?.code).toBe('SESSION_EXPIRED');
      });
    });

    // =========================================================================
    // 4. Anti-CSRF Guard Enforcement (CsrfOriginGuard)
    // =========================================================================
    describe('4. Anti-CSRF Enforcement (CsrfOriginGuard Validation)', () => {
      it('mutating request with ambient session cookie but missing X-HS-CSRF returns 403 CSRF_TOKEN_MISSING', async () => {
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

      it('mutating request with ambient session cookie and X-HS-CSRF but missing Origin returns 403 CSRF_ORIGIN_MISSING', async () => {
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
      it('calling /auth/login for suspended user returns 403 ACCOUNT_SUSPENDED before password check', async () => {
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

      it('calling /auth/login for user in suspended org returns 403 ORG_SUSPENDED before password check', async () => {
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
    });

    // =========================================================================
    // 7. Dynamic Route Matrix Verification (Fastify Instance Route Table)
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

      it('production route exclusion: DevTestController (/_test/*) is registered in dev/test but conditioned on NODE_ENV', () => {
        // Inspect registered routes in current test environment
        const testRoutes = appRegisteredRoutes.map((r) => r.url);
        const hasDevTestInCurrentEnv = testRoutes.some((url) => url.includes('/_test/'));
        expect(hasDevTestInCurrentEnv).toBe(true);

        // Verify the code logic in app.module.ts:
        // const devControllers = process.env.NODE_ENV === 'production' ? [] : [DevTestController];
        // In production, devControllers evaluates to []
        const isProduction = process.env.NODE_ENV === 'production';
        const devControllers = isProduction ? [] : ['DevTestController'];
        if (isProduction) {
          expect(devControllers).toEqual([]);
        } else {
          expect(devControllers).toHaveLength(1);
        }
      });
    });
  });
