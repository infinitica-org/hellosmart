import crypto from 'node:crypto';
import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import pg from 'pg';
import { AppModule } from '../src/app.module.js';
import { MailService } from '../src/common/services/mail.service.js';
import { PG_POOL, PG_PLATFORM_POOL } from '../src/modules/database/database.tokens.js';
import { SessionService } from '../src/modules/session/session.service.js';
import { APP_CONFIG } from '../src/config/config.tokens.js';
import { CandidatesService } from '../src/modules/candidates/candidates.service.js';
import { DatabaseService } from '../src/common/database/database.service.js';
import { registerCsvContentTypeParsers } from '../src/modules/candidates/csv-stream-parser.js';
import { withOrg } from '../src/modules/tenancy/with-org.js';
import type { Config } from '../src/config/config.js';

interface InMemoryUser {
  id: string;
  org_id: string;
  email: string;
  name: string;
  role: string;
  password_hash: string | null;
  must_reset_password: boolean;
  status: string;
  counted_against_cap_at: Date | null;
  deleted_at?: Date | null;
  created_at: Date;
}

interface InMemoryAssessment {
  id: string;
  org_id: string;
  name: string;
  status: string;
}

interface InMemoryAssignment {
  id: string;
  org_id: string;
  assessment_id: string;
  candidate_id: string;
  status: string;
  invite_token_hash: Buffer;
  invite_issued_at: Date;
  invite_expires_at: Date;
  first_connect_at?: Date | null;
  invited_at: Date;
  created_at: Date;
}

interface InMemoryEntitlement {
  org_id: string;
  max_candidates: number;
  pending_invite_multiplier: number;
}

function createMockDbPool() {
  const users = new Map<string, InMemoryUser>();
  const assessments = new Map<string, InMemoryAssessment>();
  const assignments = new Map<string, InMemoryAssignment>();
  const entitlements = new Map<string, InMemoryEntitlement>();
  const auditEvents: unknown[] = [];

  const client = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      const q = typeof sql === 'string' ? sql.trim() : '';

      if (q.startsWith('BEGIN') || q.startsWith('COMMIT') || q.startsWith('ROLLBACK')) {
        return { rows: [], rowCount: 0 };
      }

      if (q.includes("set_config('app.org_id'")) {
        return { rows: [], rowCount: 0 };
      }

      // 0. Entitlements lookup
      if (q.includes('app.entitlements') && q.includes('org_id = $1')) {
        const orgId = params?.[0] as string;
        const ent = entitlements.get(orgId);
        if (ent) {
          return {
            rows: [{ max_candidates: ent.max_candidates, pending_invite_multiplier: ent.pending_invite_multiplier }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }

      // 0b. Launched candidate count (counted_against_cap_at IS NOT NULL)
      if (q.includes('app.users') && q.includes('counted_against_cap_at IS NOT NULL')) {
        const orgId = params?.[0] as string;
        const count = Array.from(users.values()).filter(
          (u) => u.org_id === orgId && u.role === 'candidate' && u.status !== 'deleted' && !u.deleted_at && u.counted_against_cap_at !== null,
        ).length;
        return { rows: [{ count: count.toString() }], rowCount: 1 };
      }

      // 0c. Pending assignments count
      if (q.includes('app.assignments') && q.includes('counted_against_cap_at IS NULL')) {
        const orgId = params?.[0] as string;
        const now = new Date();
        const count = Array.from(assignments.values()).filter((a) => {
          if (a.org_id !== orgId) return false;
          if (!['invited', 'window_not_open', 'ready'].includes(a.status)) return false;
          if (a.first_connect_at) return false;
          if (a.invite_expires_at && a.invite_expires_at <= now) return false;
          const u = users.get(a.candidate_id);
          if (!u || u.status === 'deleted' || u.deleted_at) return false;
          if (u.counted_against_cap_at !== null) return false;
          return true;
        }).length;
        return { rows: [{ count: count.toString() }], rowCount: 1 };
      }

      // 1. Assessment lookup
      if (q.includes('FROM app.assessments WHERE id = $1 AND org_id = $2')) {
        const assessmentId = params?.[0] as string;
        const orgId = params?.[1] as string;
        const match = assessments.get(assessmentId);
        if (match && match.org_id === orgId) {
          return { rows: [{ id: match.id, name: match.name, org_id: match.org_id, status: match.status }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }

      // 2. User lookup by email or id
      if (q.includes('FROM app.users') && q.includes('org_id = $1 AND email = $2')) {
        const orgId = params?.[0] as string;
        const email = params?.[1] as string;
        const match = Array.from(users.values()).find(
          (u) => u.org_id === orgId && u.email === email && u.status !== 'deleted',
        );
        return {
          rows: match ? [{ id: match.id, name: match.name, email: match.email, status: match.status, counted_against_cap_at: match.counted_against_cap_at, created_at: match.created_at }] : [],
          rowCount: match ? 1 : 0,
        };
      }

      if (q.includes('FROM app.users') && q.includes('id = $1 AND org_id = $2')) {
        const userId = params?.[0] as string;
        const orgId = params?.[1] as string;
        const match = users.get(userId);
        if (match && match.org_id === orgId) {
          return {
            rows: [{
              id: match.id,
              role: match.role,
              status: match.status,
              deleted_at: match.deleted_at ?? null,
              counted_against_cap_at: match.counted_against_cap_at,
            }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }

      // 3. User update (e.g. recordCandidateFirstLaunch)
      if (q.includes('UPDATE app.users') && q.includes('counted_against_cap_at = now()')) {
        const userId = params?.[0] as string;
        const orgId = params?.[1] as string;
        const match = users.get(userId);
        if (match && match.org_id === orgId) {
          const now = new Date();
          match.counted_against_cap_at = now;
          return { rows: [{ counted_against_cap_at: now }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }

      // 4. Assignment duplicate lookup
      if (q.includes('FROM app.assignments WHERE org_id = $1 AND assessment_id = $2 AND candidate_id = $3')) {
        const orgId = params?.[0] as string;
        const assessmentId = params?.[1] as string;
        const candidateId = params?.[2] as string;
        const match = Array.from(assignments.values()).find(
          (a) => a.org_id === orgId && a.assessment_id === assessmentId && a.candidate_id === candidateId,
        );
        return { rows: match ? [{ id: match.id }] : [], rowCount: match ? 1 : 0 };
      }

      // 5. Organization lookup
      if (q.includes('SELECT name FROM app.organizations WHERE id = $1')) {
        return { rows: [{ name: 'Acme Test Org' }], rowCount: 1 };
      }

      // 6. Insert candidate user
      if (q.includes('INSERT INTO app.users')) {
        const id = params?.[0] as string;
        const org_id = params?.[1] as string;
        const email = params?.[2] as string;
        const name = params?.[3] as string;
        const created_at = new Date();
        const user: InMemoryUser = {
          id,
          org_id,
          email,
          name,
          role: 'candidate',
          password_hash: null,
          must_reset_password: true,
          status: 'invited',
          counted_against_cap_at: null,
          created_at,
        };
        users.set(id, user);
        return {
          rows: [{ id, name, email, status: 'invited', created_at }],
          rowCount: 1,
        };
      }

      // 7. Insert assignment
      if (q.includes('INSERT INTO app.assignments')) {
        const org_id = params?.[0] as string;
        const assessment_id = params?.[1] as string;
        const candidate_id = params?.[2] as string;
        const invite_token_hash = params?.[3] as Buffer;
        const invite_issued_at = params?.[4] as Date;
        const invite_expires_at = params?.[5] as Date;

        const id = crypto.randomUUID();
        const now = new Date();
        assignments.set(id, {
          id,
          org_id,
          assessment_id,
          candidate_id,
          status: 'invited',
          invite_token_hash,
          invite_issued_at,
          invite_expires_at,
          invited_at: now,
          created_at: now,
        });
        return {
          rows: [{ id, status: 'invited', invited_at: now, created_at: now }],
          rowCount: 1,
        };
      }

      // 8. Insert general invitation
      if (q.includes('INSERT INTO app.invitations')) {
        return { rows: [{ id: crypto.randomUUID() }], rowCount: 1 };
      }

      // 9. Audit event
      if (q.includes('INSERT INTO audit.events')) {
        auditEvents.push(params);
        return { rows: [{ id: 1 }], rowCount: 1 };
      }

      if (q.includes('audit.latest_event_hash')) {
        return { rows: [{ hash: Buffer.alloc(32, 1) }], rowCount: 1 };
      }

      return { rows: [], rowCount: 0 };
    }),
    release: vi.fn(),
  };

  return {
    connect: vi.fn(async () => client),
    query: client.query,
    end: vi.fn(),
    users,
    assessments,
    assignments,
    entitlements,
    auditEvents,
    client,
  };
}

describe('Candidate Cap & Pending Invite Multiplier Tracking (S1-T05-3, BR-06)', () => {
  let app: NestFastifyApplication;
  let mockPool: ReturnType<typeof createMockDbPool>;
  let candidatesService: CandidatesService;
  let sessionService: SessionService;

  const orgId = '11111111-2222-3333-4444-555555555555';
  const otherOrgId = '22222222-3333-4444-5555-666666666666';
  const companyAdminId = '99999999-8888-7777-6666-555555555555';
  const validAssessmentId = '33333333-4444-5555-6666-777777777777';

  const testConfig: Config = {
    NODE_ENV: 'test',
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

    // Setup base entitlement: max 10 candidates, 2.0 pending multiplier
    mockPool.entitlements.set(orgId, {
      org_id: orgId,
      max_candidates: 10,
      pending_invite_multiplier: 2.0,
    });

    mockPool.assessments.set(validAssessmentId, {
      id: validAssessmentId,
      org_id: orgId,
      name: 'Fullstack TypeScript Assessment',
      status: 'published',
    });

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(APP_CONFIG)
      .useValue(testConfig)
      .overrideProvider(PG_POOL)
      .useValue(mockPool)
      .overrideProvider(PG_PLATFORM_POOL)
      .useValue(mockPool)
      .overrideProvider(DatabaseService)
      .useValue({
        checkAccountStatus: vi.fn(async () => ({ userStatus: 'active', orgStatus: 'trial_active' })),
        setStatusChecker: vi.fn(),
        setPool: vi.fn(),
        getPool: vi.fn(),
        getClient: vi.fn(),
      })
      .compile();

    const adapter = new FastifyAdapter();
    registerCsvContentTypeParsers(adapter.getInstance());

    app = moduleRef.createNestApplication<NestFastifyApplication>(adapter);
    app.setGlobalPrefix('api/v1');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    candidatesService = moduleRef.get(CandidatesService);
    sessionService = moduleRef.get(SessionService);
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  async function createCompanySession(customOrgId = orgId): Promise<string> {
    const { rawToken } = await sessionService.createSession({
      userId: companyAdminId,
      email: 'admin@acme.test',
      role: 'company_admin',
      orgId: customOrgId,
      portal: 'company',
    });
    return rawToken;
  }

  describe('1. Missing Entitlement Fail-Closed Semantics', () => {
    it('fails closed with 403 ENTITLEMENTS_NOT_FOUND when organization lacks entitlement row', async () => {
      // Organization without entitlement record
      mockPool.entitlements.delete(orgId);
      const sessionToken = await createCompanySession();

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/company/candidates',
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          origin: 'http://localhost:3000',
        },
        payload: {
          name: 'Target Candidate',
          email: 'target@example.test',
          assessment_id: validAssessmentId,
        },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('ENTITLEMENTS_NOT_FOUND');
    });
  });

  describe('2. Pending Invitation Multiplier & Floor Behavior', () => {
    it('allows invitations up to pending_limit = FLOOR(max_candidates * pending_invite_multiplier)', async () => {
      // max_candidates = 3, pending_invite_multiplier = 2.5 => pending_limit = FLOOR(7.5) = 7
      mockPool.entitlements.set(orgId, {
        org_id: orgId,
        max_candidates: 3,
        pending_invite_multiplier: 2.5,
      });

      const sessionToken = await createCompanySession();

      // Seed 6 existing pending assignments
      for (let i = 1; i <= 6; i++) {
        const uId = `user-${i}`;
        mockPool.users.set(uId, {
          id: uId,
          org_id: orgId,
          email: `user${i}@example.test`,
          name: `User ${i}`,
          role: 'candidate',
          password_hash: null,
          must_reset_password: true,
          status: 'invited',
          counted_against_cap_at: null,
          created_at: new Date(),
        });
        const aId = `assign-${i}`;
        mockPool.assignments.set(aId, {
          id: aId,
          org_id: orgId,
          assessment_id: validAssessmentId,
          candidate_id: uId,
          status: 'invited',
          invite_token_hash: Buffer.alloc(32, 1),
          invite_issued_at: new Date(),
          invite_expires_at: new Date(Date.now() + 7 * 86400000),
          invited_at: new Date(),
          created_at: new Date(),
        });
      }

      // 7th pending invite should SUCCEED (pendingCount = 6 + 1 = 7 <= 7)
      const res7 = await app.inject({
        method: 'POST',
        url: '/api/v1/company/candidates',
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          origin: 'http://localhost:3000',
        },
        payload: {
          name: 'Candidate 7',
          email: 'candidate7@example.test',
          assessment_id: validAssessmentId,
        },
      });
      expect(res7.statusCode).toBe(201);

      // 8th pending invite should FAIL with 403 PENDING_INVITE_CAP_EXCEEDED (7 + 1 = 8 > 7)
      const res8 = await app.inject({
        method: 'POST',
        url: '/api/v1/company/candidates',
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          origin: 'http://localhost:3000',
        },
        payload: {
          name: 'Candidate 8',
          email: 'candidate8@example.test',
          assessment_id: validAssessmentId,
        },
      });
      expect(res8.statusCode).toBe(403);
      const body8 = JSON.parse(res8.body);
      expect(body8.code).toBe('PENDING_INVITE_CAP_EXCEEDED');
    });

    it('excludes expired, revoked, first-connected, and soft-deleted assignments from pending count', async () => {
      // max_candidates = 1, multiplier = 2.0 => pending_limit = 2
      mockPool.entitlements.set(orgId, {
        org_id: orgId,
        max_candidates: 1,
        pending_invite_multiplier: 2.0,
      });

      const sessionToken = await createCompanySession();

      // Seed an expired assignment (should be excluded)
      const uExp = 'u-expired';
      mockPool.users.set(uExp, {
        id: uExp,
        org_id: orgId,
        email: 'exp@example.test',
        name: 'Expired',
        role: 'candidate',
        password_hash: null,
        must_reset_password: true,
        status: 'invited',
        counted_against_cap_at: null,
        created_at: new Date(),
      });
      mockPool.assignments.set('a-expired', {
        id: 'a-expired',
        org_id: orgId,
        assessment_id: validAssessmentId,
        candidate_id: uExp,
        status: 'invited',
        invite_token_hash: Buffer.alloc(32, 1),
        invite_issued_at: new Date(Date.now() - 10 * 86400000),
        invite_expires_at: new Date(Date.now() - 3 * 86400000), // EXPIRED
        invited_at: new Date(),
        created_at: new Date(),
      });

      // Seed a revoked assignment (should be excluded)
      const uRev = 'u-revoked';
      mockPool.users.set(uRev, {
        id: uRev,
        org_id: orgId,
        email: 'rev@example.test',
        name: 'Revoked',
        role: 'candidate',
        password_hash: null,
        must_reset_password: true,
        status: 'invited',
        counted_against_cap_at: null,
        created_at: new Date(),
      });
      mockPool.assignments.set('a-revoked', {
        id: 'a-revoked',
        org_id: orgId,
        assessment_id: validAssessmentId,
        candidate_id: uRev,
        status: 'revoked', // REVOKED
        invite_token_hash: Buffer.alloc(32, 1),
        invite_issued_at: new Date(),
        invite_expires_at: new Date(Date.now() + 7 * 86400000),
        invited_at: new Date(),
        created_at: new Date(),
      });

      // Seed an assignment where candidate already connected (first_connect_at IS NOT NULL) (should be excluded)
      const uConn = 'u-connected';
      mockPool.users.set(uConn, {
        id: uConn,
        org_id: orgId,
        email: 'conn@example.test',
        name: 'Connected',
        role: 'candidate',
        password_hash: null,
        must_reset_password: true,
        status: 'active',
        counted_against_cap_at: null,
        created_at: new Date(),
      });
      mockPool.assignments.set('a-connected', {
        id: 'a-connected',
        org_id: orgId,
        assessment_id: validAssessmentId,
        candidate_id: uConn,
        status: 'in_progress',
        invite_token_hash: Buffer.alloc(32, 1),
        invite_issued_at: new Date(),
        invite_expires_at: new Date(Date.now() + 7 * 86400000),
        first_connect_at: new Date(), // FIRST CONNECTED
        invited_at: new Date(),
        created_at: new Date(),
      });

      // Seed a soft-deleted candidate (should be excluded)
      const uDel = 'u-deleted';
      mockPool.users.set(uDel, {
        id: uDel,
        org_id: orgId,
        email: 'del@example.test',
        name: 'Deleted',
        role: 'candidate',
        password_hash: null,
        must_reset_password: true,
        status: 'deleted',
        deleted_at: new Date(), // SOFT DELETED
        counted_against_cap_at: null,
        created_at: new Date(),
      });
      mockPool.assignments.set('a-deleted', {
        id: 'a-deleted',
        org_id: orgId,
        assessment_id: validAssessmentId,
        candidate_id: uDel,
        status: 'invited',
        invite_token_hash: Buffer.alloc(32, 1),
        invite_issued_at: new Date(),
        invite_expires_at: new Date(Date.now() + 7 * 86400000),
        invited_at: new Date(),
        created_at: new Date(),
      });

      // Now create 1st real pending invite -> should succeed
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/v1/company/candidates',
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          origin: 'http://localhost:3000',
        },
        payload: {
          name: 'Active 1',
          email: 'active1@example.test',
          assessment_id: validAssessmentId,
        },
      });
      expect(res1.statusCode).toBe(201);

      // Create 2nd real pending invite -> should succeed (limit = 2)
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/company/candidates',
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          origin: 'http://localhost:3000',
        },
        payload: {
          name: 'Active 2',
          email: 'active2@example.test',
          assessment_id: validAssessmentId,
        },
      });
      expect(res2.statusCode).toBe(201);

      // 3rd pending invite should be blocked
      const res3 = await app.inject({
        method: 'POST',
        url: '/api/v1/company/candidates',
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          origin: 'http://localhost:3000',
        },
        payload: {
          name: 'Active 3',
          email: 'active3@example.test',
          assessment_id: validAssessmentId,
        },
      });
      expect(res3.statusCode).toBe(403);
      expect(JSON.parse(res3.body).code).toBe('PENDING_INVITE_CAP_EXCEEDED');
    });
  });

  describe('3. Candidate Cap Quota Enforcement (BR-06)', () => {
    it('blocks new candidate invitations with 403 CANDIDATE_CAP_EXCEEDED when launched count reaches max_candidates', async () => {
      mockPool.entitlements.set(orgId, {
        org_id: orgId,
        max_candidates: 2,
        pending_invite_multiplier: 5.0,
      });

      // Seed 2 candidates that have launched (counted_against_cap_at is set)
      for (let i = 1; i <= 2; i++) {
        const uId = `launched-candidate-${i}`;
        mockPool.users.set(uId, {
          id: uId,
          org_id: orgId,
          email: `launched${i}@example.test`,
          name: `Launched ${i}`,
          role: 'candidate',
          password_hash: null,
          must_reset_password: false,
          status: 'active',
          counted_against_cap_at: new Date(), // ALREADY COUNTED AGAINST CAP
          created_at: new Date(),
        });
      }

      const sessionToken = await createCompanySession();

      // Attempting to invite a 3rd new candidate should fail with 403 CANDIDATE_CAP_EXCEEDED
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/company/candidates',
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          origin: 'http://localhost:3000',
        },
        payload: {
          name: 'Blocked Candidate',
          email: 'blocked@example.test',
          assessment_id: validAssessmentId,
        },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('CANDIDATE_CAP_EXCEEDED');
    });

    it('allows an already counted candidate to be assigned to another assessment even when at candidate cap', async () => {
      mockPool.entitlements.set(orgId, {
        org_id: orgId,
        max_candidates: 1,
        pending_invite_multiplier: 1.0,
      });

      // Seed 1 launched candidate
      const existingCandidateId = 'existing-counted-candidate-1';
      mockPool.users.set(existingCandidateId, {
        id: existingCandidateId,
        org_id: orgId,
        email: 'veteran@example.test',
        name: 'Veteran Candidate',
        role: 'candidate',
        password_hash: null,
        must_reset_password: false,
        status: 'active',
        counted_against_cap_at: new Date(), // ALREADY COUNTED
        created_at: new Date(),
      });

      // Second assessment
      const secondAssessmentId = '44444444-5555-6666-7777-888888888888';
      mockPool.assessments.set(secondAssessmentId, {
        id: secondAssessmentId,
        org_id: orgId,
        name: 'Backend Node.js Assessment',
        status: 'published',
      });

      const sessionToken = await createCompanySession();

      // Inviting the existing counted candidate to the second assessment must SUCCEED
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/company/candidates',
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          origin: 'http://localhost:3000',
        },
        payload: {
          name: 'Veteran Candidate',
          email: 'veteran@example.test',
          assessment_id: secondAssessmentId,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.candidateId).toBe(existingCandidateId);
    });

    it('enforces tenant isolation: Organization A cap does not affect Organization B', async () => {
      // Org A is at cap (max 1 candidate, 1 launched)
      mockPool.entitlements.set(orgId, {
        org_id: orgId,
        max_candidates: 1,
        pending_invite_multiplier: 2.0,
      });
      mockPool.users.set('orgA-candidate', {
        id: 'orgA-candidate',
        org_id: orgId,
        email: 'launchedA@example.test',
        name: 'Launched A',
        role: 'candidate',
        password_hash: null,
        must_reset_password: false,
        status: 'active',
        counted_against_cap_at: new Date(),
        created_at: new Date(),
      });

      // Org B has capacity (max 5 candidates, 0 launched)
      mockPool.entitlements.set(otherOrgId, {
        org_id: otherOrgId,
        max_candidates: 5,
        pending_invite_multiplier: 2.0,
      });
      const orgBAssessmentId = '55555555-6666-7777-8888-999999999999';
      mockPool.assessments.set(orgBAssessmentId, {
        id: orgBAssessmentId,
        org_id: otherOrgId,
        name: 'Org B Assessment',
        status: 'published',
      });

      const sessionTokenB = await createCompanySession(otherOrgId);

      // Org B inviting candidate must SUCCEED
      const resB = await app.inject({
        method: 'POST',
        url: '/api/v1/company/candidates',
        headers: {
          cookie: `hs_session=${sessionTokenB}`,
          'x-hs-csrf': '1',
          origin: 'http://localhost:3000',
        },
        payload: {
          name: 'Org B Candidate',
          email: 'candidateB@example.test',
          assessment_id: orgBAssessmentId,
        },
      });

      expect(resB.statusCode).toBe(201);
    });
  });

  describe('4. Bulk Import Streaming Quota Validation', () => {
    it('applies per-row quota enforcement and preserves partial success without aborting pipeline', async () => {
      // Organization allows max 2 pending invites
      mockPool.entitlements.set(orgId, {
        org_id: orgId,
        max_candidates: 1,
        pending_invite_multiplier: 2.0, // pending limit = 2
      });

      const sessionToken = await createCompanySession();

      const csvContent = [
        'name,email',
        'Alpha Student,alpha@test.com', // row 1 -> consumes pending slot 1 (success)
        'Beta Student,beta@test.com',   // row 2 -> consumes pending slot 2 (success)
        'Gamma Student,gamma@test.com', // row 3 -> exceeds pending limit (fail: PENDING_INVITE_CAP_EXCEEDED)
        'Delta Student,delta@test.com', // row 4 -> exceeds pending limit (fail: PENDING_INVITE_CAP_EXCEEDED)
      ].join('\n');

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/company/candidates/bulk?assessment_id=${validAssessmentId}`,
        headers: {
          cookie: `hs_session=${sessionToken}`,
          'x-hs-csrf': '1',
          'content-type': 'text/csv',
          origin: 'http://localhost:3000',
        },
        payload: csvContent,
      });

      expect(res.statusCode).toBe(200);
      const result = JSON.parse(res.body);

      expect(result.totalRows).toBe(4);
      expect(result.successfulRows).toBe(2);
      expect(result.failedRows).toBe(2);

      const errCodes = result.errors.map((e: any) => e.code);
      expect(errCodes).toEqual(['PENDING_INVITE_CAP_EXCEEDED', 'PENDING_INVITE_CAP_EXCEEDED']);
      expect(result.createdSample.length).toBe(2);
      expect(result.createdSample[0].email).toBe('alpha@test.com');
      expect(result.createdSample[1].email).toBe('beta@test.com');
    });
  });

  describe('5. First-Launch Helper: recordCandidateFirstLaunch()', () => {
    it('records first workspace launch, marks counted_against_cap_at, and writes candidate.cap_counted audit event', async () => {
      const candidateId = 'first-launch-candidate-1';
      mockPool.users.set(candidateId, {
        id: candidateId,
        org_id: orgId,
        email: 'launch1@example.test',
        name: 'Launch Candidate 1',
        role: 'candidate',
        password_hash: null,
        must_reset_password: false,
        status: 'active',
        counted_against_cap_at: null, // NOT YET COUNTED
        created_at: new Date(),
      });

      const client = await mockPool.connect();
      try {
        const result = await candidatesService.recordCandidateFirstLaunch(
          client as any,
          orgId,
          candidateId,
        );

        expect(result.newlyCounted).toBe(true);
        expect(result.countedAt).toBeInstanceOf(Date);

        const updatedUser = mockPool.users.get(candidateId)!;
        expect(updatedUser.counted_against_cap_at).not.toBeNull();

        // Audit event verification
        expect(mockPool.auditEvents.length).toBe(1);
        const auditParams = mockPool.auditEvents[0] as unknown[];
        expect(auditParams[3]).toBe('candidate.cap_counted');
        expect(auditParams[4]).toBe('candidate');
        expect(auditParams[5]).toBe(candidateId);
      } finally {
        client.release();
      }
    });

    it('operates idempotently on subsequent launches for the same candidate without re-incrementing or re-auditing', async () => {
      const candidateId = 'first-launch-candidate-2';
      const existingCountedAt = new Date(Date.now() - 3600000);
      mockPool.users.set(candidateId, {
        id: candidateId,
        org_id: orgId,
        email: 'launch2@example.test',
        name: 'Launch Candidate 2',
        role: 'candidate',
        password_hash: null,
        must_reset_password: false,
        status: 'active',
        counted_against_cap_at: existingCountedAt, // ALREADY COUNTED
        created_at: new Date(),
      });

      const client = await mockPool.connect();
      try {
        const result = await candidatesService.recordCandidateFirstLaunch(
          client as any,
          orgId,
          candidateId,
        );

        expect(result.newlyCounted).toBe(false);
        expect(result.countedAt.getTime()).toBe(existingCountedAt.getTime());

        // No new audit event emitted
        expect(mockPool.auditEvents.length).toBe(0);
      } finally {
        client.release();
      }
    });

    it('throws 403 CANDIDATE_CAP_EXCEEDED when uncounted candidate attempts first launch at cap', async () => {
      mockPool.entitlements.set(orgId, {
        org_id: orgId,
        max_candidates: 1,
        pending_invite_multiplier: 2.0,
      });

      // Seed 1 candidate already counted
      mockPool.users.set('counted-cand', {
        id: 'counted-cand',
        org_id: orgId,
        email: 'counted@example.test',
        name: 'Counted Cand',
        role: 'candidate',
        password_hash: null,
        must_reset_password: false,
        status: 'active',
        counted_against_cap_at: new Date(),
        created_at: new Date(),
      });

      // Uncounted candidate attempting launch
      const uncountedCandidateId = 'uncounted-cand';
      mockPool.users.set(uncountedCandidateId, {
        id: uncountedCandidateId,
        org_id: orgId,
        email: 'uncounted@example.test',
        name: 'Uncounted Cand',
        role: 'candidate',
        password_hash: null,
        must_reset_password: false,
        status: 'invited',
        counted_against_cap_at: null,
        created_at: new Date(),
      });

      const client = await mockPool.connect();
      try {
        await expect(
          candidatesService.recordCandidateFirstLaunch(
            client as any,
            orgId,
            uncountedCandidateId,
          ),
        ).rejects.toThrow();
      } finally {
        client.release();
      }
    });
  });

  describe('6. Real PostgreSQL Concurrency & Serialization Verification', () => {
    let livePgPool: pg.Pool | null = null;
    let liveMigratorPool: pg.Pool | null = null;
    let liveCandidatesService: CandidatesService | null = null;
    let isPgAvailable = false;

    const testOrgAlphaId = 'aaaaaaaa-1111-2222-3333-444444444444';
    const testOrgBetaId = 'bbbbbbbb-1111-2222-3333-444444444444';
    const testAssessmentId = 'cccccccc-1111-2222-3333-444444444444';
    const testTemplateVersionId = 'dddddddd-1111-2222-3333-444444444444';
    const testTemplateId = 'eeeeeeee-1111-2222-3333-444444444444';
    const adminAlphaId = '99999999-aaaa-bbbb-cccc-111111111111';
    const adminBetaId = '99999999-aaaa-bbbb-cccc-222222222222';

    beforeAll(async () => {
      try {
        liveMigratorPool = new pg.Pool({
          connectionString: 'postgres://hs_migrator:hs_migrator_local@localhost:5432/hellosmart',
          connectionTimeoutMillis: 1500,
        });
        await liveMigratorPool.query('SELECT 1');

        livePgPool = new pg.Pool({
          connectionString: 'postgres://hs_app:hs_app_local@localhost:5432/hellosmart',
          max: 20,
          connectionTimeoutMillis: 1500,
        });
        await livePgPool.query('SELECT 1');

        const mockMail = {
          sendAssessmentInvitationEmail: vi.fn(async () => {}),
          sendInvitationEmail: vi.fn(async () => {}),
        } as unknown as MailService;

        liveCandidatesService = new CandidatesService(livePgPool, mockMail);
        isPgAvailable = true;

        // Establish platform context on migrator pool for fixture setup
        await liveMigratorPool.query("SELECT set_config('app.is_platform', 'true', false);");

        // Bootstrap clean fixture entities for Org Alpha and Org Beta
        await liveMigratorPool.query(`
          INSERT INTO app.organizations (id, name, slug, status, created_by)
          VALUES
            ('${testOrgAlphaId}', 'Concurrent Org Alpha', 'concurrent-alpha-${Date.now()}', 'trial_active', gen_random_uuid()),
            ('${testOrgBetaId}', 'Concurrent Org Beta', 'concurrent-beta-${Date.now()}', 'trial_active', gen_random_uuid())
          ON CONFLICT (id) DO NOTHING;
        `);

        // Seed templates and assessment for Org Alpha
        await liveMigratorPool.query(`
          INSERT INTO app.templates (id, slug, name, category, difficulty, workspace_mode, description, tags)
          VALUES ('${testTemplateId}', 'concurrency-template-${Date.now()}', 'Concurrency Test Template', 'Engineering', 'Intermediate', 'chat', 'Test template', '{}')
          ON CONFLICT (id) DO NOTHING;

          INSERT INTO app.template_versions (id, template_id, version, status, manifest)
          VALUES ('${testTemplateVersionId}', '${testTemplateId}', '1.0.0', 'published', '{}'::jsonb)
          ON CONFLICT (id) DO NOTHING;

          INSERT INTO app.template_assignments (template_id, org_id)
          VALUES ('${testTemplateId}', '${testOrgAlphaId}'), ('${testTemplateId}', '${testOrgBetaId}')
          ON CONFLICT DO NOTHING;

          INSERT INTO app.assessments (id, org_id, template_version_id, name, workspace_mode, status)
          VALUES ('${testAssessmentId}', '${testOrgAlphaId}', '${testTemplateVersionId}', 'Alpha Assessment', 'chat', 'published')
          ON CONFLICT (id) DO NOTHING;
        `);
      } catch (err: any) {
        isPgAvailable = false;
        console.warn(`[PG Integration] PostgreSQL not available in current environment (${err.message}). Integration tests will be explicitly skipped.`);
      }
    });

    afterAll(async () => {
      if (liveMigratorPool) {
        try {
          await liveMigratorPool.query(`
            DELETE FROM app.assignments WHERE org_id IN ('${testOrgAlphaId}', '${testOrgBetaId}');
            DELETE FROM app.users WHERE org_id IN ('${testOrgAlphaId}', '${testOrgBetaId}');
            DELETE FROM app.assessments WHERE id = '${testAssessmentId}';
            DELETE FROM app.template_assignments WHERE template_id = '${testTemplateId}';
            DELETE FROM app.template_versions WHERE id = '${testTemplateVersionId}';
            DELETE FROM app.templates WHERE id = '${testTemplateId}';
            DELETE FROM app.entitlements WHERE org_id IN ('${testOrgAlphaId}', '${testOrgBetaId}');
            DELETE FROM app.organizations WHERE id IN ('${testOrgAlphaId}', '${testOrgBetaId}');
          `);
        } catch {
          // ignore cleanup errors
        }
        await liveMigratorPool.end();
      }
      if (livePgPool) {
        await livePgPool.end();
      }
    });

    it('1. Concurrent invitations near pending limit: only available slots are consumed with zero over-allocation', async () => {
      if (!isPgAvailable || !liveMigratorPool || !liveCandidatesService) {
        return; // Skipped if PG container is unavailable
      }

      // Configure Org Alpha: max_candidates = 2, multiplier = 2.0 => pending_limit = 4
      await liveMigratorPool.query(`
        DELETE FROM app.assignments WHERE org_id = '${testOrgAlphaId}';
        DELETE FROM app.users WHERE org_id = '${testOrgAlphaId}';
        INSERT INTO app.entitlements (org_id, max_candidates, pending_invite_multiplier)
        VALUES ('${testOrgAlphaId}', 2, 2.0)
        ON CONFLICT (org_id) DO UPDATE SET max_candidates = 2, pending_invite_multiplier = 2.0;
      `);

      // Fire 10 concurrent invitation requests simultaneously
      const promises = Array.from({ length: 10 }, (_, i) =>
        liveCandidatesService!.create(
          {
            name: `Candidate ${i}`,
            email: `race_${i}_${Date.now()}@alpha.test`,
            assessment_id: testAssessmentId,
          },
          { userId: adminAlphaId, role: 'company_admin', orgId: testOrgAlphaId },
          { ip: '127.0.0.1' },
        ),
      );

      const results = await Promise.allSettled(promises);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Exactly 4 must succeed (pending_limit = 4)
      expect(fulfilled.length).toBe(4);
      // Exactly 6 must be rejected with 403 PENDING_INVITE_CAP_EXCEEDED
      expect(rejected.length).toBe(6);

      for (const rej of rejected) {
        const reason: any = (rej as PromiseRejectedResult).reason;
        const code = reason?.response?.code || reason?.code;
        expect(code).toBe('PENDING_INVITE_CAP_EXCEEDED');
      }

      // Verify exact database count
      const checkRes = await liveMigratorPool.query<{ count: string }>(
        `SELECT count(*)::text as count FROM app.assignments WHERE org_id = $1`,
        [testOrgAlphaId],
      );
      expect(Number.parseInt(checkRes.rows[0]?.count || '0', 10)).toBe(4);
    });

    it('2. Concurrent first launches near candidate cap: only available candidate slots are consumed', async () => {
      if (!isPgAvailable || !liveMigratorPool || !liveCandidatesService || !livePgPool) {
        return;
      }

      // Set Org Alpha: max_candidates = 2
      await liveMigratorPool.query(`
        DELETE FROM app.assignments WHERE org_id = '${testOrgAlphaId}';
        DELETE FROM app.users WHERE org_id = '${testOrgAlphaId}';
        INSERT INTO app.entitlements (org_id, max_candidates, pending_invite_multiplier)
        VALUES ('${testOrgAlphaId}', 2, 2.0)
        ON CONFLICT (org_id) DO UPDATE SET max_candidates = 2, pending_invite_multiplier = 2.0;
      `);

      // Seed 5 candidate users with counted_against_cap_at = NULL
      const candidateIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const uId = crypto.randomUUID();
        candidateIds.push(uId);
        await liveMigratorPool.query(`
          INSERT INTO app.users (id, org_id, email, name, role, status, must_reset_password, counted_against_cap_at)
          VALUES ('${uId}', '${testOrgAlphaId}', 'cand_${i}_${Date.now()}@alpha.test', 'Cand ${i}', 'candidate', 'active', false, NULL)
        `);
      }

      // Fire 5 simultaneous first-launch attempts
      const launchPromises = candidateIds.map(async (cId) => {
        const client = await livePgPool!.connect();
        try {
          return await withOrg(client, testOrgAlphaId, async (tx) => {
            return await liveCandidatesService!.recordCandidateFirstLaunch(tx, testOrgAlphaId, cId);
          });
        } finally {
          client.release();
        }
      });

      const results = await Promise.allSettled(launchPromises);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Exactly 2 must succeed (max_candidates = 2)
      expect(fulfilled.length).toBe(2);
      expect(rejected.length).toBe(3);

      for (const rej of rejected) {
        const reason: any = (rej as PromiseRejectedResult).reason;
        const code = reason?.response?.code || reason?.code;
        expect(code).toBe('CANDIDATE_CAP_EXCEEDED');
      }

      // Verify exact database count of launched candidates
      const launchedCheck = await liveMigratorPool.query<{ count: string }>(
        `SELECT count(*)::text as count FROM app.users WHERE org_id = $1 AND role = 'candidate' AND counted_against_cap_at IS NOT NULL`,
        [testOrgAlphaId],
      );
      expect(Number.parseInt(launchedCheck.rows[0]?.count || '0', 10)).toBe(2);
    });

    it('3. Multiple simultaneous first-launch attempts for the same candidate: exactly one newly-counted result', async () => {
      if (!isPgAvailable || !liveMigratorPool || !liveCandidatesService || !livePgPool) {
        return;
      }

      // Org Alpha allows 5 candidates
      await liveMigratorPool.query(`
        INSERT INTO app.entitlements (org_id, max_candidates, pending_invite_multiplier)
        VALUES ('${testOrgAlphaId}', 5, 2.0)
        ON CONFLICT (org_id) DO UPDATE SET max_candidates = 5, pending_invite_multiplier = 2.0;
      `);

      const singleCandidateId = crypto.randomUUID();
      await liveMigratorPool.query(`
        INSERT INTO app.users (id, org_id, email, name, role, status, must_reset_password, counted_against_cap_at)
        VALUES ('${singleCandidateId}', '${testOrgAlphaId}', 'same_${Date.now()}@alpha.test', 'Same Cand', 'candidate', 'active', false, NULL)
      `);

      // 5 concurrent first-launch attempts for the exact same candidate
      const attempts = Array.from({ length: 5 }, async () => {
        const client = await livePgPool!.connect();
        try {
          return await withOrg(client, testOrgAlphaId, async (tx) => {
            return await liveCandidatesService!.recordCandidateFirstLaunch(tx, testOrgAlphaId, singleCandidateId);
          });
        } finally {
          client.release();
        }
      });

      const results = await Promise.all(attempts);

      // Exactly 1 must have newlyCounted: true, other 4 must be false
      const newlyCountedList = results.map((r) => r.newlyCounted);
      expect(newlyCountedList.filter(Boolean).length).toBe(1);
      expect(newlyCountedList.filter((v) => v === false).length).toBe(4);

      // All 5 must have the identical persisted timestamp
      const timestamps = new Set(results.map((r) => r.countedAt.getTime()));
      expect(timestamps.size).toBe(1);
    });

    it('4. Concurrent operations across separate organizations preserve strict tenant isolation without cross-tenant lock contention', async () => {
      if (!isPgAvailable || !liveMigratorPool || !liveCandidatesService) {
        return;
      }

      // Configure Org Alpha and Org Beta
      await liveMigratorPool.query(`
        INSERT INTO app.entitlements (org_id, max_candidates, pending_invite_multiplier)
        VALUES
          ('${testOrgAlphaId}', 10, 2.0),
          ('${testOrgBetaId}', 10, 2.0)
        ON CONFLICT (org_id) DO UPDATE SET max_candidates = 10, pending_invite_multiplier = 2.0;
      `);

      // Interleaved invitations between Org Alpha and Org Beta
      const alphaInvites = Array.from({ length: 3 }, (_, i) =>
        liveCandidatesService!.create(
          {
            name: `Alpha Student ${i}`,
            email: `alpha_cand_${i}_${Date.now()}@alpha.test`,
            assessment_id: testAssessmentId,
          },
          { userId: adminAlphaId, role: 'company_admin', orgId: testOrgAlphaId },
          { ip: '127.0.0.1' },
        ),
      );

      const betaInvites = Array.from({ length: 3 }, (_, i) =>
        liveCandidatesService!.create(
          {
            name: `Beta General ${i}`,
            email: `beta_cand_${i}_${Date.now()}@beta.test`,
          },
          { userId: adminBetaId, role: 'company_admin', orgId: testOrgBetaId },
          { ip: '127.0.0.1' },
        ),
      );

      const combined = await Promise.all([...alphaInvites, ...betaInvites]);
      expect(combined.length).toBe(6);
    });

    it('5. No deadlocks when invitations and first launches run concurrently under the established lock hierarchy', async () => {
      if (!isPgAvailable || !liveMigratorPool || !liveCandidatesService || !livePgPool) {
        return;
      }

      await liveMigratorPool.query(`
        INSERT INTO app.entitlements (org_id, max_candidates, pending_invite_multiplier)
        VALUES ('${testOrgAlphaId}', 50, 2.0)
        ON CONFLICT (org_id) DO UPDATE SET max_candidates = 50, pending_invite_multiplier = 2.0;
      `);

      // Seed candidates for launch
      const candsToLaunch: string[] = [];
      for (let i = 0; i < 4; i++) {
        const uId = crypto.randomUUID();
        candsToLaunch.push(uId);
        await liveMigratorPool.query(`
          INSERT INTO app.users (id, org_id, email, name, role, status, must_reset_password, counted_against_cap_at)
          VALUES ('${uId}', '${testOrgAlphaId}', 'launch_mix_${i}_${Date.now()}@alpha.test', 'Launch Mix ${i}', 'candidate', 'active', false, NULL)
        `);
      }

      // Mix: 4 concurrent new invitations and 4 concurrent first launches
      const mixedTasks: Promise<any>[] = [
        ...Array.from({ length: 4 }, (_, i) =>
          liveCandidatesService!.create(
            {
              name: `Mix Invitee ${i}`,
              email: `mix_invite_${i}_${Date.now()}@alpha.test`,
              assessment_id: testAssessmentId,
            },
            { userId: adminAlphaId, role: 'company_admin', orgId: testOrgAlphaId },
            { ip: '127.0.0.1' },
          ),
        ),
        ...candsToLaunch.map(async (cId) => {
          const client = await livePgPool!.connect();
          try {
            return await withOrg(client, testOrgAlphaId, async (tx) => {
              return await liveCandidatesService!.recordCandidateFirstLaunch(tx, testOrgAlphaId, cId);
            });
          } finally {
            client.release();
          }
        }),
      ];

      // Must all resolve without deadlock (40P01)
      const results = await Promise.allSettled(mixedTasks);
      const errors = results.filter((r) => r.status === 'rejected');
      expect(errors.length).toBe(0);
    });
  });
});
