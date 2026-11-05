import cookie from '@fastify/cookie';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { CanActivate } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Test } from '@nestjs/testing';
import { authenticator } from 'otplib';
import { createClient } from 'redis';
import pg from 'pg';
import { AppModule } from '../src/app.module.js';
import { loadConfig } from '../src/config/config.js';
import { SessionService } from '../src/modules/session/session.service.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { withPlatform } from '../src/modules/tenancy/with-org.js';

export const DEV_PASSWORD = 'ChangeMe-Dev-Only-1';

export const SEED = {
  platformAdminEmail: 'superadmin@hellosmart.ai',
  companyAdminEmail: 'admin@asterridge.com',
  brindleOrgId: '43598d97-152e-5fe9-95e5-f55db8858a7f',
} as const;

export async function isStackInfraReady(): Promise<boolean> {
  const databaseUrl =
    process.env.DATABASE_ADMIN_URL ??
    process.env.DATABASE_MIGRATOR_URL ??
    process.env.DATABASE_URL;
  if (!databaseUrl) {
    return false;
  }
  try {
    const pool = new pg.Pool({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 3_000,
      max: 1,
    });
    const client = await pool.connect();
    const users = await client.query(
      `SELECT 1 FROM app.users WHERE email = $1 LIMIT 1`,
      [SEED.platformAdminEmail],
    );
    client.release();
    await pool.end();
    return (users.rowCount ?? 0) > 0;
  } catch {
    return false;
  }
}

async function isRedisReachable(): Promise<boolean> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return false;
  }
  try {
    const redis = createClient({ url: redisUrl });
    await redis.connect();
    await redis.ping();
    await redis.quit();
    return true;
  } catch {
    return false;
  }
}

export async function createStackTestApp(): Promise<NestFastifyApplication> {
  if (!(await isRedisReachable())) {
    delete process.env.REDIS_URL;
  }
  const config = loadConfig();
  const noopThrottler: CanActivate = { canActivate: () => true };
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideGuard(ThrottlerGuard)
    .useValue(noopThrottler)
    .overrideProvider(ThrottlerGuard)
    .useValue(noopThrottler)
    .compile();

  const app = moduleRef.createNestApplication(
    new FastifyAdapter({
      trustProxy: true,
      genReqId: () => crypto.randomUUID(),
    }),
  );
  app.setGlobalPrefix('api/v1');
  await app.register(cookie, { secret: config.SESSION_SECRET });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

export function sessionCookieFromResponse(res: {
  cookies?: Array<{ name: string; value: string }>;
}): string | undefined {
  return res.cookies?.find((c) => c.name === SessionService.cookieName())?.value;
}

export async function loginWithPassword(
  app: NestFastifyApplication,
  email: string,
  password: string,
  mfaCode?: string,
): Promise<{ statusCode: number; body: Record<string, unknown>; sessionCookie?: string }> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password, ...(mfaCode ? { mfaCode } : {}) },
  });
  const body = res.json() as Record<string, unknown>;
  return {
    statusCode: res.statusCode,
    body,
    sessionCookie: sessionCookieFromResponse(res),
  };
}

export async function completePlatformAdminLogin(
  app: NestFastifyApplication,
): Promise<string> {
  const first = await loginWithPassword(app, SEED.platformAdminEmail, DEV_PASSWORD);
  if (first.statusCode !== 200) {
    throw new Error(`Platform login step 1 failed: ${first.statusCode}`);
  }
  if (first.body.mfaRequired === true && typeof first.body.preAuthToken === 'string') {
    const secret = process.env.PLATFORM_ADMIN_MFA_SECRET;
    if (!secret) {
      throw new Error('PLATFORM_ADMIN_MFA_SECRET required for platform admin E2E');
    }
    const totpCode = authenticator.generate(secret);
    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/verify',
      payload: { preAuthToken: first.body.preAuthToken, totpCode },
    });
    if (second.statusCode !== 200) {
      throw new Error(`Platform MFA failed: ${second.statusCode}`);
    }
    const cookie = sessionCookieFromResponse(second);
    if (!cookie) {
      throw new Error('Expected hs_session cookie after MFA');
    }
    return cookie;
  }
  if (first.sessionCookie) {
    return first.sessionCookie;
  }
  throw new Error('Platform admin login did not yield a session');
}

export async function setUserPassword(email: string, password: string): Promise<void> {
  const url =
    process.env.DATABASE_PLATFORM_URL ??
    (process.env.DATABASE_URL
      ? process.env.DATABASE_URL.replace('hs_app:hs_app_local', 'hs_platform:hs_platform_local').replace('hs_app:', 'hs_platform:')
      : undefined);
  const pool = new pg.Pool({ connectionString: url ?? process.env.DATABASE_URL, max: 1 });
  const client = await pool.connect();
  const hash = await hashPassword(password);
  try {
    await withPlatform(client, async (tx) => {
      await tx.query(
        `UPDATE app.users SET password_hash = $1, status = 'active', must_reset_password = false
         WHERE lower(email::text) = $2`,
        [hash, email.trim().toLowerCase()],
      );
    });
  } finally {
    client.release();
    await pool.end();
  }
}
