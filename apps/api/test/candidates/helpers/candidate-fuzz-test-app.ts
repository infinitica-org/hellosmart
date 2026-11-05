import crypto from 'node:crypto';
import v8 from 'node:v8';
import vm from 'node:vm';
import pg from 'pg';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { vi, type MockInstance } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import { MailService } from '../../../src/common/services/mail.service.js';
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

export interface CandidateFuzzTestContext {
  app: NestFastifyApplication;
  moduleRef: TestingModule;
  sessionService: SessionService;
  mailService: MailService;
  mailSpy: MockInstance;
  appPool: pg.Pool;
  adminPool: pg.Pool;
  platformPool: pg.Pool;
  corsOrigin: string;
}

/**
 * Checks connectivity to the test database hellosmart_test.
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
 * Boots the Nest Fastify in-process application for candidate fuzz tests.
 * Spies on MailService.sendInvitationEmail to intercept outbound emails
 * and prevent external network calls to Mailpit.
 */
export async function createCandidateFuzzTestApp(): Promise<CandidateFuzzTestContext> {
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
  const mailService = app.get(MailService);

  // Invariant (Lesson 6): Spy and mock sendInvitationEmail so no real network requests are made
  const mailSpy = vi.spyOn(mailService, 'sendInvitationEmail').mockImplementation(async () => {
    // inert mock
  });

  const appPool = new pg.Pool({ connectionString: DATABASE_URL });
  const adminPool = new pg.Pool({ connectionString: DATABASE_ADMIN_URL });
  const platformPool = new pg.Pool({ connectionString: DATABASE_PLATFORM_URL });

  return {
    app,
    moduleRef,
    sessionService,
    mailService,
    mailSpy,
    appPool,
    adminPool,
    platformPool,
    corsOrigin,
  };
}

/**
 * Generates an in-memory session token for a given user context.
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
    portal: user.role === 'candidate' ? 'candidate' : 'company',
  });
  return session.rawToken;
}

/**
 * Generates a random hex nonce for test organization and candidate uniqueness.
 */
export function generateTestNonce(): string {
  return crypto.randomBytes(4).toString('hex');
}

/**
 * Exposes and executes Node V8 garbage collection dynamically at runtime.
 */
export function forceGarbageCollection(): boolean {
  try {
    if (typeof global.gc === 'function') {
      global.gc();
      return true;
    }
    v8.setFlagsFromString('--expose_gc');
    const gc = vm.runInNewContext('gc') as (() => void) | undefined;
    if (typeof gc === 'function') {
      gc();
      return true;
    }
  } catch {
    // V8 GC not exposed in this environment
  }
  return false;
}

/**
 * RLS-safe query helper: count users in an organization using hs_platform role.
 */
export async function countOrgUsers(
  platformPool: pg.Pool,
  orgId: string,
  emailPattern?: string,
): Promise<number> {
  const client = await platformPool.connect();
  try {
    await client.query(`SELECT set_config('app.is_platform', 'true', false)`);
    const res = emailPattern
      ? await client.query<{ count: string }>(
          `SELECT count(*)::text as count FROM app.users WHERE org_id = $1 AND email LIKE $2`,
          [orgId, emailPattern],
        )
      : await client.query<{ count: string }>(
          `SELECT count(*)::text as count FROM app.users WHERE org_id = $1`,
          [orgId],
        );
    return Number(res.rows[0].count);
  } finally {
    client.release();
  }
}

/**
 * RLS-safe query helper: count invitations in an organization using hs_platform role.
 */
export async function countOrgInvitations(
  platformPool: pg.Pool,
  orgId: string,
  emailPattern?: string,
): Promise<number> {
  const client = await platformPool.connect();
  try {
    await client.query(`SELECT set_config('app.is_platform', 'true', false)`);
    const res = emailPattern
      ? await client.query<{ count: string }>(
          `SELECT count(*)::text as count FROM app.invitations WHERE org_id = $1 AND email LIKE $2`,
          [orgId, emailPattern],
        )
      : await client.query<{ count: string }>(
          `SELECT count(*)::text as count FROM app.invitations WHERE org_id = $1`,
          [orgId],
        );
    return Number(res.rows[0].count);
  } finally {
    client.release();
  }
}

/**
 * RLS-safe teardown: cleanly deletes test data in reverse dependency order.
 */
export async function cleanOrgData(platformPool: pg.Pool, orgIds: string[]): Promise<void> {
  if (orgIds.length === 0) return;
  const client = await platformPool.connect();
  try {
    await client.query(`SELECT set_config('app.is_platform', 'true', false)`);
    await client.query(`DELETE FROM app.invitations WHERE org_id = ANY($1)`, [orgIds]);
    await client.query(`DELETE FROM app.users WHERE org_id = ANY($1)`, [orgIds]);
    await client.query(`DELETE FROM app.entitlements WHERE org_id = ANY($1)`, [orgIds]);
    await client.query(`DELETE FROM app.organizations WHERE id = ANY($1)`, [orgIds]);
  } finally {
    client.release();
  }
}
