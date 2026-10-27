import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { SessionService } from '../src/modules/session/session.service.js';

describe('@hs/api foundation', () => {
  let app: NestFastifyApplication;
  let sessionAuth: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication(new FastifyAdapter());
    app.setGlobalPrefix('api/v1');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    const sessions = app.get(SessionService);
    const { sessionId } = await sessions.createSession({
      userId: '11111111-1111-4111-8111-111111111111',
      email: 'admin@asterridge.com',
      role: 'company_admin',
      orgId: '03fa0961-c787-51dd-a4f6-d445495111c6',
    });
    sessionAuth = `Bearer ${sessionId}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('test(BR-01): SessionGuard returns 401 problem+json without session', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/_test/org/03fa0961-c787-51dd-a4f6-d445495111c6/ping',
    });
    expect(res.statusCode).toBe(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
    const body = res.json() as { code: string };
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('RolesGuard returns 403 when role does not match', async () => {
    const sessions = app.get(SessionService);
    const { sessionId } = await sessions.createSession({
      userId: '22222222-2222-4222-8222-222222222222',
      email: 'candidate@example.test',
      role: 'candidate',
      orgId: '03fa0961-c787-51dd-a4f6-d445495111c6',
    });
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/_test/org/03fa0961-c787-51dd-a4f6-d445495111c6/ping',
      headers: { authorization: `Bearer ${sessionId}` },
    });
    expect(res.statusCode).toBe(403);
    const body = res.json() as { code: string };
    expect(body.code).toBe('FORBIDDEN');
  });

  it('test(BR-01): OrgScopeGuard returns 404 on cross-tenant org param', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/_test/org/43598d97-152e-5fe9-95e5-f55db8858a7f/ping',
      headers: { authorization: sessionAuth },
    });
    expect(res.statusCode).toBe(404);
    const body = res.json() as { code: string };
    expect(body.code).toBe('TENANT_NOT_FOUND');
  });

  it('test(BR-04): company admin cannot call platform admin org provisioning', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/organizations',
      headers: { authorization: sessionAuth },
      payload: {
        name: 'Evil Corp',
        adminEmail: 'evil@example.test',
        adminName: 'Evil Admin',
      },
    });
    expect(res.statusCode).toBe(403);
    const body = res.json() as { code: string };
    expect(body.code).toBe('FORBIDDEN');
  });

  it('OrgScopeGuard allows matching org', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/_test/org/03fa0961-c787-51dd-a4f6-d445495111c6/ping',
      headers: { authorization: sessionAuth },
    });
    expect(res.statusCode).toBe(200);
  });

  it('IdempotencyInterceptor replays identical response', async () => {
    const key = crypto.randomUUID();
    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/_test/mutate',
      headers: {
        authorization: sessionAuth,
        'idempotency-key': key,
      },
    });
    expect(first.statusCode).toBe(200);
    const firstBody = first.json() as { userId: string; at: string };

    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/_test/mutate',
      headers: {
        authorization: sessionAuth,
        'idempotency-key': key,
      },
    });
    expect(second.headers['x-idempotent-replayed']).toBe('true');
    expect(second.json()).toEqual(firstBody);
  });

});
