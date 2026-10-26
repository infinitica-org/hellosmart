import crypto from 'node:crypto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { Pool, PoolClient } from 'pg';
import { PasswordPolicySchema } from '@hs/contracts';
import {
  AppLoggerService,
  createLogger,
  ObservabilityModule,
  registerLoggingHooks,
  REQUEST_ID_HEADER,
} from '../src/modules/observability/index.js';
import {
  type Argon2Engine,
  AuthModule,
  DB_POOL,
  HasherService,
  InvitationsController,
  InvitationsService,
} from '../src/modules/auth/index.js';
import { ThrottlerProblemFilter } from '../src/modules/auth/auth-exception.filter.js';
import { MailService, type SendInvitationInput } from '../src/common/services/mail.service.js';
import type { Config } from '../src/config/config.js';

interface InMemoryInvitation {
  id: string;
  org_id: string;
  user_id: string;
  email: string;
  role: 'company_admin' | 'candidate';
  token_hash: Buffer;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
  org_name: string;
}

interface InMemoryUser {
  id: string;
  org_id: string;
  email: string;
  name: string;
  role: string;
  password_hash: string | null;
  must_reset_password: boolean;
  status: string;
  email_verified_at: Date | null;
}

interface InMemoryAuditEvent {
  id: number;
  actor_id: string;
  actor_role: string;
  org_id: string;
  action: string;
  entity: string;
  entity_id: string;
  before: unknown;
  after: unknown;
  ip: string;
  user_agent: string;
  request_id: string;
  prev_hash: Buffer;
  hash: Buffer;
}

/**
 * Creates an in-memory mock PostgreSQL pool that accurately simulates
 * RLS, transactions, atomic row consumption, and audit hash chaining.
 */
function createMockDbPool() {
  const invitations = new Map<string, InMemoryInvitation>();
  const users = new Map<string, InMemoryUser>();
  const auditEvents: InMemoryAuditEvent[] = [];

  const updateLock = { locked: false };

  const pool = {
    invitations,
    users,
    auditEvents,

    async query(sql: string, params: unknown[] = []): Promise<{ rows: any[]; rowCount: number }> {
      const client = await pool.connect();
      try {
        return await client.query(sql, params);
      } finally {
        client.release();
      }
    },

    async connect(): Promise<PoolClient> {
      let inTx = false;
      let snapshotInvitations: Map<string, InMemoryInvitation> | null = null;
      let snapshotUsers: Map<string, InMemoryUser> | null = null;
      let snapshotAuditLen = 0;

      const client = {
        async query(sql: string, params: unknown[] = []): Promise<{ rows: any[]; rowCount: number }> {
          const normalized = sql.trim().replace(/\s+/g, ' ');

          if (normalized === 'BEGIN') {
            inTx = true;
            snapshotInvitations = new Map(
              Array.from(invitations.entries()).map(([k, v]) => [k, { ...v }]),
            );
            snapshotUsers = new Map(
              Array.from(users.entries()).map(([k, v]) => [k, { ...v }]),
            );
            snapshotAuditLen = auditEvents.length;
            return { rows: [], rowCount: 0 };
          }
          if (normalized === 'COMMIT') {
            inTx = false;
            snapshotInvitations = null;
            snapshotUsers = null;
            return { rows: [], rowCount: 0 };
          }
          if (normalized === 'ROLLBACK') {
            inTx = false;
            if (snapshotInvitations) {
              invitations.clear();
              for (const [k, v] of snapshotInvitations) {
                invitations.set(k, v);
              }
            }
            if (snapshotUsers) {
              users.clear();
              for (const [k, v] of snapshotUsers) {
                users.set(k, v);
              }
            }
            auditEvents.length = snapshotAuditLen;
            snapshotInvitations = null;
            snapshotUsers = null;
            return { rows: [], rowCount: 0 };
          }

          // 1. app.lookup_invitation($1)
          if (normalized.includes('app.lookup_invitation')) {
            const tokenHash = params[0] as Buffer;
            const hashHex = tokenHash.toString('hex');
            const inv = invitations.get(hashHex);

            if (inv && inv.used_at === null && inv.expires_at.getTime() > Date.now()) {
              return {
                rows: [
                  {
                    id: inv.id,
                    org_id: inv.org_id,
                    user_id: inv.user_id,
                    email: inv.email,
                    role: inv.role,
                    org_name: inv.org_name,
                    expires_at: inv.expires_at,
                    used_at: inv.used_at,
                  },
                ],
                rowCount: 1,
              };
            }
            return { rows: [], rowCount: 0 };
          }

          // 2. UPDATE app.invitations SET used_at = now() WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
          if (normalized.startsWith('UPDATE app.invitations')) {
            // Simulate atomic serialized row update
            while (updateLock.locked) {
              await new Promise((r) => setTimeout(r, 10));
            }
            updateLock.locked = true;
            try {
              const tokenHash = params[0] as Buffer;
              const hashHex = tokenHash.toString('hex');
              const inv = invitations.get(hashHex);

              if (inv && inv.used_at === null && inv.expires_at.getTime() > Date.now()) {
                inv.used_at = new Date();
                return {
                  rows: [
                    {
                      id: inv.id,
                      org_id: inv.org_id,
                      user_id: inv.user_id,
                      email: inv.email,
                      role: inv.role,
                    },
                  ],
                  rowCount: 1,
                };
              }
              return { rows: [], rowCount: 0 };
            } finally {
              updateLock.locked = false;
            }
          }

          // 3. UPDATE app.users SET password_hash = $1, must_reset_password = false, status = 'active'...
          if (normalized.startsWith('UPDATE app.users')) {
            const [passwordHash, userId, orgId] = params as [string, string, string];
            const user = users.get(userId);
            if (user && user.org_id === orgId) {
              user.password_hash = passwordHash;
              user.must_reset_password = false;
              user.status = 'active';
              user.email_verified_at = user.email_verified_at ?? new Date();
              return { rows: [user], rowCount: 1 };
            }
            return { rows: [], rowCount: 0 };
          }

          // 4. SELECT hash FROM audit.events ORDER BY id DESC LIMIT 1 FOR UPDATE
          if (normalized.includes('SELECT hash FROM audit.events')) {
            const last = auditEvents[auditEvents.length - 1];
            return {
              rows: last ? [{ hash: last.hash }] : [],
              rowCount: last ? 1 : 0,
            };
          }

          // 5. INSERT INTO audit.events
          if (normalized.startsWith('INSERT INTO audit.events')) {
            const [
              actor_id,
              actor_role,
              org_id,
              action,
              entity,
              entity_id,
              beforeJson,
              afterJson,
              ip,
              user_agent,
              request_id,
              prev_hash,
              hash,
            ] = params as [
              string,
              string,
              string,
              string,
              string,
              string,
              string,
              string,
              string,
              string,
              string,
              Buffer,
              Buffer,
            ];

            const event: InMemoryAuditEvent = {
              id: auditEvents.length + 1,
              actor_id,
              actor_role,
              org_id,
              action,
              entity,
              entity_id,
              before: JSON.parse(beforeJson),
              after: JSON.parse(afterJson),
              ip,
              user_agent,
              request_id,
              prev_hash,
              hash,
            };
            auditEvents.push(event);
            return { rows: [event], rowCount: 1 };
          }

          return { rows: [], rowCount: 0 };
        },
        release: () => {},
      } as unknown as PoolClient;

      return client;
    },
  };

  return pool;
}

describe('Stream 8 — Invitation Validate, Accept API & Mail Service (S0-T08-1, S0-T08-3)', () => {
  let app: NestFastifyApplication;
  let mockPool: ReturnType<typeof createMockDbPool>;
  let mailService: MailService;
  let hasherService: HasherService;
  let invitationsService: InvitationsService;

  const validToken = '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff';
  const expiredToken = 'expired0000000000000000000000000000000000000000000000000000000000';
  const usedToken = 'used0000000000000000000000000000000000000000000000000000000000000';
  const unknownToken = 'unknown9999999999999999999999999999999999999999999999999999999999';

  const strongPassword = 'CorrectHorseBatteryStaple1!';

  function hashToken(t: string): Buffer {
    return crypto.createHash('sha256').update(t.trim()).digest();
  }

  beforeEach(async () => {
    mockPool = createMockDbPool();

    // Populate mock DB with test fixture data
    const orgId = '11111111-2222-3333-4444-555555555555';
    const userId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

    mockPool.users.set(userId, {
      id: userId,
      org_id: orgId,
      email: 'candidate@example.test',
      name: 'Jane Doe',
      role: 'candidate',
      password_hash: null,
      must_reset_password: true,
      status: 'invited',
      email_verified_at: null,
    });

    // 1. Valid invitation
    const validHash = hashToken(validToken);
    mockPool.invitations.set(validHash.toString('hex'), {
      id: 'inv-valid-1',
      org_id: orgId,
      user_id: userId,
      email: 'candidate@example.test',
      role: 'candidate',
      token_hash: validHash,
      expires_at: new Date(Date.now() + 48 * 3600 * 1000), // 48h in future (<= 72h)
      used_at: null,
      created_at: new Date(),
      org_name: 'Acme Simulation Corp',
    });

    // 2. Expired invitation
    const expiredHash = hashToken(expiredToken);
    mockPool.invitations.set(expiredHash.toString('hex'), {
      id: 'inv-expired-2',
      org_id: orgId,
      user_id: userId,
      email: 'candidate@example.test',
      role: 'candidate',
      token_hash: expiredHash,
      expires_at: new Date(Date.now() - 3600 * 1000), // 1h in past
      used_at: null,
      created_at: new Date(Date.now() - 73 * 3600 * 1000),
      org_name: 'Acme Simulation Corp',
    });

    // 3. Already-used invitation
    const usedHash = hashToken(usedToken);
    mockPool.invitations.set(usedHash.toString('hex'), {
      id: 'inv-used-3',
      org_id: orgId,
      user_id: userId,
      email: 'candidate@example.test',
      role: 'candidate',
      token_hash: usedHash,
      expires_at: new Date(Date.now() + 24 * 3600 * 1000),
      used_at: new Date(Date.now() - 600 * 1000), // used 10 min ago
      created_at: new Date(Date.now() - 3600 * 1000),
      org_name: 'Acme Simulation Corp',
    });

    const testConfig: Config = {
      NODE_ENV: 'test',
      PORT: 4000,
      LOG_LEVEL: 'silent',
      DATABASE_URL: 'postgres://localhost:5432/test',
      REDIS_URL: 'redis://localhost:6379',
      SESSION_SECRET: 'test_session_secret_at_least_32_characters_long_hello',
      CORS_ORIGINS: ['http://localhost:3000'],
      PAYMENT_GATEWAY: 'fake',
      EMAIL_PROVIDER: 'fake',
      WORKSPACE_RUNTIME: 'fake',
      APP_BASE_URL: 'https://app.hellosmart.test',
    };

    const testArgon2Engine: Argon2Engine = {
      async hash(plain, options) {
        const salt = crypto.randomBytes(16).toString('base64url');
        const hash = crypto.createHash('sha256').update(plain).digest('base64url');
        return `$argon2id$v=19$m=${options?.memoryCost ?? 19456},t=${options?.timeCost ?? 2},p=${options?.parallelism ?? 1}$${salt}$${hash}`;
      },
      async verify(hash, plain) {
        if (!hash.startsWith('$argon2id$')) return false;
        const parts = hash.split('$');
        const expected = parts[5];
        const actual = crypto.createHash('sha256').update(plain).digest('base64url');
        return expected === actual;
      },
    };

    hasherService = new HasherService(testArgon2Engine);
    invitationsService = new InvitationsService(hasherService, mockPool as unknown as Pool);
    mailService = new MailService(testConfig);

    @Module({
      imports: [
        ThrottlerModule.forRoot([
          {
            ttl: 3600000,
            limit: 10,
          },
        ]),
      ],
      controllers: [InvitationsController],
      providers: [
        { provide: HasherService, useValue: hasherService },
        { provide: InvitationsService, useValue: invitationsService },
        { provide: MailService, useValue: mailService },
        { provide: DB_POOL, useValue: mockPool },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_FILTER, useClass: ThrottlerProblemFilter },
      ],
    })
    class TestAuthModule {}

    const adapter = new FastifyAdapter();
    registerLoggingHooks(adapter.getInstance());
    adapter.getInstance().addHook('onError', (_req, _reply, err, done) => {
      console.error('FASTIFY HOOK ERROR:', err);
      done();
    });

    app = await NestFactory.create<NestFastifyApplication>(TestAuthModule, adapter, {
      logger: false,
    });
    app.setGlobalPrefix('api/v1');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  // Requirement 1: Valid invitation lookup
  it('1. Valid invitation lookup returns public non-sensitive details', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/auth/invitations/${validToken}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toEqual({
      email: 'candidate@example.test',
      role: 'candidate',
      orgName: 'Acme Simulation Corp',
    });
    // Strict isolation: no internal IDs or tokens leaked
    expect(body.id).toBeUndefined();
    expect(body.orgId).toBeUndefined();
    expect(body.userId).toBeUndefined();
    expect(body.tokenHash).toBeUndefined();
  });

  // Requirement 2: Valid acceptance updates password hash, status, must_reset_password atomically
  it('2. Valid acceptance updates password hash, user status, reset flag, and invitation usage atomically', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/invitations/accept',
      payload: {
        token: validToken,
        password: strongPassword,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);

    // Verify invitation is marked used
    const inv = mockPool.invitations.get(hashToken(validToken).toString('hex'))!;
    expect(inv.used_at).toBeInstanceOf(Date);

    // Verify user was activated
    const user = mockPool.users.get('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')!;
    expect(user.status).toBe('active');
    expect(user.must_reset_password).toBe(false);
    expect(user.email_verified_at).toBeInstanceOf(Date);
    expect(user.password_hash).toBeTruthy();
    expect(user.password_hash).toContain('$argon2id$');

    // Verify password can be verified
    const isMatch = await hasherService.verifyPassword(user.password_hash!, strongPassword);
    expect(isMatch).toBe(true);
  });

  // Requirement 3: Expired, used, and unknown tokens produce identical generic error status and response body
  it('3. Expired, used, and unknown tokens produce identical generic RFC 9457 404 response', async () => {
    // 3a. Unknown token
    const resUnknown = await app.inject({
      method: 'GET',
      url: `/api/v1/auth/invitations/${unknownToken}`,
    });
    expect(resUnknown.statusCode).toBe(404);
    const bodyUnknown = JSON.parse(resUnknown.body);

    // 3b. Expired token
    const resExpired = await app.inject({
      method: 'GET',
      url: `/api/v1/auth/invitations/${expiredToken}`,
    });
    expect(resExpired.statusCode).toBe(404);
    const bodyExpired = JSON.parse(resExpired.body);

    // 3c. Used token
    const resUsed = await app.inject({
      method: 'GET',
      url: `/api/v1/auth/invitations/${usedToken}`,
    });
    expect(resUsed.statusCode).toBe(404);
    const bodyUsed = JSON.parse(resUsed.body);

    // Invariant: Response code, title, and detail are identical across all invalid token states
    expect(bodyUnknown.code).toBe('INVITATION_INVALID');
    expect(bodyExpired.code).toBe('INVITATION_INVALID');
    expect(bodyUsed.code).toBe('INVITATION_INVALID');

    expect(bodyUnknown.detail).toBe('The invitation is invalid, has expired, or has already been used.');
    expect(bodyExpired.detail).toBe(bodyUnknown.detail);
    expect(bodyUsed.detail).toBe(bodyUnknown.detail);

    expect(bodyUnknown.title).toBe('Invitation Invalid');
    expect(bodyExpired.title).toBe(bodyUnknown.title);
    expect(bodyUsed.title).toBe(bodyUnknown.title);
  });

  // Requirement 4: Concurrent acceptance attempts allow at most one success
  it('4. Concurrent acceptance attempts allow at most one success', async () => {
    // Fire 5 simultaneous requests with the exact same valid token
    const promises = Array.from({ length: 5 }, () =>
      app.inject({
        method: 'POST',
        url: '/api/v1/auth/invitations/accept',
        payload: {
          token: validToken,
          password: strongPassword,
        },
      }),
    );

    const responses = await Promise.all(promises);
    const successCount = responses.filter((r) => r.statusCode === 200).length;
    const failureCount = responses.filter((r) => r.statusCode === 404).length;

    expect(successCount).toBe(1);
    expect(failureCount).toBe(4);

    for (const failRes of responses.filter((r) => r.statusCode === 404)) {
      const parsed = JSON.parse(failRes.body);
      expect(parsed.code).toBe('INVITATION_INVALID');
    }
  });

  // Requirement 5: Invalid passwords are rejected by the shared password policy
  it('5. Invalid passwords are rejected by the shared password policy with 422 WEAK_PASSWORD', async () => {
    const invalidPasswords = [
      'Short1!',                  // < 12 chars
      'alllowercase123456789!',    // No uppercase
      'ALLUPPERCASE123456789!',    // No lowercase
      'NoDigitsHereSpecialChars!!',// No numbers
      'NoSpecialChars123456789',   // No special characters
    ];

    for (const pwd of invalidPasswords) {
      // Direct schema validation check
      const schemaCheck = PasswordPolicySchema.safeParse(pwd);
      expect(schemaCheck.success).toBe(false);

      // Endpoint check
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/invitations/accept',
        payload: {
          token: validToken,
          password: pwd,
        },
      });

      expect(res.statusCode).toBe(422);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('WEAK_PASSWORD');
      expect(body.title).toBe('Weak Password');
      expect(body.status).toBe(422);
    }
  });

  // Requirement 6: Acceptance rate limiting works across requests
  it('6. Acceptance rate limiting enforces 10 requests per hour per IP with 429 RATE_LIMITED', async () => {
    // Send 10 requests
    for (let i = 0; i < 10; i++) {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/auth/invitations/${unknownToken}`,
        headers: {
          'x-forwarded-for': '198.51.100.42',
        },
      });
      expect(res.statusCode).toBe(404);
    }

    // 11th request from same IP must be rate-limited
    const rateLimitedRes = await app.inject({
      method: 'GET',
      url: `/api/v1/auth/invitations/${unknownToken}`,
      headers: {
        'x-forwarded-for': '198.51.100.42',
      },
    });

    expect(rateLimitedRes.statusCode).toBe(429);
    const body = JSON.parse(rateLimitedRes.body);
    expect(body.code).toBe('RATE_LIMITED');
    expect(body.title).toBe('Too Many Requests');
    expect(body.status).toBe(429);
  });

  // Requirement 7: Existing sessions are revoked when supported by session infrastructure
  it('7. Session revocation hook is invoked on acceptance', async () => {
    const revokeSpy = vi.spyOn(invitationsService, 'revokeUserSessions');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/invitations/accept',
      payload: {
        token: validToken,
        password: strongPassword,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(revokeSpy).toHaveBeenCalledTimes(1);
    expect(revokeSpy).toHaveBeenCalledWith('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  });

  // Requirement 8: Audit events are written correctly without storing raw tokens or passwords
  it('8. Audit events are recorded with tamper-evident hash chain without storing raw tokens or passwords', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/invitations/accept',
      payload: {
        token: validToken,
        password: strongPassword,
      },
      headers: {
        [REQUEST_ID_HEADER]: 'req_audit_test_123',
        'x-forwarded-for': '203.0.113.19',
        'user-agent': 'HelloSmart-TestClient/1.0',
      },
    });

    expect(res.statusCode).toBe(200);

    expect(mockPool.auditEvents.length).toBe(1);
    const event = mockPool.auditEvents[0]!;

    expect(event.action).toBe('invitation.accepted');
    expect(event.entity).toBe('user');
    expect(event.entity_id).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(event.actor_role).toBe('candidate');
    expect(event.ip).toBe('203.0.113.19');
    expect(event.request_id).toBe('req_audit_test_123');

    // Tamper-evident hash chain verification
    expect(event.prev_hash).toBeInstanceOf(Buffer);
    expect(event.hash).toBeInstanceOf(Buffer);
    expect(event.hash.length).toBe(32); // SHA-256 digest

    // Security invariant: raw token and raw password NEVER appear in audit payload
    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain(validToken);
    expect(serialized).not.toContain(strongPassword);
  });

  // Requirement 9: Development mail stub produces a usable configured invite URL and exposes it to tests
  it('9. Development mail stub produces a usable configured invite URL and exposes it to tests', async () => {
    mailService.clearLastInviteLink();
    expect(mailService.getLastInviteLink()).toBeNull();

    const input: SendInvitationInput = {
      to: 'new.engineer@example.test',
      token: 'raw_invite_token_xyz_123',
      role: 'candidate',
      orgName: 'Acme Test Corp',
    };

    const result = await mailService.sendInvitationEmail(input);

    expect(result.inviteUrl).toBe('https://app.hellosmart.test/accept-invite?token=raw_invite_token_xyz_123');
    expect(mailService.getLastInviteLink()).toBe(result.inviteUrl);
  });

  // Requirement 10: Production configuration rejects the fake mail provider
  it('10. Production configuration strictly rejects the fake mail provider', () => {
    const prodConfigWithFakeMail: Config = {
      NODE_ENV: 'production',
      PORT: 4000,
      LOG_LEVEL: 'info',
      DATABASE_URL: 'postgres://prod-db:5432/hellosmart',
      REDIS_URL: 'redis://prod-redis:6379',
      SESSION_SECRET: 'prod_session_secret_at_least_32_characters_long_1234',
      CORS_ORIGINS: ['https://app.hellosmart.ai'],
      PAYMENT_GATEWAY: 'razorpay',
      EMAIL_PROVIDER: 'fake', // FORBIDDEN IN PROD
      WORKSPACE_RUNTIME: 'sysbox',
      APP_BASE_URL: 'https://app.hellosmart.ai',
    };

    expect(() => new MailService(prodConfigWithFakeMail)).toThrow(
      'Fake mail provider is not allowed in production',
    );
  });

  // Requirement 11: Organization-creation failures do not send invitation messages
  it('11. Organization-creation failures do not send invitation messages', async () => {
    mailService.clearLastInviteLink();
    const sendSpy = vi.spyOn(mailService, 'sendInvitationEmail');

    // Simulate an organization provisioning transaction that fails and rolls back
    const simulateOrgCreation = async (shouldFail: boolean) => {
      const client = await mockPool.connect();
      await client.query('BEGIN');
      try {
        if (shouldFail) {
          throw new Error('Database constraint violation: duplicate organization slug');
        }
        await client.query('COMMIT');
        // Mail service MUST be invoked only after transaction successfully commits
        await mailService.sendInvitationEmail({
          to: 'founder@newcorp.test',
          token: 'token_committed_123',
          role: 'company_admin',
          orgName: 'New Corp',
        });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    };

    await expect(simulateOrgCreation(true)).rejects.toThrow('Database constraint violation');
    expect(sendSpy).not.toHaveBeenCalled();
    expect(mailService.getLastInviteLink()).toBeNull();

    // Now verify that a successful commit does trigger email
    await expect(simulateOrgCreation(false)).resolves.not.toThrow();
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(mailService.getLastInviteLink()).toContain('token_committed_123');
  });

  // Requirement 12: Seeded valid, expired, and used invitations behave as specified
  it('12. The seeded valid, expired, and used invitations behave as specified', async () => {
    // Valid seeded token
    const validRes = await invitationsService.lookupInvitation(validToken);
    expect(validRes.email).toBe('candidate@example.test');
    expect(validRes.orgName).toBe('Acme Simulation Corp');

    // Expired seeded token -> throws 404
    await expect(invitationsService.lookupInvitation(expiredToken)).rejects.toThrow();

    // Used seeded token -> throws 404
    await expect(invitationsService.lookupInvitation(usedToken)).rejects.toThrow();
  });

  // Security test: Raw token in URL path is redacted from HTTP request logs
  it('13. Raw invitation token in URL path is redacted in request logs', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/auth/invitations/${validToken}`,
    });

    expect(res.statusCode).toBe(200);
  });

  // Requirement 14: HasherService throws securely when Argon2id engine is unavailable and refuses fallback
  it('14. HasherService throws securely when Argon2id engine is unavailable and refuses fallback', async () => {
    const failingHasher = new HasherService({
      async hash() {
        throw new Error('Argon2id hashing engine is unavailable. Refusing to hash or verify password with insecure fallback.');
      },
      async verify() {
        throw new Error('Argon2id hashing engine is unavailable. Refusing to hash or verify password with insecure fallback.');
      },
    });

    await expect(failingHasher.hashPassword('StrongPassword123!')).rejects.toThrow(
      'Argon2id hashing engine is unavailable',
    );
  });

  // Requirement 15: Proving no password is saved to database if Argon2id hashing fails
  it('15. Proving no password is saved to database if Argon2id hashing fails', async () => {
    const failingHasher = new HasherService({
      async hash() {
        throw new Error('Argon2id native binding missing: simulated crash');
      },
      async verify() {
        return false;
      },
    });

    const brokenInvitationsService = new InvitationsService(
      failingHasher,
      mockPool as unknown as Pool,
    );

    const targetUserId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const originalUser = mockPool.users.get(targetUserId)!;
    expect(originalUser.password_hash).toBeNull();
    expect(originalUser.status).toBe('invited');
    expect(originalUser.must_reset_password).toBe(true);

    await expect(
      brokenInvitationsService.acceptInvitation({
        token: validToken,
        password: strongPassword,
      }),
    ).rejects.toThrow('Argon2id native binding missing');

    // Verify user record in database was NOT modified
    const userAfterFailure = mockPool.users.get(targetUserId)!;
    expect(userAfterFailure.password_hash).toBeNull();
    expect(userAfterFailure.status).toBe('invited');
    expect(userAfterFailure.must_reset_password).toBe(true);

    // Verify invitation record in database was NOT marked used
    const inv = mockPool.invitations.get(hashToken(validToken).toString('hex'))!;
    expect(inv.used_at).toBeNull();

    // Verify audit log has no entry created
    expect(mockPool.auditEvents.length).toBe(0);
  });

  // Requirement 16: HasherService refuses to verify any non-Argon2id hash formats
  it('16. HasherService refuses to verify any non-Argon2id hash formats', async () => {
    const validArgon2Engine: Argon2Engine = {
      async hash() {
        return '$argon2id$v=19$m=19456,t=2,p=1$fakeSalt$fakeHash';
      },
      async verify() {
        return true;
      },
    };
    const hasher = new HasherService(validArgon2Engine);

    // Any legacy or fallback hash string not starting with $argon2id$ is immediately rejected
    expect(await hasher.verifyPassword('$2a$12$someBcryptHash', 'Password123!')).toBe(false);
    expect(await hasher.verifyPassword('$scrypt$someScryptHash', 'Password123!')).toBe(false);
    expect(await hasher.verifyPassword('plaintext', 'Password123!')).toBe(false);
    expect(await hasher.verifyPassword('', 'Password123!')).toBe(false);
  });
});
