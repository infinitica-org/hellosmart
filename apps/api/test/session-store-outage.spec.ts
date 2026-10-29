import cookie from '@fastify/cookie';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { SessionService } from '../src/modules/session/session.service.js';

describe('S0-T16-1: Session Store Outage Fail-Closed Security', () => {
  let app: NestFastifyApplication;
  let sessionService: SessionService;

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
});
