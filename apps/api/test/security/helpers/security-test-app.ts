import crypto from 'node:crypto';
import cookie from '@fastify/cookie';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { CanActivate } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../../src/app.module.js';
import { loadConfig } from '../../../src/config/config.js';

export async function checkDbConnection(url?: string): Promise<boolean> {
  const connStr =
    url ??
    process.env.DATABASE_URL ??
    'postgres://hs_app:hs_app_local@127.0.0.1:5432/hellosmart_test';
  try {
    const pg = await import('pg');
    const probe = new pg.default.Pool({
      connectionString: connStr,
      connectionTimeoutMillis: 3000,
      max: 1,
    });
    const client = await probe.connect();
    await client.query('SELECT 1');
    client.release();
    await probe.end();
    return true;
  } catch {
    return false;
  }
}

export async function createSecurityTestApp(): Promise<{
  app: NestFastifyApplication;
  registeredRoutes: Array<{ method: string; url: string }>;
}> {
  const config = loadConfig();
  const registeredRoutes: Array<{ method: string; url: string }> = [];

  // Disable throttling during penetration tests so tests verify authorization/tenancy rather than 429s
  const noopThrottler: CanActivate = { canActivate: () => true };

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideGuard(ThrottlerGuard)
    .useValue(noopThrottler)
    .overrideProvider(ThrottlerGuard)
    .useValue(noopThrottler)
    .compile();

  const adapter = new FastifyAdapter({
    trustProxy: true,
    genReqId: () => crypto.randomUUID(),
  });

  adapter.getInstance().addHook('onRoute', (routeOptions) => {
    const methods = Array.isArray(routeOptions.method)
      ? routeOptions.method
      : [routeOptions.method];
    for (const m of methods) {
      if (m !== 'HEAD') {
        registeredRoutes.push({ method: m, url: routeOptions.url });
      }
    }
  });

  const app = moduleRef.createNestApplication(adapter);
  app.setGlobalPrefix('api/v1');
  await app.register(cookie, { secret: config.SESSION_SECRET });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return { app, registeredRoutes };
}
