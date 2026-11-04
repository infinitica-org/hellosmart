import crypto from 'node:crypto';
import pg from 'pg';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../../../src/app.module.js';
import { SessionService } from '../../../src/modules/session/session.service.js';
import type { UserContext } from '../../../src/common/types/user-context.js';

export const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://hs_app:hs_app_local@127.0.0.1:5432/hellosmart_test';

export const DATABASE_PLATFORM_URL =
  process.env.DATABASE_PLATFORM_URL ??
  'postgres://hs_platform:hs_platform_local@127.0.0.1:5432/hellosmart_test';

export const DATABASE_ADMIN_URL =
  process.env.DATABASE_ADMIN_URL ??
  'postgres://hs_owner:hs_owner_local@127.0.0.1:5432/hellosmart_test';

export interface TimingTestContext {
  app: NestFastifyApplication;
  moduleRef: TestingModule;
  sessionService: SessionService;
  appPool: pg.Pool;
  adminPool: pg.Pool;
  corsOrigin: string;
}

/**
 * Probes whether the PostgreSQL test database is reachable.
 * Returns true if accessible, false if port is closed/unreachable.
 */
export async function checkDbConnection(connectionString: string = DATABASE_URL): Promise<boolean> {
  const probe = new pg.Pool({
    connectionString,
    connectionTimeoutMillis: 3000,
    max: 1,
  });

  try {
    const client = await probe.connect();
    await client.query('SELECT 1');
    client.release();
    await probe.end();
    return true;
  } catch {
    await probe.end().catch(() => {});
    return false;
  }
}

/**
 * Boots the Nest Fastify test application for timing tests.
 */
export async function createTimingTestApp(): Promise<TimingTestContext> {
  const corsOrigin =
    (Array.isArray(process.env.CORS_ORIGINS)
      ? process.env.CORS_ORIGINS[0]
      : process.env.CORS_ORIGINS) ?? 'http://localhost:3000';

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication(new FastifyAdapter());
  app.setGlobalPrefix('api/v1');
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  const sessionService = app.get(SessionService);
  const appPool = new pg.Pool({ connectionString: DATABASE_URL });
  const adminPool = new pg.Pool({ connectionString: DATABASE_ADMIN_URL });

  return {
    app,
    moduleRef,
    sessionService,
    appPool,
    adminPool,
    corsOrigin,
  };
}

/**
 * Creates an in-memory session token for a given user context.
 */
export async function createTestSession(
  sessionService: SessionService,
  user: UserContext,
): Promise<string> {
  const session = await sessionService.createSession({
    userId: user.userId,
    email: user.email,
    role: user.role,
    orgId: user.orgId,
  });
  return session.rawToken;
}

/**
 * Generates a random hex nonce for test data isolation.
 */
export function generateTestNonce(): string {
  return crypto.randomBytes(4).toString('hex');
}
