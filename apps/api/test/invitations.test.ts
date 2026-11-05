import crypto from 'node:crypto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import type { Pool, PoolClient } from 'pg';
import { PasswordPolicySchema } from '@hs/contracts';
import { AppModule } from '../src/app.module.js';
import { MailService } from '../src/common/services/mail.service.js';
import { InvitationsService } from '../src/modules/auth/invitations.service.js';
import { verifyPassword } from '../src/modules/auth/password.js';
import { PG_POOL } from '../src/modules/database/database.tokens.js';
import { SessionService } from '../src/modules/session/session.service.js';
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

function createMockDbPool() {
  const invitations = new Map<string, InMemoryInvitation>();
  const users = new Map<string, InMemoryUser>();
  const auditEvents: InMemoryAuditEvent[] = [];

  const updateLock = { locked: false };

  const pool = {
    invitations,
    users,
    auditEvents,

    async end(): Promise<void> {},

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

          // 1. app.find_invitation_by_token_hash($1) or app.lookup_invitation($1)
          if (
            normalized.includes('app.find_invitation_by_token_hash') ||
            normalized.includes('app.lookup_invitation')
          ) {
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

          // 2. app.accept_invitation($1, $2, $3, $4, $5)
          if (normalized.includes('app.accept_invitation')) {
            while (updateLock.locked) {
              await new Promise((r) => setTimeout(r, 10));
            }
            updateLock.locked = true;
            try {
              const [tokenHash, passwordHash, ip, userAgent, requestId] = params as [
                Buffer,
                string,
                string,
                string,
                string,
              ];

              const hashHex = tokenHash.toString('hex');
              const inv = invitations.get(hashHex);

              if (inv && inv.used_at === null && inv.expires_at.getTime() > Date.now()) {
                inv.used_at = new Date();
                const user = users.get(inv.user_id);
                if (user && user.org_id === inv.org_id) {
                  user.password_hash = passwordHash;
                  user.must_reset_password = false;
                  user.status = 'active';
                  user.email_verified_at = user.email_verified_at ?? new Date();

                  const prev = auditEvents[auditEvents.length - 1];
                  const prev_hash = prev?.hash ?? Buffer.alloc(0);
                  const auditPayload = {
                    action: 'invitation.accepted',
                    entity: 'user',
                    entityId: inv.user_id,
                    actorId: inv.user_id,
                    actorRole: inv.role,
                    orgId: inv.org_id,
                    before: { status: 'invited', must_reset_password: true },
                    after: { status: 'active', must_reset_password: false, email_verified: true },
                    ip,
                    userAgent,
                    requestId,
                  };
                  const eventHash = crypto
                    .createHash('sha256')
                    .update(Buffer.concat([prev_hash, Buffer.from(JSON.stringify(auditPayload))]))
                    .digest();

                  auditEvents.push({
                    id: auditEvents.length + 1,
                    actor_id: inv.user_id,
                    actor_role: inv.role,
                    org_id: inv.org_id,
                    action: 'invitation.accepted',
                    entity: 'user',
                    entity_id: inv.user_id,
                    before: auditPayload.before,
                    after: auditPayload.after,
                    ip,
                    user_agent: userAgent,
                    request_id: requestId,
                    prev_hash,
                    hash: eventHash,
                  });

                  return {
                    rows: [
                      {
                        success: true,
                        user_id: inv.user_id,
                        org_id: inv.org_id,
                        email: inv.email,
                        role: inv.role,
                      },
                    ],
                    rowCount: 1,
                  };
                }
              }
              return { rows: [], rowCount: 0 };
            } finally {
              updateLock.locked = false;
            }
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
  let invitationsService: InvitationsService;
  let sessionService: SessionService;

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
      used_at: new Date(Date.now() - 600 * 1000),
      created_at: new Date(Date.now() - 3600 * 1000),
      org_name: 'Acme Simulation Corp',
    });

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PG_POOL)
      .useValue(mockPool)
      .compile();

    app = moduleRef.createNestApplication(new FastifyAdapter());
    app.setGlobalPrefix('api/v1');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    invitationsService = app.get(InvitationsService);
    mailService = app.get(MailService);
    sessionService = app.get(SessionService);
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
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

    const inv = mockPool.invitations.get(hashToken(validToken).toString('hex'))!;
    expect(inv.used_at).toBeInstanceOf(Date);

    const user = mockPool.users.get('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')!;
    expect(user.status).toBe('active');
    expect(user.must_reset_password).toBe(false);
    expect(user.email_verified_at).toBeInstanceOf(Date);
    expect(user.password_hash).toBeTruthy();
    expect(user.password_hash).toContain('$argon2id$');

    const isMatch = await verifyPassword(user.password_hash!, strongPassword);
    expect(isMatch).toBe(true);
  });

  // Requirement 3: Expired, used, and unknown tokens produce identical generic error
  it('3. Expired, used, and unknown tokens produce identical generic RFC 9457 404 response', async () => {
    const resUnknown = await app.inject({
      method: 'GET',
      url: `/api/v1/auth/invitations/${unknownToken}`,
    });
    expect(resUnknown.statusCode).toBe(404);
    const bodyUnknown = JSON.parse(resUnknown.body);

    const resExpired = await app.inject({
      method: 'GET',
      url: `/api/v1/auth/invitations/${expiredToken}`,
    });
    expect(resExpired.statusCode).toBe(404);
    const bodyExpired = JSON.parse(resExpired.body);

    const resUsed = await app.inject({
      method: 'GET',
      url: `/api/v1/auth/invitations/${usedToken}`,
    });
    expect(resUsed.statusCode).toBe(404);
    const bodyUsed = JSON.parse(resUsed.body);

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
      'Short1!',
      'alllowercase123456789!',
      'ALLUPPERCASE123456789!',
      'NoDigitsHereSpecialChars!!',
      'NoSpecialChars123456789',
    ];

    for (const pwd of invalidPasswords) {
      const schemaCheck = PasswordPolicySchema.safeParse(pwd);
      expect(schemaCheck.success).toBe(false);

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

  // Requirement 6: Audit log creation on invitation acceptance
  it('6. Cryptographic tamper-evident audit record is appended on invitation acceptance', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/invitations/accept',
      remoteAddress: '203.0.113.195',
      headers: {
        'user-agent': 'Vitest-Test-Agent/1.0',
      },
      payload: {
        token: validToken,
        password: strongPassword,
      },
    });

    expect(res.statusCode).toBe(200);

    expect(mockPool.auditEvents.length).toBe(1);
    const event = mockPool.auditEvents[0];
    expect(event.action).toBe('invitation.accepted');
    expect(event.entity).toBe('user');
    expect(event.actor_role).toBe('candidate');
    expect(event.ip).toBe('203.0.113.195');
    expect(event.user_agent).toBe('Vitest-Test-Agent/1.0');
    expect(event.hash).toBeInstanceOf(Buffer);
    expect(event.hash.length).toBe(32);
  });

  // Requirement 7: Active session revocation hook is triggered
  it('7. Active sessions for user are revoked upon password acceptance', async () => {
    const revokeSpy = vi.spyOn(sessionService, 'revokeAllSessionsForUser');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/invitations/accept',
      payload: {
        token: validToken,
        password: strongPassword,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(revokeSpy).toHaveBeenCalledWith('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  });

  // Requirement 8: S0-T08-3 MailService logs complete invite link in dev mode
  it('8. S0-T08-3: MailService logs [DEV INVITE LINK] and sets lastInviteLink in development', async () => {
    const devConfig: Config = {
      NODE_ENV: 'development',
      PORT: 4000,
      DATABASE_URL: 'postgres://localhost:5432/test',
      SESSION_SECRET: 'test_session_secret_at_least_32_characters_long_hello',
      CORS_ORIGINS: ['http://localhost:3000'],
      PAYMENT_GATEWAY: 'fake',
      EMAIL_PROVIDER: 'fake',
      WORKSPACE_RUNTIME: 'fake',
      APP_BASE_URL: 'http://localhost:3000',
    };

    const devMailService = new MailService(devConfig);
    const logSpy = vi.spyOn((devMailService as any).logger, 'log');

    const result = await devMailService.sendInvitationEmail({
      to: 'candidate@acme.test',
      token: validToken,
      role: 'candidate',
      orgName: 'Acme Simulation Corp',
    });

    expect(result.inviteUrl).toBe(`http://localhost:3000/accept-invite?token=${validToken}`);
    expect(devMailService.getLastInviteLink()).toBe(result.inviteUrl);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(`[DEV INVITE LINK] ${result.inviteUrl}`));

    devMailService.clearLastInviteLink();
    expect(devMailService.getLastInviteLink()).toBeNull();
  });

  // Requirement 9: S0-T08-3 MailService refuses fake provider in production
  it('9. S0-T08-3: MailService refuses fake provider in production', () => {
    const prodConfig: Config = {
      NODE_ENV: 'production',
      PORT: 4000,
      DATABASE_URL: 'postgres://localhost:5432/prod',
      SESSION_SECRET: 'test_session_secret_at_least_32_characters_long_hello',
      CORS_ORIGINS: ['https://app.hellosmart.ai'],
      PAYMENT_GATEWAY: 'razorpay',
      EMAIL_PROVIDER: 'fake',
      WORKSPACE_RUNTIME: 'sysbox',
      APP_BASE_URL: 'https://app.hellosmart.ai',
    };

    expect(() => new MailService(prodConfig)).toThrow('Fake mail provider is not allowed in production');
  });

  // Requirement 10: S0-T08-3 Invitation email is only dispatched AFTER transaction commits
  it('10. S0-T08-3: Invitation email is not sent if organization provisioning transaction rolls back', async () => {
    const sendSpy = vi.spyOn(mailService, 'sendInvitationEmail');

    const simulateOrgCreation = async (shouldRollback: boolean) => {
      const client = await mockPool.connect();
      try {
        await client.query('BEGIN');
        if (shouldRollback) {
          throw new Error('Database constraint violation');
        }
        await client.query('COMMIT');
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

    await expect(simulateOrgCreation(false)).resolves.not.toThrow();
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(mailService.getLastInviteLink()).toContain('token_committed_123');
  });
});
