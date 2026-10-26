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
  });
});
