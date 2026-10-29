import cookie from '@fastify/cookie';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/common/database/database.service.js';
import { SessionService } from '../src/modules/session/session.service.js';

describe('S0-T16-1: Session Store Outage Fail-Closed Security', () => {
  let app: NestFastifyApplication;
  let sessionService: SessionService;
  let db: DatabaseService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication(new FastifyAdapter());
    await app.register(cookie, { secret: 'test-session-secret-for-signing-cookies' });
    app.setGlobalPrefix('api/v1');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    sessionService = app.get(SessionService);
    db = app.get(DatabaseService);
    db.setStatusChecker(async () => ({
      userStatus: 'active',
      orgStatus: 'paid_active',
    }));
  });

  afterAll(async () => {
    await app.close();
  });

  it('fails closed with HTTP 503 and SESSION_STORE_UNAVAILABLE when session store throws an error', async () => {
    // Simulate Redis store network connection crash / outage
    vi.spyOn(sessionService, 'resolveSession').mockRejectedValueOnce(
      new Error('ECONNREFUSED: Redis cluster node 127.0.0.1:6379 unreachable'),
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/sessions',
      headers: {
        cookie: 'hs_session=some-token-during-redis-outage',
      },
    });

    expect(res.statusCode).toBe(503);
    expect(res.headers['content-type']).toContain('application/problem+json');
    const body = res.json();
    expect(body.status).toBe(503);
    expect(body.code).toBe('SESSION_STORE_UNAVAILABLE');
    expect(body.title).toBe('Service Unavailable');
  });

  it('fails closed with HTTP 503 and ACCOUNT_CHECK_UNAVAILABLE when database status check throws an error', async () => {
    const s = await sessionService.createSession({
      userId: '44444444-4444-4444-8444-444444444444',
      email: 'user@example.test',
      role: 'company_admin',
      orgId: '03fa0961-c787-51dd-a4f6-d445495111c6',
    });

    vi.spyOn(db, 'checkAccountStatus').mockRejectedValueOnce(
      new Error('ECONNREFUSED: Postgres server 127.0.0.1:5432 unreachable'),
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/sessions',
      headers: {
        cookie: `hs_session=${s.rawToken}`,
      },
    });

    expect(res.statusCode).toBe(503);
    expect(res.headers['content-type']).toContain('application/problem+json');
    const body = res.json();
    expect(body.status).toBe(503);
    expect(body.code).toBe('ACCOUNT_CHECK_UNAVAILABLE');
    expect(body.title).toBe('Service Unavailable');
  });
});

