import crypto from 'node:crypto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/common/database/database.service.js';
import { MailService } from '../src/common/services/mail.service.js';
import { CandidatesService } from '../src/modules/candidates/candidates.service.js';
import { PG_POOL } from '../src/modules/database/database.tokens.js';
import { SessionService } from '../src/modules/session/session.service.js';
import { APP_CONFIG } from '../src/config/config.tokens.js';
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
  created_at: Date;
}

interface InMemoryInvitation {
  id: string;
  org_id: string;
  user_id: string;
  email: string;
  role: string;
  token_hash: Buffer;
  expires_at: Date;
}

function createMockDbPool() {
  const users = new Map<string, InMemoryUser>();
  const invitations = new Map<string, InMemoryInvitation>();
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

      if (q.includes('SELECT id FROM app.users WHERE org_id = $1 AND email = $2')) {
        const orgId = params?.[0] as string;
        const email = params?.[1] as string;
        const match = Array.from(users.values()).find(
          (u) => u.org_id === orgId && u.email === email && u.status !== 'deleted',
        );
        return { rows: match ? [{ id: match.id }] : [], rowCount: match ? 1 : 0 };
      }

      if (q.includes('find_user_by_id')) {
        return {
          rows: [{ user_status: 'active', org_status: 'trial_active' }],
          rowCount: 1,
        };
      }

      if (q.includes('FROM app.users') && q.includes("role = 'candidate'") && q.includes("status != 'deleted'")) {
        const orgId = params?.[0] as string;
        const matches = Array.from(users.values())
          .filter((u) => u.org_id === orgId && u.role === 'candidate' && u.status !== 'deleted')
          .map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            status: u.status,
            counted_against_cap_at: null,
            created_at: u.created_at,
          }));
        return { rows: matches, rowCount: matches.length };
      }

      if (q.includes('SELECT name FROM app.organizations WHERE id = $1')) {
        return { rows: [{ name: 'Acme Simulation Academy' }], rowCount: 1 };
      }

      if (q.includes('FROM app.users u') && q.includes('JOIN app.organizations o')) {
        const userId = params?.[0] as string;
        const user = users.get(userId);
        if (user) {
          return {
            rows: [
              {
                id: user.id,
                name: user.name,
                status: user.status,
                created_at: user.created_at,
                org_name: 'Acme Simulation Academy',
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }

      if (q.includes('UPDATE app.users') && q.includes("SET status = 'active'")) {
        const userId = params?.[0] as string;
        const user = users.get(userId);
        if (user) {
          user.status = 'active';
        }
        return { rows: [], rowCount: 1 };
      }

      if (q.includes('FROM audit.events') && q.includes('actor_id = $1')) {
        const actorId = params?.[0] as string;
        const matching = auditEvents.filter(
          (e) => (Array.isArray(e) ? e[0] === actorId : e.actorId === actorId),
        );
        return {
          rows: matching.map((e) => ({
            action: Array.isArray(e) ? e[3] : e.action,
            at: new Date(),
          })),
          rowCount: matching.length,
        };
      }

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
          created_at,
        };
        users.set(id, user);
        return {
          rows: [{ id, name, email, status: 'invited', created_at }],
          rowCount: 1,
        };
      }

      if (q.includes('INSERT INTO app.invitations')) {
        const org_id = params?.[0] as string;
        const user_id = params?.[1] as string;
        const email = params?.[2] as string;
        const token_hash = params?.[3] as Buffer;
        const expires_at = params?.[4] as Date;
        const id = crypto.randomUUID();
        invitations.set(id, { id, org_id, user_id, email, role: 'candidate', token_hash, expires_at });
        return { rows: [{ id }], rowCount: 1 };
      }

      if (q.includes('INSERT INTO audit.events')) {
        auditEvents.push(params);
        return { rows: [{ id: 1 }], rowCount: 1 };
      }

      if (q.includes('SELECT hash FROM audit.events')) {
        return { rows: [], rowCount: 0 };
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
    invitations,
    auditEvents,
  };
}

describe('Candidates API & Mailpit Integration', () => {
  let app: NestFastifyApplication;
  let mockPool: ReturnType<typeof createMockDbPool>;
  let mailService: MailService;
  let sessionService: SessionService;

  const orgId = '11111111-2222-3333-4444-555555555555';
  const companyAdminId = '99999999-8888-7777-6666-555555555555';

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

  it('1. Rejects unauthenticated candidate creation with 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/candidates',
      payload: {
        name: 'Alex Student',
        email: 'alex.student@example.test',
      },
    });

    expect(res.statusCode).toBe(401);
  });

  it('2. Successfully invites candidate, records invitation, and returns 201 Created', async () => {
    // Create company_admin session
    const { rawToken } = await sessionService.createSession({
      userId: companyAdminId,
      orgId,
      email: 'admin@acme.com',
      role: 'company_admin',
      portal: 'company',
    });

    const sendEmailSpy = vi.spyOn(mailService, 'sendInvitationEmail');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/candidates',
      headers: {
        cookie: `hs_session=${rawToken}`,
        'x-hs-csrf': '1',
        origin: 'http://localhost:3000',
      },
      payload: {
        name: 'Alex Student',
        email: 'student.test@example.com',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toMatchObject({
      name: 'Alex Student',
      email: 'student.test@example.com',
      status: 'invited',
      countedAgainstCapAt: null,
    });
    expect(body.id).toBeDefined();

    // Verify MailService called
    expect(sendEmailSpy).toHaveBeenCalledTimes(1);
    expect(sendEmailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'student.test@example.com',
        role: 'candidate',
        orgName: 'Acme Simulation Academy',
        orgId,
      }),
    );

    // Verify token stored in DB
    expect(mockPool.invitations.size).toBe(1);
    const inv = Array.from(mockPool.invitations.values())[0]!;
    expect(inv.email).toBe('student.test@example.com');
    expect(inv.role).toBe('candidate');
    expect(inv.token_hash).toBeInstanceOf(Buffer);
  });

  it('3. Rejects duplicate candidate invitation with 409 Conflict', async () => {
    const { rawToken } = await sessionService.createSession({
      userId: companyAdminId,
      orgId,
      email: 'admin@acme.com',
      role: 'company_admin',
      portal: 'company',
    });

    // Seed existing candidate
    mockPool.users.set('existing-user', {
      id: 'existing-user',
      org_id: orgId,
      email: 'student.test@example.com',
      name: 'Existing Student',
      role: 'candidate',
      password_hash: null,
      must_reset_password: true,
      status: 'invited',
      created_at: new Date(),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/candidates',
      headers: {
        cookie: `hs_session=${rawToken}`,
        'x-hs-csrf': '1',
        origin: 'http://localhost:3000',
      },
      payload: {
        name: 'Another Alex',
        email: 'student.test@example.com',
      },
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('CANDIDATE_ALREADY_EXISTS');
  });

  it('4. MailService successfully dispatches invitation to Mailpit HTTP API in development', async () => {
    // Intercept fetch to verify exact payload sent to Mailpit
    const originalFetch = globalThis.fetch;
    const fetchSpy = vi.fn(async () => {
      return new Response(JSON.stringify({ ID: 'test-mailpit-id' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    globalThis.fetch = fetchSpy as typeof fetch;

    try {
      await mailService.sendInvitationEmail({
        to: 'student.test@example.com',
        token: 'a1b2c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef0123',
        role: 'candidate',
        orgName: 'Acme Simulation Academy',
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [calledUrl, calledInit] = fetchSpy.mock.calls[0]!;
      expect(calledUrl).toBe('http://127.0.0.1:8025/api/v1/send');
      expect(calledInit?.method).toBe('POST');
      const payload = JSON.parse(calledInit?.body as string);
      expect(payload.To[0].Email).toBe('student.test@example.com');
      expect(payload.Subject).toContain('Acme Simulation Academy');
      expect(payload.HTML).toContain('/accept-invite?token=');
      expect(payload.HTML).toContain('72 hours');
    } finally {
      globalThis.fetch = originalFetch;
    }
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
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);
    expect(body.some((c: any) => c.email === 'candidate.listed@example.com')).toBe(true);
  });

  it('6. Candidate assignments lifecycle: list, start with consent, and submit (BUG-08)', async () => {
    const candidateUserId = crypto.randomUUID();
    mockPool.users.set(candidateUserId, {
      id: candidateUserId,
      org_id: orgId,
      email: 'student.portal@example.com',
      name: 'Portal Candidate',
      role: 'candidate',
      password_hash: null,
      must_reset_password: false,
      status: 'invited',
      created_at: new Date(),
    });

    const { rawToken } = await sessionService.createSession({
      userId: candidateUserId,
      orgId,
      email: 'student.portal@example.com',
      role: 'candidate',
      portal: 'candidate',
    });

    // 1. GET /candidate/assignments
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/candidate/assignments',
      headers: {
        cookie: `hs_session=${rawToken}`,
      },
    });

    expect(listRes.statusCode).toBe(200);
    const assignments = JSON.parse(listRes.body);
    expect(Array.isArray(assignments)).toBe(true);
    expect(assignments.length).toBe(1);
    expect(assignments[0].status).toBe('ready');
    expect(assignments[0].companyName).toBe('Acme Simulation Academy');

    // 2. POST /candidate/assignments/:id/start (BR-12 consent required)
    const startRes = await app.inject({
      method: 'POST',
      url: `/api/v1/candidate/assignments/${candidateUserId}/start`,
      headers: {
        cookie: `hs_session=${rawToken}`,
        'x-hs-csrf': '1',
        origin: 'http://localhost:3000',
      },
      payload: {
        consent: {
          textVersion: 'v1.0',
          acceptedAt: new Date().toISOString(),
        },
      },
    });

    expect(startRes.statusCode).toBe(200);
    const started = JSON.parse(startRes.body);
    expect(started.status).toBe('in_progress');

    // 3. POST /candidate/assignments/:id/submit
    const submitRes = await app.inject({
      method: 'POST',
      url: `/api/v1/candidate/assignments/${candidateUserId}/submit`,
      headers: {
        cookie: `hs_session=${rawToken}`,
        'x-hs-csrf': '1',
        origin: 'http://localhost:3000',
      },
      payload: {},
    });

    expect(submitRes.statusCode).toBe(200);
    const submitted = JSON.parse(submitRes.body);
    expect(submitted.status).toBe('submitted');
  });
});
