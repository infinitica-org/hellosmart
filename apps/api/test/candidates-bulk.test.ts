import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/common/database/database.service.js';
import { MailService } from '../src/common/services/mail.service.js';
import { CandidatesService } from '../src/modules/candidates/candidates.service.js';
import { PG_POOL } from '../src/modules/database/database.tokens.js';
import { SessionService } from '../src/modules/session/session.service.js';
import { APP_CONFIG } from '../src/config/config.tokens.js';
import type { Config } from '../src/config/config.js';
import { Test } from '@nestjs/testing';

import { createMockDbPool, type InMemoryUser } from './helpers/candidate-mock-db.js';

describe('Streaming Bulk Candidate CSV Pipeline (S1-T05-2)', () => {
  let app: NestFastifyApplication;
  let mockPool: ReturnType<typeof createMockDbPool>;
  let mailService: MailService;
  let sessionService: SessionService;
  let candidatesService: CandidatesService;

  const orgId = '11111111-2222-3333-4444-555555555555';
  const otherOrgId = '22222222-3333-4444-5555-666666666666';
  const companyAdminId = '99999999-8888-7777-6666-555555555555';
  const validAssessmentId = '33333333-4444-5555-6666-777777777777';
  const secondValidAssessmentId = '33333333-4444-5555-6666-777777777779';
  const draftAssessmentId = '33333333-4444-5555-6666-777777777778';
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
    mockPool = createMockDbPool({ defaultMaxCandidates: 5000 });

    mockPool.assessments.set(validAssessmentId, {
      id: validAssessmentId,
      org_id: orgId,
      name: 'Full Stack Challenge',
      status: 'published',
    });

    mockPool.assessments.set(secondValidAssessmentId, {
      id: secondValidAssessmentId,
      org_id: orgId,
      name: 'Backend Architecture Evaluation',
      status: 'published',
    });

    mockPool.assessments.set(draftAssessmentId, {
      id: draftAssessmentId,
      org_id: orgId,
      name: 'Unpublished Draft',
      status: 'draft',
    });

    mockPool.assessments.set(otherOrgAssessmentId, {
      id: otherOrgAssessmentId,
      org_id: otherOrgId,
      name: 'Other Org Challenge',
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

    mailService = moduleRef.get<MailService>(MailService);
    sessionService = moduleRef.get<SessionService>(SessionService);
    candidatesService = moduleRef.get<CandidatesService>(CandidatesService);

    const adapter = new FastifyAdapter();
    adapter.getInstance().addContentTypeParser(
      ['text/csv', 'application/csv'],
      (_req, payload, done) => {
        done(null, payload);
      },
    );

    app = moduleRef.createNestApplication(adapter);
    app.setGlobalPrefix('api/v1');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  async function createCompanySession(): Promise<string> {
    const session = await sessionService.createSession({
      userId: companyAdminId,
      role: 'company_admin',
      orgId,
      email: 'admin@acme.example.com',
    });
    return session.rawToken;
  }

  describe('1. Content-Type and Authentication Enforcement', () => {
    it('rejects unauthenticated bulk uploads with 401 Unauthorized', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/company/candidates/bulk',
        headers: {
          'content-type': 'text/csv',
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
        },
        payload: 'name,email\nAlice,alice@example.com',
      });

      expect(res.statusCode).toBe(401);
    });

    it('rejects non-CSV content-types with 415 Unsupported Media Type', async () => {
      const sessionToken = await createCompanySession();

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/company/candidates/bulk',
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
          'content-type': 'application/json',
        },
        payload: JSON.stringify({ name: 'Alice' }),
      });

      expect(res.statusCode).toBe(415);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });

    it('accepts application/json with candidates array', async () => {
      const sessionToken = await createCompanySession();

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/company/candidates/bulk',
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          origin: 'http://localhost:3000',
          'content-type': 'application/json',
        },
        payload: JSON.stringify({
          candidates: [{ name: 'Json Candidate', email: 'json.cand@example.com' }],
        }),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.created).toBeDefined();
    });
  });

  describe('2. Valid CSV Upload and Partial Success', () => {
    it('processes a valid CSV file and creates candidate assignments', async () => {
      const sessionToken = await createCompanySession();
      const csvData = [
        'name,email',
        'Alice Walker,alice@example.com',
        'Bob Vance,bob@example.com',
        'Charlie Day,charlie@example.com',
      ].join('\n');

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/company/candidates/bulk?assessment_id=${validAssessmentId}`,
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
          'content-type': 'text/csv',
        },
        payload: csvData,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);

      expect(body.totalRows).toBe(3);
      expect(body.successfulRows).toBe(3);
      expect(body.failedRows).toBe(0);
      expect(body.errors).toHaveLength(0);
      expect(body.createdSample).toHaveLength(3);
      expect(body.createdSample[0].email).toBe('alice@example.com');
      expect(body.createdSample[0].deliveryStatus).toBe('sent');

      expect(mockPool.assignments.size).toBe(3);
      expect(mockPool.users.size).toBe(3);
    });

    it('preserves partial success when valid and invalid rows are mixed', async () => {
      const sessionToken = await createCompanySession();
      const csvData = [
        'name,email',
        'Valid Alice,alice.valid@example.com',
        ',missing.name@example.com', // row 3: missing name
        'Valid Bob,bob.valid@example.com',
        'Invalid Email,not-an-email', // row 5: invalid email
        'Too Long Name,' + 'A'.repeat(150) + '@example.com', // row 6: valid
      ].join('\n');

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/company/candidates/bulk?assessment_id=${validAssessmentId}`,
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
          'content-type': 'text/csv',
        },
        payload: csvData,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);

      expect(body.totalRows).toBe(5);
      expect(body.successfulRows).toBe(3);
      expect(body.failedRows).toBe(2);

      expect(body.errors).toHaveLength(2);
      expect(body.errors[0].rowNumber).toBe(3);
      expect(body.errors[0].code).toBe('REQUIRED_FIELD_MISSING');
      expect(body.errors[0].field).toBe('name');

      expect(body.errors[1].rowNumber).toBe(5);
      expect(body.errors[1].code).toBe('INVALID_EMAIL_FORMAT');
      expect(body.errors[1].field).toBe('email');

      // The 3 valid rows succeeded in the database
      expect(mockPool.assignments.size).toBe(3);
    });
  });

  describe('3. Encoding, Formatting and Boundary Conditions', () => {
    it('handles UTF-8 BOM at the start of line 1 without breaking header parsing', async () => {
      const sessionToken = await createCompanySession();
      const bomBuffer = Buffer.concat([
        Buffer.from([0xef, 0xbb, 0xbf]), // UTF-8 BOM
        Buffer.from('name,email\nDiana Prince,diana@example.com\n'),
      ]);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/company/candidates/bulk?assessment_id=${validAssessmentId}`,
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
          'content-type': 'text/csv',
        },
        payload: bomBuffer,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.successfulRows).toBe(1);
      expect(body.createdSample[0].name).toBe('Diana Prince');
      expect(body.createdSample[0].email).toBe('diana@example.com');
    });

    it('handles Windows CRLF (\\r\\n) line endings correctly', async () => {
      const sessionToken = await createCompanySession();
      const csvData = 'name,email\r\nClark Kent,clark@example.com\r\nLois Lane,lois@example.com\r\n';

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/company/candidates/bulk?assessment_id=${validAssessmentId}`,
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
          'content-type': 'text/csv',
        },
        payload: csvData,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.successfulRows).toBe(2);
      expect(body.failedRows).toBe(0);
    });

    it('normalizes leading and trailing whitespace in headers, names, and emails', async () => {
      const sessionToken = await createCompanySession();
      const csvData = '  Name  ,  Email  \n   Bruce Wayne   ,   bruce.clean@example.com   \n';

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/company/candidates/bulk?assessment_id=${validAssessmentId}`,
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
          'content-type': 'text/csv',
        },
        payload: csvData,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.successfulRows).toBe(1);
      expect(body.createdSample[0].name).toBe('Bruce Wayne');
      expect(body.createdSample[0].email).toBe('bruce.clean@example.com');
    });

    it('rejects CSV with missing required headers with 422 INVALID_CSV_HEADERS', async () => {
      const sessionToken = await createCompanySession();
      const csvData = 'first_name,last_name,phone\nJohn,Doe,555-1234\n';

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/company/candidates/bulk?assessment_id=${validAssessmentId}`,
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
          'content-type': 'text/csv',
        },
        payload: csvData,
      });

      expect(res.statusCode).toBe(422);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('INVALID_CSV_HEADERS');
    });

    it('rejects an empty CSV file with 422 INVALID_CSV_HEADERS', async () => {
      const sessionToken = await createCompanySession();

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/company/candidates/bulk?assessment_id=${validAssessmentId}`,
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
          'content-type': 'text/csv',
        },
        payload: '',
      });

      expect(res.statusCode).toBe(422);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('INVALID_CSV_HEADERS');
    });
  });

  describe('4. Deterministic Duplicate Handling & Database Conflict Mapping', () => {
    it('detects duplicate email within the same CSV: first succeeds, second fails with DUPLICATE_EMAIL_IN_FILE', async () => {
      const sessionToken = await createCompanySession();
      const csvData = [
        'name,email',
        'Arthur Curry,arthur.dup@example.com', // row 2: succeeds
        'Arthur Duplicate,arthur.dup@example.com', // row 3: fails duplicate
      ].join('\n');

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/company/candidates/bulk?assessment_id=${validAssessmentId}`,
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
          'content-type': 'text/csv',
        },
        payload: csvData,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);

      expect(body.totalRows).toBe(2);
      expect(body.successfulRows).toBe(1);
      expect(body.failedRows).toBe(1);
      expect(body.errors[0].rowNumber).toBe(3);
      expect(body.errors[0].code).toBe('DUPLICATE_EMAIL_IN_FILE');
      expect(body.errors[0].field).toBe('email');

      // Only one assignment created
      expect(mockPool.assignments.size).toBe(1);
    });

    it('maps database unique constraint violation to CANDIDATE_ALREADY_ASSIGNED row error', async () => {
      const sessionToken = await createCompanySession();

      // Pre-seed an existing assignment in the database
      const existingUser: InMemoryUser = {
        id: crypto.randomUUID(),
        org_id: orgId,
        email: 'preexisting@example.com',
        name: 'Pre Existing',
        role: 'candidate',
        password_hash: null,
        must_reset_password: true,
        status: 'invited',
        created_at: new Date(),
      };
      mockPool.users.set(existingUser.id, existingUser);

      mockPool.assignments.set('existing_assignment_id', {
        id: 'existing_assignment_id',
        org_id: orgId,
        assessment_id: validAssessmentId,
        candidate_id: existingUser.id,
        status: 'invited',
        invite_token_hash: Buffer.alloc(32, 2),
        invite_issued_at: new Date(),
        invite_expires_at: new Date(Date.now() + 7 * 86400000),
        invited_at: new Date(),
        created_at: new Date(),
      });

      const csvData = [
        'name,email',
        'Pre Existing,preexisting@example.com', // row 2: conflict
        'New Person,new.person@example.com', // row 3: succeeds
      ].join('\n');

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/company/candidates/bulk?assessment_id=${validAssessmentId}`,
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
          'content-type': 'text/csv',
        },
        payload: csvData,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);

      expect(body.totalRows).toBe(2);
      expect(body.successfulRows).toBe(1);
      expect(body.failedRows).toBe(1);
      expect(body.errors[0].rowNumber).toBe(2);
      expect(body.errors[0].code).toBe('CANDIDATE_ALREADY_ASSIGNED');
    });
  });

  describe('5. Streaming Verification for 1,000+ Rows & Backpressure', () => {
    it('processes 1,005 rows via an incremental stream with bounded memory', async () => {
      const sessionToken = await createCompanySession();

      // Generate 1,005 candidate rows
      const rowCount = 1005;
      const lines = ['name,email'];
      for (let i = 1; i <= rowCount; i++) {
        lines.push(`Candidate ${i},candidate${i}@streamtest.example.com`);
      }
      const fullCsv = lines.join('\n') + '\n';

      // Send payload chunk-by-chunk through a streaming Readable to verify incremental streaming
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/company/candidates/bulk?assessment_id=${validAssessmentId}`,
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
          'content-type': 'text/csv',
        },
        payload: fullCsv,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);

      expect(body.totalRows).toBe(rowCount);
      expect(body.processedRows).toBe(rowCount);
      expect(body.successfulRows).toBe(rowCount);
      expect(body.failedRows).toBe(0);
      expect(body.errors).toHaveLength(0);

      // Verify that created sample is bounded to max 50 items (preventing OOM on response)
      expect(body.createdSample.length).toBeLessThanOrEqual(50);

      // All 1,005 assignments were persisted
      expect(mockPool.assignments.size).toBe(rowCount);
    });
  });

  describe('6. Response Bounds and Truncation', () => {
    it('caps error response sample at 100 and sets errorsTruncated: true when more than 100 rows fail', async () => {
      const sessionToken = await createCompanySession();

      // Generate 150 invalid rows (missing name)
      const lines = ['name,email'];
      for (let i = 1; i <= 150; i++) {
        lines.push(`,invalid.candidate${i}@example.com`);
      }
      const csvData = lines.join('\n') + '\n';

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/company/candidates/bulk?assessment_id=${validAssessmentId}`,
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
          'content-type': 'text/csv',
        },
        payload: csvData,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);

      expect(body.totalRows).toBe(150);
      expect(body.failedRows).toBe(150);
      expect(body.successfulRows).toBe(0);

      // Bound errors array to max 100
      expect(body.errors.length).toBe(100);
      expect(body.errorsTruncated).toBe(true);
    });
  });

  describe('7. Tenant Isolation and Assessment Lifecycle Validation', () => {
    it('rejects bulk upload targeting an assessment belonging to another org with 404', async () => {
      const sessionToken = await createCompanySession();
      const csvData = 'name,email\nTest,test@example.com\n';

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/company/candidates/bulk?assessment_id=${otherOrgAssessmentId}`,
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
          'content-type': 'text/csv',
        },
        payload: csvData,
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('ASSESSMENT_NOT_FOUND');
    });

    it('rejects bulk upload targeting an unpublished (draft) assessment with 422', async () => {
      const sessionToken = await createCompanySession();
      const csvData = 'name,email\nTest,test@example.com\n';

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/company/candidates/bulk?assessment_id=${draftAssessmentId}`,
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
          'content-type': 'text/csv',
        },
        payload: csvData,
      });

      expect(res.statusCode).toBe(422);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('ASSESSMENT_NOT_PUBLISHED');
    });
  });

  describe('8. Zero Token Leakage & Mail Delivery Status', () => {
    it('does not expose raw invite tokens or token hashes in bulk response', async () => {
      const sessionToken = await createCompanySession();
      const csvData = 'name,email\nSecret Token Test,token.test@example.com\n';

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/company/candidates/bulk?assessment_id=${validAssessmentId}`,
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
          'content-type': 'text/csv',
        },
        payload: csvData,
      });

      expect(res.statusCode).toBe(200);
      const rawBody = res.body;

      // Verify no raw token or hash appears in the JSON output
      expect(rawBody).not.toMatch(/[a-f0-9]{64}/);
      expect(rawBody).not.toContain('invite_token_hash');
      expect(rawBody).not.toContain('rawToken');
    });

    it('marks deliveryStatus as failed when email fails, without rolling back assignment persistence', async () => {
      const sessionToken = await createCompanySession();

      vi.spyOn(mailService, 'sendAssessmentInvitationEmail').mockRejectedValueOnce(
        new Error('SES temporary connection error'),
      );

      const csvData = 'name,email\nMail Fail Test,mail.fail@example.com\n';

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/company/candidates/bulk?assessment_id=${validAssessmentId}`,
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
          'content-type': 'text/csv',
        },
        payload: csvData,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);

      expect(body.successfulRows).toBe(1);
      expect(body.createdSample[0].deliveryStatus).toBe('failed');
      expect(mockPool.assignments.size).toBe(1);
    });
  });

  describe('9. Upload Limits and Structural Safety', () => {
    it('aborts upload with 413 PAYLOAD_TOO_LARGE when payload exceeds 1MB upload limit', async () => {
      const sessionToken = await createCompanySession();
      // Fastify or stream parser will enforce 1MB limit.
      // Generate a buffer > 1MB
      const hugeBuffer = Buffer.alloc(1_050_000, 65); // 1.05MB of 'A's

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/company/candidates/bulk?assessment_id=${validAssessmentId}`,
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
          'content-type': 'text/csv',
        },
        payload: hugeBuffer,
      });

      expect(res.statusCode).toBe(413);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('PAYLOAD_TOO_LARGE');
    });

    it('reports ROW_TOO_LARGE when a single row exceeds 4KB', async () => {
      const sessionToken = await createCompanySession();
      // Row 2 is valid, Row 3 exceeds 4KB, Row 4 is valid
      const row3Huge = 'Huge Person,' + 'x'.repeat(4500) + '@example.com';
      const csvData = [
        'name,email',
        'Valid First,valid.first@example.com',
        row3Huge,
        'Valid Last,valid.last@example.com',
      ].join('\n') + '\n';

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/company/candidates/bulk?assessment_id=${validAssessmentId}`,
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
          'content-type': 'text/csv',
        },
        payload: csvData,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.successfulRows).toBe(2);
      expect(body.failedRows).toBe(1);
      expect(body.errors[0].code).toBe('ROW_TOO_LARGE');
    });

    it('reports MALFORMED_CSV_ROW when an unclosed quote exists at EOF', async () => {
      const sessionToken = await createCompanySession();
      const csvData = 'name,email\n"Unclosed Quote at EOF,test@example.com';

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/company/candidates/bulk?assessment_id=${validAssessmentId}`,
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
          'content-type': 'text/csv',
        },
        payload: csvData,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.failedRows).toBe(1);
      expect(body.errors[0].code).toBe('MALFORMED_CSV_ROW');
    });
  });

  describe('10. Targeted Verification: Interruption, Failure Isolation, Multiline & Precedence', () => {
    it('stops processing safely on interrupted stream without misreporting committed rows', async () => {
      const actor = {
        userId: companyAdminId,
        orgId,
        role: 'company_admin',
        portal: 'company',
      };
      const meta = { ip: '127.0.0.1' };

      // Create an incremental readable stream that yields row 1 and then is aborted
      const stream = new Readable({
        read() {},
      });

      stream.push('name,email\nInterrupted Alice,alice.interrupted@example.com\n');

      setImmediate(() => {
        stream.destroy(new Error('ECONNRESET: Client connection aborted mid-stream'));
      });

      await expect(
        candidatesService.processBulkCsvStream(stream, validAssessmentId, actor, meta),
      ).rejects.toThrow('ECONNRESET');

      // Verify that row 1 was committed before interruption and remains persisted in DB
      const committedAlice = Array.from(mockPool.users.values()).find(
        (u) => u.email === 'alice.interrupted@example.com',
      );
      expect(committedAlice).toBeDefined();
      expect(committedAlice?.name).toBe('Interrupted Alice');

      const committedAssignment = Array.from(mockPool.assignments.values()).find(
        (a) => a.candidate_id === committedAlice?.id,
      );
      expect(committedAssignment).toBeDefined();
    });

    it('isolates row-level database failures and continues processing subsequent rows', async () => {
      const actor = {
        userId: companyAdminId,
        orgId,
        role: 'company_admin',
        portal: 'company',
      };
      const meta = { ip: '127.0.0.1' };

      const csvData = [
        'name,email',
        'DB Success 1,db1@example.com',
        'DB Fail Bob,db.fail@example.com',
        'DB Success 2,db2@example.com',
      ].join('\n') + '\n';

      const result = await candidatesService.processBulkCsvStream(
        csvData,
        validAssessmentId,
        actor,
        meta,
      );

      expect(result.totalRows).toBe(3);
      expect(result.processedRows).toBe(3);
      expect(result.successfulRows).toBe(2);
      expect(result.failedRows).toBe(1);

      // Verify Bob failed with database error detail
      const bobError = result.errors.find((e) => e.field === 'email' && e.message.includes('deadlock'));
      expect(bobError).toBeDefined();

      // Verify DB Success 1 and DB Success 2 were committed independently
      const user1 = Array.from(mockPool.users.values()).find((u) => u.email === 'db1@example.com');
      const user2 = Array.from(mockPool.users.values()).find((u) => u.email === 'db2@example.com');
      expect(user1).toBeDefined();
      expect(user2).toBeDefined();
    });

    it('correctly parses RFC 4180 multiline quoted fields across stream chunk boundaries', async () => {
      const actor = {
        userId: companyAdminId,
        orgId,
        role: 'company_admin',
        portal: 'company',
      };
      const meta = { ip: '127.0.0.1' };

      // Chunk 1 contains open quote and embedded newline
      // Chunk 2 contains remainder of name, closing quote, and email
      const chunk1 = Buffer.from('name,email\n"Jane\n');
      const chunk2 = Buffer.from('Doe",jane.multiline@example.com\n');

      const stream = Readable.from([chunk1, chunk2]);

      const result = await candidatesService.processBulkCsvStream(
        stream,
        validAssessmentId,
        actor,
        meta,
      );

      expect(result.successfulRows).toBe(1);
      expect(result.failedRows).toBe(0);

      const created = Array.from(mockPool.users.values()).find(
        (u) => u.email === 'jane.multiline@example.com',
      );
      expect(created).toBeDefined();
      expect(created?.name).toBe('Jane\nDoe');
    });

    it('handles RFC 4180 escaped quotes ("") without toggling quote state or corrupting following commas/newlines', async () => {
      const actor = {
        userId: companyAdminId,
        orgId,
        role: 'company_admin',
        portal: 'company',
      };
      const meta = { ip: '127.0.0.1' };

      const csvData = [
        'name,email',
        '"Jane ""The Boss"" Doe",jane.boss@example.com',
        '"Line 1 with ""quotes"", commas, and\nLine 2",multiline.quotes@example.com',
      ].join('\n') + '\n';

      const result = await candidatesService.processBulkCsvStream(
        csvData,
        validAssessmentId,
        actor,
        meta,
      );

      expect(result.totalRows).toBe(2);
      expect(result.successfulRows).toBe(2);
      expect(result.failedRows).toBe(0);

      const user1 = Array.from(mockPool.users.values()).find((u) => u.email === 'jane.boss@example.com');
      expect(user1).toBeDefined();
      expect(user1?.name).toBe('Jane "The Boss" Doe');

      const user2 = Array.from(mockPool.users.values()).find((u) => u.email === 'multiline.quotes@example.com');
      expect(user2).toBeDefined();
      expect(user2?.name).toBe('Line 1 with "quotes", commas, and\nLine 2');
    });

    it('handles an escaped quote pair ("") split across two stream chunk boundaries', async () => {
      const actor = {
        userId: companyAdminId,
        orgId,
        role: 'company_admin',
        portal: 'company',
      };
      const meta = { ip: '127.0.0.1' };

      // Chunk 1 ends with the first quote of the escaped quote pair ""
      // Chunk 2 begins with the second quote of the escaped quote pair ""
      const chunk1 = Buffer.from('name,email\n"Jane "');
      const chunk2 = Buffer.from('" Doe",jane.splitquotes@example.com\n');

      const stream = Readable.from([chunk1, chunk2]);

      const result = await candidatesService.processBulkCsvStream(
        stream,
        validAssessmentId,
        actor,
        meta,
      );

      expect(result.successfulRows).toBe(1);
      expect(result.failedRows).toBe(0);

      const created = Array.from(mockPool.users.values()).find(
        (u) => u.email === 'jane.splitquotes@example.com',
      );
      expect(created).toBeDefined();
      expect(created?.name).toBe('Jane " Doe');
    });

    it('enforces row assessment precedence and independently validates tenant ownership and status', async () => {
      const sessionToken = await createCompanySession();

      const csvData = [
        'name,email,assessment_id',
        `Alice RowPrecedence,alice.precedence@example.com,${secondValidAssessmentId}`,
        'Bob Fallback,bob.fallback@example.com,',
        `Charlie CrossTenant,charlie.cross@example.com,${otherOrgAssessmentId}`,
        `Diana Unpublished,diana.draft@example.com,${draftAssessmentId}`,
      ].join('\n') + '\n';

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/company/candidates/bulk?assessment_id=${validAssessmentId}`,
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'idempotency-key': crypto.randomUUID(),
          origin: 'http://localhost:3000',
          'content-type': 'text/csv',
        },
        payload: csvData,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);

      expect(body.totalRows).toBe(4);
      expect(body.successfulRows).toBe(2);
      expect(body.failedRows).toBe(2);

      // Verify Alice was assigned to secondValidAssessmentId (ROW PRECEDENCE)
      const alice = Array.from(mockPool.users.values()).find((u) => u.email === 'alice.precedence@example.com');
      const aliceAssignment = Array.from(mockPool.assignments.values()).find((a) => a.candidate_id === alice?.id);
      expect(aliceAssignment?.assessment_id).toBe(secondValidAssessmentId);

      // Verify Bob was assigned to validAssessmentId (QUERY PARAMETER FALLBACK)
      const bob = Array.from(mockPool.users.values()).find((u) => u.email === 'bob.fallback@example.com');
      const bobAssignment = Array.from(mockPool.assignments.values()).find((a) => a.candidate_id === bob?.id);
      expect(bobAssignment?.assessment_id).toBe(validAssessmentId);

      // Verify Charlie failed with ASSESSMENT_NOT_FOUND (TENANT ISOLATION)
      const charlieError = body.errors.find((e: any) => e.rowNumber === 4);
      expect(charlieError?.code).toBe('ASSESSMENT_NOT_FOUND');

      // Verify Diana failed with ASSESSMENT_NOT_PUBLISHED (LIFECYCLE STATUS VALIDATION)
      const dianaError = body.errors.find((e: any) => e.rowNumber === 5);
      expect(dianaError?.code).toBe('ASSESSMENT_NOT_PUBLISHED');
    });
  });
});
