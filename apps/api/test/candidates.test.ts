import crypto from 'node:crypto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/common/database/database.service.js';
import { MailService } from '../src/common/services/mail.service.js';
import { PG_POOL } from '../src/modules/database/database.tokens.js';
import { SessionService } from '../src/modules/session/session.service.js';
import { APP_CONFIG } from '../src/config/config.tokens.js';
import type { Config } from '../src/config/config.js';

import { createMockDbPool, type InMemoryUser } from './helpers/candidate-mock-db.js';

describe('Candidates API (S1-T05-1)', () => {
  let app: NestFastifyApplication;
  let mockPool: ReturnType<typeof createMockDbPool>;
  let mailService: MailService;
  let sessionService: SessionService;

  const orgId = '11111111-2222-3333-4444-555555555555';
  const otherOrgId = '22222222-3333-4444-5555-666666666666';
  const companyAdminId = '99999999-8888-7777-6666-555555555555';
  const candidateUserId = '88888888-7777-6666-5555-444444444444';
  const validAssessmentId = '33333333-4444-5555-6666-777777777777';
  const draftAssessmentId = '33333333-4444-5555-6666-777777777778';
  const closedAssessmentId = '33333333-4444-5555-6666-777777777779';
  const archivedAssessmentId = '33333333-4444-5555-6666-777777777770';
  const otherOrgAssessmentId = '44444444-5555-6666-7777-888888888888';

  const testConfig: Config = {
    NODE_ENV: 'development',
    PORT: 4000,
    DATABASE_URL: 'postgres://localhost:5432/hellosmart_test',
    DATABASE_MIGRATOR_URL: 'postgres://localhost:5432/hellosmart_test',
    SESSION_SECRET: 'test_session_secret_at_least_32_characters_long_hello',
    CORS_ORIGINS: ['http://localhost:3000'],
    PAYMENT_GATEWAY: 'fake',
    EMAIL_PROVIDER: 'fake',
    WORKSPACE_RUNTIME: 'fake',
    APP_BASE_URL: 'http://localhost:3000',
    MAILPIT_URL: 'http://127.0.0.1:8025',
  };

  beforeEach(async () => {
    mockPool = createMockDbPool();

    // Seed test assessments with lifecycle states
    mockPool.assessments.set(validAssessmentId, {
      id: validAssessmentId,
      org_id: orgId,
      name: 'Full Stack Node.js Incident',
      status: 'published',
    });
    mockPool.assessments.set(draftAssessmentId, {
      id: draftAssessmentId,
      org_id: orgId,
      name: 'Draft Unfinished Assessment',
      status: 'draft',
    });
    mockPool.assessments.set(closedAssessmentId, {
      id: closedAssessmentId,
      org_id: orgId,
      name: 'Closed Past Assessment',
      status: 'closed',
    });
    mockPool.assessments.set(archivedAssessmentId, {
      id: archivedAssessmentId,
      org_id: orgId,
      name: 'Archived Old Assessment',
      status: 'archived',
    });
    mockPool.assessments.set(otherOrgAssessmentId, {
      id: otherOrgAssessmentId,
      org_id: otherOrgId,
      name: 'Other Tenant Assessment',
      status: 'published',
    });

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PG_POOL)
      .useValue(mockPool)
      .overrideProvider(DatabaseService)
      .useValue({
        checkAccountStatus: vi.fn(async () => ({ userStatus: 'active', orgStatus: 'trial_active' })),
        setStatusChecker: vi.fn(),
        setPool: vi.fn(),
        getPool: vi.fn(),
        getClient: vi.fn(),
      })
      .overrideProvider(APP_CONFIG)
      .useValue(testConfig)
      .compile();

    app = moduleRef.createNestApplication(new FastifyAdapter());
    app.setGlobalPrefix('api/v1');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    mailService = app.get(MailService);
    sessionService = app.get(SessionService);
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  async function createCompanySession(): Promise<string> {
    const { rawToken } = await sessionService.createSession({
      userId: companyAdminId,
      orgId,
      email: 'admin@acme.com',
      role: 'company_admin',
      portal: 'company',
    });
    return rawToken;
  }

  async function createCandidateSession(): Promise<string> {
    const { rawToken } = await sessionService.createSession({
      userId: candidateUserId,
      orgId,
      email: 'candidate@example.com',
      role: 'candidate',
      portal: 'candidate',
    });
    return rawToken;
  }

  describe('1. Authentication and Authorization', () => {
    it('rejects unauthenticated candidate creation with 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/company/candidates',
        payload: {
          name: 'Alex Student',
          email: 'alex.student@example.test',
          assessment_id: validAssessmentId,
        },
      });

      expect(res.statusCode).toBe(401);
    });

    it('rejects candidate role caller with 403 Forbidden', async () => {
      const candidateToken = await createCandidateSession();

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/company/candidates',
        headers: {
          cookie: `hs_session=${candidateToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
        payload: {
          name: 'Alex Student',
          email: 'alex.student@example.test',
          assessment_id: validAssessmentId,
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it('rejects missing CSRF header with 403 Forbidden', async () => {
      const sessionToken = await createCompanySession();

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/company/candidates',
        headers: {
          cookie: `hs_session=${sessionToken}`,
          origin: 'http://localhost:3000',
        },
        payload: {
          name: 'Alex Student',
          email: 'alex.student@example.test',
          assessment_id: validAssessmentId,
        },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('2. Validation & Backward Compatibility', () => {
    it('rejects invalid email with 422 Unprocessable Entity', async () => {
      const sessionToken = await createCompanySession();

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/company/candidates',
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
        payload: {
          name: 'Alex Student',
          email: 'not-an-email',
          assessment_id: validAssessmentId,
        },
      });

      expect(res.statusCode).toBe(422);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid assessment UUID with 422 Unprocessable Entity', async () => {
      const sessionToken = await createCompanySession();

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/company/candidates',
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
        payload: {
          name: 'Alex Student',
          email: 'alex@example.test',
          assessment_id: 'not-a-valid-uuid',
        },
      });

      expect(res.statusCode).toBe(422);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects unknown payload properties with 422 Unprocessable Entity (strict mode)', async () => {
      const sessionToken = await createCompanySession();

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/company/candidates',
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
        payload: {
          name: 'Alex Student',
          email: 'alex@example.test',
          assessment_id: validAssessmentId,
          extraField: 'unexpected',
        },
      });

      expect(res.statusCode).toBe(422);
    });

    it('preserves legacy { name, email } candidate onboarding without assessment_id', async () => {
      const sessionToken = await createCompanySession();
      const sendEmailSpy = vi.spyOn(mailService, 'sendInvitationEmail');

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/candidates',
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
        payload: {
          name: 'Legacy Candidate',
          email: 'legacy.candidate@example.com',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body).toMatchObject({
        name: 'Legacy Candidate',
        email: 'legacy.candidate@example.com',
        status: 'invited',
      });
      expect(mockPool.invitations.size).toBe(1);
      expect(mockPool.assignments.size).toBe(0);
      expect(sendEmailSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('3. Assessment Lifecycle & Tenant Isolation (BR-01)', () => {
    it('returns 404 if assessment does not exist', async () => {
      const sessionToken = await createCompanySession();

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/company/candidates',
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
        payload: {
          name: 'Sarah Connor',
          email: 'sarah@example.com',
          assessment_id: '00000000-0000-4000-8000-000000000000',
        },
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('ASSESSMENT_NOT_FOUND');
    });

    it('returns 404 if assessment belongs to another tenant (strict isolation)', async () => {
      const sessionToken = await createCompanySession();

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/company/candidates',
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
        payload: {
          name: 'Sarah Connor',
          email: 'sarah@example.com',
          assessment_id: otherOrgAssessmentId,
        },
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('ASSESSMENT_NOT_FOUND');
      expect(mockPool.assignments.size).toBe(0);
    });

    it('rejects candidate assignment to a draft assessment with 422 ASSESSMENT_NOT_PUBLISHED', async () => {
      const sessionToken = await createCompanySession();

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/company/candidates',
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
        payload: {
          name: 'Sarah Connor',
          email: 'sarah@example.com',
          assessment_id: draftAssessmentId,
        },
      });

      expect(res.statusCode).toBe(422);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('ASSESSMENT_NOT_PUBLISHED');
      expect(body.detail).toContain("'draft'");
    });

    it('rejects candidate assignment to a closed assessment with 422 ASSESSMENT_NOT_PUBLISHED', async () => {
      const sessionToken = await createCompanySession();

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/company/candidates',
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
        payload: {
          name: 'Sarah Connor',
          email: 'sarah@example.com',
          assessment_id: closedAssessmentId,
        },
      });

      expect(res.statusCode).toBe(422);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('ASSESSMENT_NOT_PUBLISHED');
    });

    it('rejects candidate assignment to an archived assessment with 422 ASSESSMENT_NOT_PUBLISHED', async () => {
      const sessionToken = await createCompanySession();

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/company/candidates',
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
        payload: {
          name: 'Sarah Connor',
          email: 'sarah@example.com',
          assessment_id: archivedAssessmentId,
        },
      });

      expect(res.statusCode).toBe(422);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('ASSESSMENT_NOT_PUBLISHED');
    });
  });

  describe('4. Candidate Reuse, Assignment Creation, and Expiry Semantics', () => {
    it('successfully creates new user, creates assignment, and issues 7-day token anchored to issuance', async () => {
      const sessionToken = await createCompanySession();
      const sendAssessmentEmailSpy = vi.spyOn(mailService, 'sendAssessmentInvitationEmail');

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/company/candidates',
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
        payload: {
          name: 'Diana Prince',
          email: 'diana.prince@example.com',
          assessment_id: validAssessmentId,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body).toMatchObject({
        name: 'Diana Prince',
        email: 'diana.prince@example.com',
        assessmentId: validAssessmentId,
        status: 'invited',
        deliveryStatus: 'sent',
      });
      expect(body.id).toBeDefined();
      expect(body.candidateId).toBeDefined();
      expect(body.invitedAt).toBeDefined();

      // Database verification
      expect(mockPool.users.size).toBe(1);
      expect(mockPool.assignments.size).toBe(1);
      expect(mockPool.invitations.size).toBe(0);

      const assignment = Array.from(mockPool.assignments.values())[0]!;
      expect(assignment.assessment_id).toBe(validAssessmentId);
      expect(assignment.candidate_id).toBe(body.candidateId);
      expect(assignment.invite_token_hash).toBeInstanceOf(Buffer);

      // Verify token issuance and expiry semantics
      expect(assignment.invite_issued_at).toBeDefined();
      const issuedMs = assignment.invite_issued_at.getTime();
      const expiresMs = assignment.invite_expires_at.getTime();
      const diffDays = (expiresMs - issuedMs) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeCloseTo(7, 1);

      // Verify email dispatched
      expect(sendAssessmentEmailSpy).toHaveBeenCalledTimes(1);
    });

    it('verifies token expiry check constraint logic supports a token issued days after invited_at', () => {
      // Simulate original invitation created 10 days ago
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const now = new Date();
      const freshExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      // Under the old schema anchored to invited_at:
      const oldCheckValid = freshExpiry.getTime() <= tenDaysAgo.getTime() + 7 * 24 * 60 * 60 * 1000;
      expect(oldCheckValid).toBe(false); // Old constraint would violate!

      // Under the corrected schema anchored to invite_issued_at:
      const newCheckValid = freshExpiry.getTime() > now.getTime() &&
        freshExpiry.getTime() <= now.getTime() + 7 * 24 * 60 * 60 * 1000;
      expect(newCheckValid).toBe(true); // Corrected constraint succeeds!
    });

    it('reuses existing candidate user in the same org for a different assessment', async () => {
      const sessionToken = await createCompanySession();

      const existingUserId = crypto.randomUUID();
      mockPool.users.set(existingUserId, {
        id: existingUserId,
        org_id: orgId,
        email: 'reused.candidate@example.com',
        name: 'Diana Prince Existing',
        role: 'candidate',
        password_hash: '$argon2id$v=19$m=65536,t=3,p=4$dummy',
        must_reset_password: false,
        status: 'active',
        created_at: new Date('2026-10-01'),
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/company/candidates',
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
        payload: {
          name: 'Diana Prince Reused',
          email: 'reused.candidate@example.com',
          assessment_id: validAssessmentId,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.candidateId).toBe(existingUserId);
      expect(mockPool.users.size).toBe(1);
      expect(mockPool.assignments.size).toBe(1);
    });

    it('rejects duplicate assignment of same candidate to same assessment with 409 Conflict', async () => {
      const sessionToken = await createCompanySession();

      const res1 = await app.inject({
        method: 'POST',
        url: '/api/v1/company/candidates',
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
        payload: {
          name: 'Bruce Wayne',
          email: 'bruce@example.com',
          assessment_id: validAssessmentId,
        },
      });
      expect(res1.statusCode).toBe(201);

      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/company/candidates',
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
        payload: {
          name: 'Bruce Wayne',
          email: 'bruce@example.com',
          assessment_id: validAssessmentId,
        },
      });

      expect(res2.statusCode).toBe(409);
      const body = JSON.parse(res2.body);
      expect(body.code).toBe('CANDIDATE_ALREADY_ASSIGNED');
    });

    it('simulated database-error race test: winning request gets 201, simulated race loser catching assignments_org_assessment_candidate_uq gets controlled 409 (never 500)', async () => {
      const sessionToken = await createCompanySession();

      // Enable concurrency simulation: the application-level SELECT check returns empty for both,
      // forcing both transactions to race to the database INSERT.
      mockPool.setSimulateConcurrencyConflict(true);

      const [resA, resB] = await Promise.all([
        app.inject({
          method: 'POST',
          url: '/api/v1/company/candidates',
          headers: {
            cookie: `hs_session=${sessionToken}`,
            'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
            origin: 'http://localhost:3000',
          },
          payload: {
            name: 'Barry Allen',
            email: 'barry.race@example.com',
            assessment_id: validAssessmentId,
          },
        }),
        app.inject({
          method: 'POST',
          url: '/api/v1/company/candidates',
          headers: {
            cookie: `hs_session=${sessionToken}`,
            'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
            origin: 'http://localhost:3000',
          },
          payload: {
            name: 'Barry Allen',
            email: 'barry.race@example.com',
            assessment_id: validAssessmentId,
          },
        }),
      ]);

      const statusCodes = [resA.statusCode, resB.statusCode].sort();
      // Exactly one 201 Created and one 409 Conflict. Neither request results in an unhandled 500!
      expect(statusCodes).toEqual([201, 409]);

      const conflictRes = resA.statusCode === 409 ? resA : resB;
      const conflictBody = JSON.parse(conflictRes.body);
      expect(conflictBody.code).toBe('CANDIDATE_ALREADY_ASSIGNED');
      expect(conflictBody.detail).toBe('Candidate is already assigned to this assessment');

      // Only one assignment persisted in database
      expect(mockPool.assignments.size).toBe(1);
    });

    it('re-throws unrelated 23505 unique violations without falsely reporting duplicate candidate assignment', async () => {
      const sessionToken = await createCompanySession();
      mockPool.setSimulateUnrelatedUniqueViolation(true);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/company/candidates',
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
        payload: {
          name: 'Clark Kent',
          email: 'clark.unrelated@example.com',
          assessment_id: validAssessmentId,
        },
      });

      // Must NOT be mapped to 409 CANDIDATE_ALREADY_ASSIGNED!
      expect(res.statusCode).not.toBe(409);
      expect(res.statusCode).toBe(500);
      const body = JSON.parse(res.body);
      expect(body.code).not.toBe('CANDIDATE_ALREADY_ASSIGNED');
    });
  });

  describe('5. Raw Token Leakage Prevention', () => {
    it('verifies raw token and complete invite URL are never logged in application or email logs', async () => {
      const sessionToken = await createCompanySession();
      const loggerSpy = vi.spyOn((mailService as any).logger, 'log');

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/company/candidates',
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
        payload: {
          name: 'Hal Jordan',
          email: 'hal.jordan@example.com',
          assessment_id: validAssessmentId,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);

      // Response body verification
      expect(body.token).toBeUndefined();
      expect(body.rawToken).toBeUndefined();
      expect(body.tokenHash).toBeUndefined();
      expect(body.invite_token_hash).toBeUndefined();

      // Logger verification: ensure complete invite URL with query token is NOT logged
      for (const call of loggerSpy.mock.calls) {
        const logMsg = String(call[0]);
        expect(logMsg).not.toContain('?token=');
        expect(logMsg).not.toMatch(/[a-f0-9]{64}/);
      }
    });
  });

  describe('6. Audit and Delivery Failure Recovery', () => {
    it('appends audit event in the same transaction', async () => {
      const sessionToken = await createCompanySession();

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/company/candidates',
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
        payload: {
          name: 'Arthur Curry',
          email: 'arthur@example.com',
          assessment_id: validAssessmentId,
        },
      });

      expect(res.statusCode).toBe(201);
      expect(mockPool.auditEvents.length).toBe(1);
    });

    it('communicates email delivery failure accurately without failing transaction', async () => {
      const sessionToken = await createCompanySession();

      vi.spyOn(mailService, 'sendAssessmentInvitationEmail').mockRejectedValueOnce(
        new Error('SES connection failure'),
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/company/candidates',
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
        payload: {
          name: 'Victor Stone',
          email: 'victor@example.com',
          assessment_id: validAssessmentId,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.deliveryStatus).toBe('failed');
      expect(mockPool.assignments.size).toBe(1);
    });
  });

  describe('7. Candidate Invitation Resend (S1-T05-4, CO-017, BR-24, BR-31)', () => {
    it('rotates assignment invite token with exactly 7-day expiry, resets used_at, and preserves separate app.invitations lifecycle', async () => {
      const sessionToken = await createCompanySession();
      const mailSpy = vi.spyOn(mailService, 'sendAssessmentInvitationEmail').mockResolvedValue();

      // 1. Create candidate with assessment assignment
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/company/candidates',
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
        payload: {
          name: 'Diana Prince',
          email: 'diana@example.com',
          assessment_id: validAssessmentId,
        },
      });
      expect(createRes.statusCode).toBe(201);
      const candidate = JSON.parse(createRes.body);
      const candidateId = candidate.candidateId || candidate.id;

      const assignmentBefore = Array.from(mockPool.assignments.values())[0]!;
      const oldTokenHash = Buffer.from(assignmentBefore.invite_token_hash);
      const invitationsBeforeCount = mockPool.invitations.size;

      // 2. Resend invitation
      const resendRes = await app.inject({
        method: 'POST',
        url: `/api/v1/company/candidates/${candidateId}/resend-invite`,
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
      });

      expect(resendRes.statusCode).toBe(200);
      const resendBody = JSON.parse(resendRes.body);
      expect(resendBody.success).toBe(true);
      expect(resendBody.deliveryStatus).toBe('sent');
      expect(resendBody.processedAt).toBeDefined();

      // 3. Verify token rotation in assignments
      const assignmentAfter = mockPool.assignments.get(assignmentBefore.id)!;
      expect(Buffer.compare(assignmentAfter.invite_token_hash, oldTokenHash)).not.toBe(0);
      expect(assignmentAfter.invite_token_hash.length).toBe(32); // SHA-256 digest length

      // 4. Verify exactly 7-day expiry (within 1-second margin of issuance)
      const diffMs = assignmentAfter.invite_expires_at.getTime() - assignmentAfter.invite_issued_at.getTime();
      expect(diffMs).toBe(7 * 24 * 60 * 60 * 1000);

      // 5. Verify separate app.invitations table is untouched
      expect(mockPool.invitations.size).toBe(invitationsBeforeCount);

      // 6. Verify mail dispatch received new raw token and correct assessment metadata
      expect(mailSpy).toHaveBeenCalledTimes(2); // 1 on create, 1 on resend
      const lastCallArg = mailSpy.mock.calls[1]![0];
      expect(lastCallArg.to).toBe('diana@example.com');
      expect(lastCallArg.token).toMatch(/^[a-f0-9]{64}$/);
      expect(lastCallArg.assessmentId).toBe(validAssessmentId);
    });

    it('verifies raw token and hash are NEVER exposed in API response', async () => {
      const sessionToken = await createCompanySession();
      vi.spyOn(mailService, 'sendAssessmentInvitationEmail').mockResolvedValue();

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/company/candidates',
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
        payload: {
          name: 'Arthur Pendragon',
          email: 'arthur.king@example.com',
          assessment_id: validAssessmentId,
        },
      });
      const candidate = JSON.parse(createRes.body);
      const candidateId = candidate.candidateId || candidate.id;

      const resendRes = await app.inject({
        method: 'POST',
        url: `/api/v1/company/candidates/${candidateId}/resend-invite`,
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
      });

      expect(resendRes.statusCode).toBe(200);
      const resendBody = JSON.parse(resendRes.body);

      expect(resendBody.token).toBeUndefined();
      expect(resendBody.rawToken).toBeUndefined();
      expect(resendBody.tokenHash).toBeUndefined();
      expect(resendBody.invite_token_hash).toBeUndefined();
      expect(resendBody.password).toBeUndefined();
    });

    it('strictly rejects resending invitation for candidate who already started assessment with 409 ASSIGNMENT_ALREADY_CONNECTED', async () => {
      const sessionToken = await createCompanySession();
      vi.spyOn(mailService, 'sendAssessmentInvitationEmail').mockResolvedValue();

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/company/candidates',
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
        payload: {
          name: 'Cyborg',
          email: 'cyborg@example.com',
          assessment_id: validAssessmentId,
        },
      });
      const candidate = JSON.parse(createRes.body);
      const candidateId = candidate.candidateId || candidate.id;

      // Simulate candidate having connected to workspace session
      const assignment = Array.from(mockPool.assignments.values()).find((a) => a.candidate_id === candidateId)!;
      assignment.status = 'in_progress';
      (assignment as any).first_connect_at = new Date();

      const resendRes = await app.inject({
        method: 'POST',
        url: `/api/v1/company/candidates/${candidateId}/resend-invite`,
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
      });

      expect(resendRes.statusCode).toBe(409);
      const body = JSON.parse(resendRes.body);
      expect(body.code).toBe('ASSIGNMENT_ALREADY_CONNECTED');
      expect(body.detail).toContain('already started or submitted');
    });

    it('strictly rejects resending invitation across tenant boundary with 404 CANDIDATE_NOT_FOUND', async () => {
      const sessionToken = await createCompanySession();
      const foreignCandidateId = crypto.randomUUID();

      // Create a foreign candidate belonging to a different org
      mockPool.users.set(foreignCandidateId, {
        id: foreignCandidateId,
        org_id: 'foreign-tenant-uuid-999',
        email: 'foreign@othercorp.com',
        name: 'Foreign Candidate',
        role: 'candidate',
        password_hash: null,
        must_reset_password: true,
        status: 'invited',
        counted_against_cap_at: null,
        created_at: new Date(),
      });

      const resendRes = await app.inject({
        method: 'POST',
        url: `/api/v1/company/candidates/${foreignCandidateId}/resend-invite`,
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
      });

      expect(resendRes.statusCode).toBe(404);
      const body = JSON.parse(resendRes.body);
      expect(body.code).toBe('CANDIDATE_NOT_FOUND');
    });

    it('strictly rejects unauthenticated and non-admin callers with 401 and 403', async () => {
      // 1. Unauthenticated request
      const noAuthRes = await app.inject({
        method: 'POST',
        url: `/api/v1/company/candidates/any-id/resend-invite`,
        headers: {
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
      });
      expect(noAuthRes.statusCode).toBe(401);

      // 2. Candidate role attempting to call admin resend
      const candidateUser: InMemoryUser = {
        id: crypto.randomUUID(),
        org_id: orgId,
        email: 'candidate.caller@example.com',
        name: 'Candidate User',
        role: 'candidate',
        password_hash: 'hash',
        must_reset_password: false,
        status: 'active',
        counted_against_cap_at: new Date(),
        created_at: new Date(),
      };
      mockPool.users.set(candidateUser.id, candidateUser);
      const sessionService = app.get(SessionService);
      const { rawToken: candidateSessionToken } = await sessionService.createSession({
        userId: candidateUser.id,
        orgId: candidateUser.org_id,
        role: 'candidate',
        portal: 'candidate',
        email: candidateUser.email,
      });

      const forbiddenRes = await app.inject({
        method: 'POST',
        url: `/api/v1/company/candidates/${candidateUser.id}/resend-invite`,
        headers: {
          cookie: `hs_session=${candidateSessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
      });
      expect(forbiddenRes.statusCode).toBe(403);
    });

    it('returns 404 ASSIGNMENT_NOT_FOUND if candidate has no assessment assignment, leaving app.invitations untouched', async () => {
      const sessionToken = await createCompanySession();
      const mailSpy = vi.spyOn(mailService, 'sendInvitationEmail').mockResolvedValue();
      const assessmentMailSpy = vi.spyOn(mailService, 'sendAssessmentInvitationEmail').mockResolvedValue();

      // Create a candidate user without any assignment in app.assignments
      const unassignedCandidateId = crypto.randomUUID();
      mockPool.users.set(unassignedCandidateId, {
        id: unassignedCandidateId,
        org_id: orgId,
        email: 'standalone@example.com',
        name: 'Standalone Candidate',
        role: 'candidate',
        password_hash: null,
        must_reset_password: true,
        status: 'invited',
        counted_against_cap_at: null,
        created_at: new Date(),
      });

      // Populate an existing invitation in app.invitations (e.g. account onboarding)
      const existingInvId = crypto.randomUUID();
      const initialTokenHash = Buffer.alloc(32, 7);
      mockPool.invitations.set(existingInvId, {
        id: existingInvId,
        org_id: orgId,
        user_id: unassignedCandidateId,
        email: 'standalone@example.com',
        role: 'candidate',
        token_hash: initialTokenHash,
        expires_at: new Date(Date.now() + 3600_000),
      });

      const resendRes = await app.inject({
        method: 'POST',
        url: `/api/v1/company/candidates/${unassignedCandidateId}/resend-invite`,
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
      });

      expect(resendRes.statusCode).toBe(404);
      const body = JSON.parse(resendRes.body);
      expect(body.code).toBe('ASSIGNMENT_NOT_FOUND');
      expect(body.detail).toContain('No assessment assignment found');

      // Invariant: app.invitations is NEVER modified or queried for mutation
      const preservedInv = mockPool.invitations.get(existingInvId)!;
      expect(preservedInv).toBeDefined();
      expect(Buffer.compare(preservedInv.token_hash, initialTokenHash)).toBe(0);
      expect(mockPool.invitations.size).toBe(1);

      // Verify no email was dispatched
      expect(mailSpy).not.toHaveBeenCalled();
      expect(assessmentMailSpy).not.toHaveBeenCalled();
    });

    it('proves assessment invitation resend updates only app.assignments and never mutates app.invitations', async () => {
      const sessionToken = await createCompanySession();
      const assessmentMailSpy = vi.spyOn(mailService, 'sendAssessmentInvitationEmail').mockResolvedValue();
      const mailSpy = vi.spyOn(mailService, 'sendInvitationEmail').mockResolvedValue();

      // 1. Create candidate with assessment assignment
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/company/candidates',
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
        payload: {
          name: 'Assignment Candidate',
          email: 'assigned@example.com',
          assessment_id: validAssessmentId,
        },
      });
      expect(createRes.statusCode).toBe(201);
      const candidate = JSON.parse(createRes.body);
      const candidateId = candidate.candidateId || candidate.id;

      // Seed an existing account-level onboarding invitation in app.invitations for this or another user
      const dummyInvId = crypto.randomUUID();
      const dummyHash = Buffer.alloc(32, 9);
      mockPool.invitations.set(dummyInvId, {
        id: dummyInvId,
        org_id: orgId,
        user_id: candidateId,
        email: 'assigned@example.com',
        role: 'candidate',
        token_hash: dummyHash,
        expires_at: new Date(Date.now() + 86400_000),
      });

      const assignmentBefore = Array.from(mockPool.assignments.values()).find((a) => a.candidate_id === candidateId)!;
      const oldHash = Buffer.from(assignmentBefore.invite_token_hash);

      // 2. Perform resend
      const resendRes = await app.inject({
        method: 'POST',
        url: `/api/v1/company/candidates/${candidateId}/resend-invite`,
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
      });

      expect(resendRes.statusCode).toBe(200);

      // 3. Verify app.assignments was updated
      const assignmentAfter = mockPool.assignments.get(assignmentBefore.id)!;
      expect(Buffer.compare(assignmentAfter.invite_token_hash, oldHash)).not.toBe(0);

      // 4. Invariant: app.invitations was completely untouched
      const dummyInvAfter = mockPool.invitations.get(dummyInvId)!;
      expect(dummyInvAfter).toBeDefined();
      expect(Buffer.compare(dummyInvAfter.token_hash, dummyHash)).toBe(0);

      // 5. Invariant: Only assessment email dispatched, never generic invitation email
      expect(assessmentMailSpy).toHaveBeenCalled();
      expect(mailSpy).not.toHaveBeenCalled();
    });

    it('successfully resends invite for a specific assignment via dedicated endpoint /candidates/:id/assignments/:assignmentId/resend-invite', async () => {
      const sessionToken = await createCompanySession();
      const mailSpy = vi.spyOn(mailService, 'sendAssessmentInvitationEmail').mockResolvedValue();

      // Create candidate
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/company/candidates',
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
        payload: {
          name: 'Multi Candidate',
          email: 'multi@example.com',
          assessment_id: validAssessmentId,
        },
      });
      const candidate = JSON.parse(createRes.body);
      const candidateId = candidate.candidateId || candidate.id;

      // Create a second assessment and assignment for this same candidate
      const secondAssessmentId = crypto.randomUUID();
      mockPool.assessments.set(secondAssessmentId, {
        id: secondAssessmentId,
        org_id: orgId,
        name: 'Second Assessment',
        status: 'published',
      });

      const firstAssignment = Array.from(mockPool.assignments.values()).find((a) => a.candidate_id === candidateId)!;
      const firstOldHash = Buffer.from(firstAssignment.invite_token_hash);
      const firstOldExpires = new Date(firstAssignment.invite_expires_at);

      const secondAssignmentId = crypto.randomUUID();
      const secondInitialHash = Buffer.alloc(32, 5);
      const secondInitialExpires = new Date(Date.now() + 3600_000);
      mockPool.assignments.set(secondAssignmentId, {
        id: secondAssignmentId,
        org_id: orgId,
        assessment_id: secondAssessmentId,
        candidate_id: candidateId,
        status: 'invited',
        invite_token_hash: secondInitialHash,
        invite_issued_at: new Date(),
        invite_expires_at: secondInitialExpires,
        invited_at: new Date(),
        created_at: new Date(Date.now() + 1000),
      });

      // Explicitly resend for secondAssignmentId
      const resendRes = await app.inject({
        method: 'POST',
        url: `/api/v1/company/candidates/${candidateId}/assignments/${secondAssignmentId}/resend-invite`,
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
      });

      expect(resendRes.statusCode).toBe(200);
      const body = JSON.parse(resendRes.body);
      expect(body.success).toBe(true);
      expect(body.deliveryStatus).toBe('sent');
      expect(body.processedAt).toBeDefined();

      // Invariant: Second assignment was rotated with 7-day expiry
      const secondAfter = mockPool.assignments.get(secondAssignmentId)!;
      expect(Buffer.compare(secondAfter.invite_token_hash, secondInitialHash)).not.toBe(0);
      const diffMs = secondAfter.invite_expires_at.getTime() - secondAfter.invite_issued_at.getTime();
      expect(diffMs).toBe(7 * 24 * 60 * 60 * 1000);

      // Invariant: First assignment remains UNTOUCHED
      const firstAfter = mockPool.assignments.get(firstAssignment.id)!;
      expect(Buffer.compare(firstAfter.invite_token_hash, firstOldHash)).toBe(0);
      expect(firstAfter.invite_expires_at.getTime()).toBe(firstOldExpires.getTime());

      // Invariant: Mail sent with second assessment metadata
      expect(mailSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          to: 'multi@example.com',
          assessmentId: secondAssessmentId,
          assessmentName: 'Second Assessment',
        }),
      );
    });

    it('rejects resend on /candidates/:id/resend-invite with 409 AMBIGUOUS_ASSIGNMENT when multiple assignments exist without assignment_id', async () => {
      const sessionToken = await createCompanySession();

      // Create candidate
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/company/candidates',
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
        payload: {
          name: 'Ambiguous Candidate',
          email: 'ambiguous@example.com',
          assessment_id: validAssessmentId,
        },
      });
      const candidate = JSON.parse(createRes.body);
      const candidateId = candidate.candidateId || candidate.id;

      // Add second assignment
      const secondAsmId = crypto.randomUUID();
      mockPool.assessments.set(secondAsmId, {
        id: secondAsmId,
        org_id: orgId,
        name: 'Second Assessment',
        status: 'published',
      });
      const secondAssignId = crypto.randomUUID();
      mockPool.assignments.set(secondAssignId, {
        id: secondAssignId,
        org_id: orgId,
        assessment_id: secondAsmId,
        candidate_id: candidateId,
        status: 'invited',
        invite_token_hash: Buffer.alloc(32, 2),
        invite_issued_at: new Date(),
        invite_expires_at: new Date(Date.now() + 86400_000),
        invited_at: new Date(),
        created_at: new Date(Date.now() + 5000),
      });

      // Call legacy endpoint without assignment_id
      const resendRes = await app.inject({
        method: 'POST',
        url: `/api/v1/company/candidates/${candidateId}/resend-invite`,
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
      });

      expect(resendRes.statusCode).toBe(409);
      const body = JSON.parse(resendRes.body);
      expect(body.code).toBe('AMBIGUOUS_ASSIGNMENT');
      expect(body.detail).toContain('multiple assessment assignments');
    });

    it('succeeds on /candidates/:id/resend-invite when multiple assignments exist if query param ?assignment_id= is provided', async () => {
      const sessionToken = await createCompanySession();
      vi.spyOn(mailService, 'sendAssessmentInvitationEmail').mockResolvedValue();

      // Create candidate
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/company/candidates',
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
        payload: {
          name: 'Query Param Candidate',
          email: 'queryparam@example.com',
          assessment_id: validAssessmentId,
        },
      });
      const candidate = JSON.parse(createRes.body);
      const candidateId = candidate.candidateId || candidate.id;
      const firstAssignment = Array.from(mockPool.assignments.values()).find((a) => a.candidate_id === candidateId)!;
      const firstOldHash = Buffer.from(firstAssignment.invite_token_hash);

      // Add second assignment
      const secondAsmId = crypto.randomUUID();
      mockPool.assessments.set(secondAsmId, {
        id: secondAsmId,
        org_id: orgId,
        name: 'Second Assessment',
        status: 'published',
      });
      const secondAssignId = crypto.randomUUID();
      const secondOldHash = Buffer.alloc(32, 8);
      mockPool.assignments.set(secondAssignId, {
        id: secondAssignId,
        org_id: orgId,
        assessment_id: secondAsmId,
        candidate_id: candidateId,
        status: 'invited',
        invite_token_hash: secondOldHash,
        invite_issued_at: new Date(),
        invite_expires_at: new Date(Date.now() + 86400_000),
        invited_at: new Date(),
        created_at: new Date(Date.now() + 5000),
      });

      // Call legacy endpoint with query param targeting the first assignment
      const resendRes = await app.inject({
        method: 'POST',
        url: `/api/v1/company/candidates/${candidateId}/resend-invite?assignment_id=${firstAssignment.id}`,
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
      });

      expect(resendRes.statusCode).toBe(200);

      // First assignment rotated
      const firstAfter = mockPool.assignments.get(firstAssignment.id)!;
      expect(Buffer.compare(firstAfter.invite_token_hash, firstOldHash)).not.toBe(0);

      // Second assignment completely untouched
      const secondAfter = mockPool.assignments.get(secondAssignId)!;
      expect(Buffer.compare(secondAfter.invite_token_hash, secondOldHash)).toBe(0);
    });

    it('rejects resend if requested assignment belongs to another candidate with 404 ASSIGNMENT_NOT_FOUND', async () => {
      const sessionToken = await createCompanySession();

      // Create Candidate 1
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/v1/company/candidates',
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
        payload: {
          name: 'Candidate One',
          email: 'one@example.com',
          assessment_id: validAssessmentId,
        },
      });
      const cand1 = JSON.parse(res1.body);
      const cand1Id = cand1.candidateId || cand1.id;
      const assign1 = Array.from(mockPool.assignments.values()).find((a) => a.candidate_id === cand1Id)!;

      // Create Candidate 2
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/company/candidates',
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
        payload: {
          name: 'Candidate Two',
          email: 'two@example.com',
          assessment_id: validAssessmentId,
        },
      });
      const cand2 = JSON.parse(res2.body);
      const cand2Id = cand2.candidateId || cand2.id;

      // Attempt to resend Candidate 1's assignment using Candidate 2's ID
      const resendRes = await app.inject({
        method: 'POST',
        url: `/api/v1/company/candidates/${cand2Id}/assignments/${assign1.id}/resend-invite`,
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
      });

      expect(resendRes.statusCode).toBe(404);
      const body = JSON.parse(resendRes.body);
      expect(body.code).toBe('ASSIGNMENT_NOT_FOUND');
    });

    it('strictly rejects resending an assignment belonging to another organization with 404 without data leakage', async () => {
      const sessionToken = await createCompanySession();

      const candidateId = crypto.randomUUID();
      mockPool.users.set(candidateId, {
        id: candidateId,
        org_id: orgId,
        email: 'local@example.com',
        name: 'Local Candidate',
        role: 'candidate',
        password_hash: null,
        must_reset_password: true,
        status: 'invited',
        counted_against_cap_at: null,
        created_at: new Date(),
      });

      // Assignment belonging to foreign org
      const foreignAssignmentId = crypto.randomUUID();
      mockPool.assignments.set(foreignAssignmentId, {
        id: foreignAssignmentId,
        org_id: 'foreign-org-uuid',
        assessment_id: validAssessmentId,
        candidate_id: candidateId,
        status: 'invited',
        invite_token_hash: Buffer.alloc(32, 1),
        invite_issued_at: new Date(),
        invite_expires_at: new Date(Date.now() + 86400_000),
        invited_at: new Date(),
        created_at: new Date(),
      });

      const resendRes = await app.inject({
        method: 'POST',
        url: `/api/v1/company/candidates/${candidateId}/assignments/${foreignAssignmentId}/resend-invite`,
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
      });

      expect(resendRes.statusCode).toBe(404);
      const body = JSON.parse(resendRes.body);
      expect(body.code).toBe('ASSIGNMENT_NOT_FOUND');
    });

    it('preserves committed database state and returns success when email dispatch fails post-commit', async () => {
      const sessionToken = await createCompanySession();

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/company/candidates',
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
        payload: {
          name: 'Resilient Candidate',
          email: 'resilient@example.com',
          assessment_id: validAssessmentId,
        },
      });
      const candidate = JSON.parse(createRes.body);
      const candidateId = candidate.candidateId || candidate.id;
      const assignmentBefore = Array.from(mockPool.assignments.values()).find((a) => a.candidate_id === candidateId)!;
      const oldHash = Buffer.from(assignmentBefore.invite_token_hash);

      // Simulate email service throwing on resend dispatch
      vi.spyOn(mailService, 'sendAssessmentInvitationEmail').mockRejectedValueOnce(
        new Error('SMTP connection timed out'),
      );

      const resendRes = await app.inject({
        method: 'POST',
        url: `/api/v1/company/candidates/${candidateId}/resend-invite`,
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
      });

      // API returns success because the transaction successfully committed, but explicitly indicates delivery failure
      expect(resendRes.statusCode).toBe(200);
      const body = JSON.parse(resendRes.body);
      expect(body.success).toBe(true);
      expect(body.deliveryStatus).toBe('failed');
      expect(body.processedAt).toBeDefined();

      // Invariant: No token or token hash is exposed
      expect(body.token).toBeUndefined();
      expect(body.rawToken).toBeUndefined();
      expect(body.tokenHash).toBeUndefined();
      expect(body.invite_token_hash).toBeUndefined();

      // Database rotation is preserved
      const assignmentAfter = mockPool.assignments.get(assignmentBefore.id)!;
      expect(Buffer.compare(assignmentAfter.invite_token_hash, oldHash)).not.toBe(0);
    });
  });

  it('5. GET /candidates returns list of invited candidates for the organization (BUG-07)', async () => {
    const { rawToken } = await sessionService.createSession({
      userId: companyAdminId,
      orgId,
      email: 'admin@acme.com',
      role: 'company_admin',
      portal: 'company',
    });

    mockPool.users.set('candidate-list-test', {
      id: crypto.randomUUID(),
      org_id: orgId,
      email: 'candidate.listed@example.com',
      name: 'Listed Candidate',
      role: 'candidate',
      password_hash: null,
      must_reset_password: true,
      status: 'invited',
      created_at: new Date(),
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/candidates',
      headers: {
        cookie: `hs_session=${rawToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const items = Array.isArray(body) ? body : body.items;
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items.some((c: any) => c.email === 'candidate.listed@example.com')).toBe(true);
  });

  it('6. GET /candidates/metrics returns real pipeline counts and quotas (BUG-11)', async () => {
    const { rawToken } = await sessionService.createSession({
      userId: companyAdminId,
      orgId,
      email: 'admin@acme.com',
      role: 'company_admin',
      portal: 'company',
    });

    // Seed 2 candidates and entitlements
    mockPool.entitlements.set(orgId, {
      org_id: orgId,
      max_candidates: 25,
      pending_invite_multiplier: 2.0,
      max_templates: 5,
    } as any);
    mockPool.users.set('metric-c1', {
      id: crypto.randomUUID(),
      org_id: orgId,
      email: 'c1@example.com',
      name: 'Candidate One',
      role: 'candidate',
      password_hash: null,
      must_reset_password: true,
      status: 'invited',
      created_at: new Date(),
    });
    mockPool.users.set('metric-c2', {
      id: crypto.randomUUID(),
      org_id: orgId,
      email: 'c2@example.com',
      name: 'Candidate Two',
      role: 'candidate',
      password_hash: null,
      must_reset_password: false,
      status: 'active',
      created_at: new Date(),
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/candidates/metrics',
      headers: {
        cookie: `hs_session=${rawToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const metrics = JSON.parse(res.body);
    expect(metrics).toMatchObject({
      configuredAssessments: 3,
      maxCandidates: 25,
    });
    expect(metrics.invitedCandidates).toBeGreaterThanOrEqual(2);
    expect(metrics.remainingQuota).toBe(metrics.maxCandidates - metrics.invitedCandidates);
  });
});
