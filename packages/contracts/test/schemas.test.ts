import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  LoginDtoSchema,
  SsoVerifyDtoSchema,
  MfaVerifyDtoSchema,
  LogoutResponseDtoSchema,
  UserDtoSchema,
  MeDtoSchema,
  CreateOrgDtoSchema,
  UpdateOrgStatusDtoSchema,
  OrgDtoSchema,
  OrgListItemDtoSchema,
  OrgListQueryDtoSchema,
  PaginatedOrgListDtoSchema,
  AdminMetricsDtoSchema,
  ProblemDetailsSchema,
} from '../dist/index.js';

describe('Contracts - Zod Schemas Unit Tests', () => {
  describe('ProblemDetailsSchema (RFC 7807)', () => {
    it('validates a standard problem details object', () => {
      const problem = {
        type: 'https://hellosmart.ai/problems/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid credentials provided',
        code: 'INVALID_CREDENTIALS',
        instance: '/api/v1/auth/login',
        requestId: 'req_123456',
      };
      const parsed = ProblemDetailsSchema.parse(problem);
      assert.equal(parsed.status, 401);
      assert.equal(parsed.code, 'INVALID_CREDENTIALS');
    });

    it('rejects invalid HTTP status codes outside 100-599', () => {
      assert.throws(() => {
        ProblemDetailsSchema.parse({
          type: 'about:blank',
          title: 'Bad',
          status: 999,
        });
      });
    });
  });

  describe('Auth Schemas', () => {
    it('validates a correct login DTO', () => {
      const valid = { email: 'admin@asterridge.com', password: 'SecretPassword123!' };
      const parsed = LoginDtoSchema.parse(valid);
      assert.equal(parsed.email, 'admin@asterridge.com');
    });

    it('validates login DTO with optional MFA code', () => {
      const valid = { email: 'superadmin@hellosmart.ai', password: 'SecretPassword123!', mfaCode: '123456' };
      const parsed = LoginDtoSchema.parse(valid);
      assert.equal(parsed.mfaCode, '123456');
    });

    it('rejects invalid email and malformed MFA code', () => {
      assert.throws(() => {
        LoginDtoSchema.parse({ email: 'not-an-email', password: 'pwd' });
      }, /Invalid email/);

      assert.throws(() => {
        LoginDtoSchema.parse({ email: 'admin@asterridge.com', password: 'pwd', mfaCode: '123' });
      }, /6 digits/);
    });

    it('validates SSO verification for google and microsoft providers', () => {
      const google = SsoVerifyDtoSchema.parse({ provider: 'google', idToken: 'token_abc123' });
      assert.equal(google.provider, 'google');

      const ms = SsoVerifyDtoSchema.parse({ provider: 'microsoft', idToken: 'token_ms456' });
      assert.equal(ms.provider, 'microsoft');

      assert.throws(() => {
        SsoVerifyDtoSchema.parse({ provider: 'github', idToken: 'token_gh' });
      });
    });

    it('validates MFA verification DTO', () => {
      const valid = MfaVerifyDtoSchema.parse({ preAuthToken: 'preauth_xyz', totpCode: '654321' });
      assert.equal(valid.totpCode, '654321');

      const backup = MfaVerifyDtoSchema.parse({
        preAuthToken: 'preauth_xyz',
        backupCode: 'ABCD-EFGH',
      });
      assert.equal(backup.backupCode, 'ABCD-EFGH');

      const backupNoDash = MfaVerifyDtoSchema.parse({
        preAuthToken: 'preauth_xyz',
        backupCode: 'abcd efgh',
      });
      assert.equal(backupNoDash.backupCode, 'ABCD-EFGH');

      assert.throws(() => {
        MfaVerifyDtoSchema.parse({ preAuthToken: '', totpCode: 'abc' });
      });
    });

    it('validates logout response DTO', () => {
      const res = LogoutResponseDtoSchema.parse({ success: true, message: 'Logged out successfully' });
      assert.equal(res.success, true);
    });
  });

  describe('User & Me Schemas', () => {
    it('validates Me DTO for platform admin, company admin, and candidate', () => {
      const superAdmin = MeDtoSchema.parse({
        id: '11111111-1111-4111-8111-111111111111',
        email: 'superadmin@hellosmart.ai',
        name: 'Platform Admin',
        role: 'platform_admin',
        portal: 'admin',
        mustResetPassword: false,
        org: null,
      });
      assert.equal(superAdmin.role, 'platform_admin');
      assert.equal(superAdmin.portal, 'admin');

      const companyAdmin = MeDtoSchema.parse({
        id: '22222222-2222-4222-8222-222222222222',
        email: 'admin@asterridge.com',
        name: 'Aster Admin',
        role: 'company_admin',
        portal: 'company',
        mustResetPassword: false,
        org: {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          name: 'Aster Ridge Inc.',
          logoUrl: 'https://cdn.hellosmart.ai/aster.png',
        },
      });
      assert.equal(companyAdmin.portal, 'company');
      assert.equal(companyAdmin.org?.name, 'Aster Ridge Inc.');
    });

    it('rejects unknown role in Me DTO', () => {
      assert.throws(() => {
        MeDtoSchema.parse({
          id: '11111111-1111-4111-8111-111111111111',
          email: 'test@example.com',
          name: 'Tester',
          role: 'unknown_role',
          portal: 'company',
          mustResetPassword: false,
        });
      });
    });

    it('validates full User DTO', () => {
      const user = UserDtoSchema.parse({
        id: '33333333-3333-4333-8333-333333333333',
        email: 'candidate@example.com',
        name: 'Candidate One',
        role: 'candidate',
        status: 'active',
        orgId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        createdAt: '2026-10-26T12:00:00Z',
      });
      assert.equal(user.status, 'active');
    });
  });

  describe('Organization Schemas', () => {
    it('validates tenant provisioning CreateOrgDto', () => {
      const createOrg = CreateOrgDtoSchema.parse({
        name: 'Brindle & Co',
        slug: 'brindle-co',
        planId: 'plan_trial',
        retentionDays: 90,
        whiteLabel: false,
        adminEmail: 'admin@brindle.co',
        adminName: 'Brindle Admin',
      });
      assert.equal(createOrg.name, 'Brindle & Co');
      assert.equal(createOrg.slug, 'brindle-co');
      assert.equal(createOrg.retentionDays, 90);
    });

    it('rejects uppercase or invalid characters in org slug', () => {
      assert.throws(() => {
        CreateOrgDtoSchema.parse({
          name: 'Bad Slug Org',
          slug: 'Bad_Slug!',
          adminEmail: 'admin@bad.com',
          adminName: 'Admin',
        });
      }, /lowercase letters, numbers, and hyphens/);
    });

    it('validates UpdateOrgStatusDto', () => {
      const suspended = UpdateOrgStatusDtoSchema.parse({
        status: 'suspended',
        reason: 'Payment delinquency',
      });
      assert.equal(suspended.status, 'suspended');
    });

    it('validates OrgDto', () => {
      const org = OrgDtoSchema.parse({
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        name: 'Aster Ridge',
        slug: 'aster-ridge',
        status: 'paid_active',
        planId: 'plan_enterprise',
        logoUrl: null,
        whiteLabel: true,
        customDomain: 'assess.asterridge.com',
        retentionDays: 180,
        createdAt: '2026-10-01T00:00:00Z',
      });
      assert.equal(org.status, 'paid_active');
      assert.equal(org.customDomain, 'assess.asterridge.com');
    });

    describe('S0-T11-1 Organization List & Admin Metrics Schemas', () => {
      it('validates OrgListItemDto for Aster Ridge (paid_active)', () => {
        const item = OrgListItemDtoSchema.parse({
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          name: 'Aster Ridge Inc.',
          slug: 'aster-ridge',
          status: 'paid_active',
          candidateCount: 18,
          createdAt: '2026-09-15T08:00:00.000Z',
          trialEndsAt: null,
        });
        assert.equal(item.name, 'Aster Ridge Inc.');
        assert.equal(item.status, 'paid_active');
        assert.equal(item.candidateCount, 18);
        assert.equal(item.trialEndsAt, null);
      });

      it('validates OrgListItemDto for Brindle & Co (trial_active with trialEndsAt)', () => {
        const item = OrgListItemDtoSchema.parse({
          id: '00000000-0000-4000-8000-000000000001',
          name: 'Brindle & Co',
          slug: 'brindle-co',
          status: 'trial_active',
          candidateCount: 24,
          createdAt: '2026-10-01T10:00:00.000Z',
          trialEndsAt: '2026-11-01T10:00:00.000Z',
        });
        assert.equal(item.name, 'Brindle & Co');
        assert.equal(item.status, 'trial_active');
        assert.equal(item.candidateCount, 24);
        assert.equal(item.trialEndsAt, '2026-11-01T10:00:00.000Z');
      });

      it('rejects OrgListItemDto with invalid UUID or negative candidateCount', () => {
        assert.throws(() => {
          OrgListItemDtoSchema.parse({
            id: 'not-a-uuid',
            name: 'Apex Labs',
            slug: 'apex-labs',
            status: 'suspended',
            candidateCount: 0,
            createdAt: '2026-08-01T12:00:00.000Z',
          });
        });

        assert.throws(() => {
          OrgListItemDtoSchema.parse({
            id: '00000000-0000-4000-8000-000000000001',
            name: 'Apex Labs',
            slug: 'apex-labs',
            status: 'suspended',
            candidateCount: -5,
            createdAt: '2026-08-01T12:00:00.000Z',
          });
        });
      });

      it('rejects OrgListItemDto with invalid status enum value', () => {
        assert.throws(() => {
          OrgListItemDtoSchema.parse({
            id: '00000000-0000-4000-8000-000000000001',
            name: 'Apex Labs',
            slug: 'apex-labs',
            status: 'unknown_status',
            candidateCount: 0,
            createdAt: '2026-08-01T12:00:00.000Z',
          });
        });
      });

      it('validates OrgListQueryDto defaults and coercion', () => {
        const query = OrgListQueryDtoSchema.parse({});
        assert.equal(query.page, 1);
        assert.equal(query.pageSize, 20);
        assert.equal(query.status, undefined);
        assert.equal(query.search, undefined);

        const coerced = OrgListQueryDtoSchema.parse({
          page: '3',
          pageSize: '50',
          status: 'trial_active',
          search: '  Brindle  ',
        });
        assert.equal(coerced.page, 3);
        assert.equal(coerced.pageSize, 50);
        assert.equal(coerced.status, 'trial_active');
        assert.equal(coerced.search, 'Brindle');
      });

      it('strictly rejects OrgListQueryDto when pageSize exceeds 100 or is negative', () => {
        assert.throws(() => {
          OrgListQueryDtoSchema.parse({ pageSize: 101 });
        }, /Page size cannot exceed 100/);

        assert.throws(() => {
          OrgListQueryDtoSchema.parse({ pageSize: 0 });
        }, /Page size must be at least 1/);

        assert.throws(() => {
          OrgListQueryDtoSchema.parse({ page: 0 });
        }, /Page must be at least 1/);
      });

      it('strictly rejects OrgListQueryDto with invalid status filter', () => {
        assert.throws(() => {
          OrgListQueryDtoSchema.parse({ status: 'invalid_status_enum' });
        });
      });

      it('validates PaginatedOrgListDto structure', () => {
        const paginated = PaginatedOrgListDtoSchema.parse({
          items: [
            {
              id: '00000000-0000-4000-8000-000000000001',
              name: 'Brindle & Co',
              slug: 'brindle-co',
              status: 'trial_active',
              candidateCount: 24,
              createdAt: '2026-10-01T10:00:00.000Z',
              trialEndsAt: '2026-11-01T10:00:00.000Z',
            },
          ],
          page: 1,
          pageSize: 20,
          total: 1,
        });
        assert.equal(paginated.items.length, 1);
        assert.equal(paginated.total, 1);
      });

      it('validates AdminMetricsDto and rejects negative values', () => {
        const metrics = AdminMetricsDtoSchema.parse({
          totalCompanies: 3,
          activeTrials: 1,
          totalCandidates: 42,
        });
        assert.equal(metrics.totalCompanies, 3);
        assert.equal(metrics.activeTrials, 1);
        assert.equal(metrics.totalCandidates, 42);

        assert.throws(() => {
          AdminMetricsDtoSchema.parse({
            totalCompanies: -1,
            activeTrials: 0,
            totalCandidates: 10,
          });
        }, /Total companies cannot be negative/);
      });
    });
  });
});
