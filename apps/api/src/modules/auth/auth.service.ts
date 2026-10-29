import { Inject, Injectable } from '@nestjs/common';
import type { LoginDto, LogoutResponseDto, MeDto, MfaVerifyDto } from '@hs/contracts';
import type { Pool, PoolClient } from 'pg';
import { problem } from '../../common/errors/app-http.exception.js';
import type { UserContext, UserRole } from '../../common/types/user-context.js';
import { appendAuditEvent } from '../audit/audit-writer.js';
import type { AuditRecordInput } from '../audit/audit.types.js';
import { PG_POOL } from '../database/database.tokens.js';
import { SessionService, SESSION_TTL_SECONDS } from '../session/session.service.js';
import { toMeDto } from './auth.mapper.js';
import { LoginLockoutService } from './login-lockout.service.js';
import { MfaService } from './mfa.service.js';
import { PreAuthService } from './pre-auth.service.js';
import { verifyPassword, verifyWithDummyTiming } from './password.js';

interface DbUserRow {
  id: string;
  org_id: string | null;
  email: string;
  name: string;
  role: UserRole;
  password_hash: string | null;
  status: string;
  must_reset_password: boolean;
  mfa_secret_ref: string | null;
  org_status: string | null;
  org_name: string | null;
  logo_key: string | null;
}

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
  requestId?: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(LoginLockoutService) private readonly lockout: LoginLockoutService,
    @Inject(PreAuthService) private readonly preAuth: PreAuthService,
    @Inject(MfaService) private readonly mfa: MfaService,
  ) {}

  async login(
    dto: LoginDto,
    meta: RequestMeta,
  ): Promise<MeDto | { mfaRequired: true; preAuthToken: string }> {
    const email = dto.email.trim().toLowerCase();
    await this.lockout.assertNotLocked(email);

    const user = await this.findUserByEmail(email);
    if (!user) {
      await verifyWithDummyTiming(dto.password);
      await this.lockout.recordFailure(email);
      await this.auditLogin(null, 'anonymous', null, false, meta);
      throw invalidCredentials();
    }

    this.assertAccountActive(user);

    const hash = user.password_hash;
    if (!hash) {
      await verifyWithDummyTiming(dto.password);
      await this.lockout.recordFailure(email);
      await this.auditLogin(user.id, user.role, user.org_id, false, meta);
      throw invalidCredentials();
    }

    const ok = await verifyPassword(hash, dto.password);
    if (!ok) {
      await this.lockout.recordFailure(email);
      await this.auditLogin(user.id, user.role, user.org_id, false, meta);
      throw invalidCredentials();
    }

    await this.lockout.clearFailures(email);

    if (user.role === 'platform_admin') {
      if (dto.mfaCode) {
        const secret = this.mfa.resolveSecret(user.mfa_secret_ref);
        if (!this.mfa.verifyTotp(secret, dto.mfaCode)) {
          await this.auditLogin(user.id, user.role, user.org_id, false, meta);
          throw problem({
            title: 'Unauthorized',
            status: 401,
            detail: 'Invalid MFA code',
            code: 'MFA_INVALID',
          });
        }
        return this.completeLogin(user, meta);
      }
      const preAuthToken = await this.preAuth.issue(user.id);
      return { mfaRequired: true, preAuthToken };
    }

    return this.completeLogin(user, meta);
  }

  async verifyMfa(dto: MfaVerifyDto, meta: RequestMeta): Promise<MeDto> {
    const payload = await this.preAuth.get(dto.preAuthToken);
    if (!payload) {
      throw problem({
        title: 'Unauthorized',
        status: 401,
        detail: 'Pre-authentication expired or invalid',
        code: 'PREAUTH_INVALID',
      });
    }

    const user = await this.findUserById(payload.userId);
    if (!user || user.role !== 'platform_admin') {
      await this.preAuth.delete(dto.preAuthToken);
      throw problem({
        title: 'Unauthorized',
        status: 401,
        detail: 'Pre-authentication expired or invalid',
        code: 'PREAUTH_INVALID',
      });
    }

    this.assertAccountActive(user);

    const secret = this.mfa.resolveSecret(user.mfa_secret_ref);
    if (!this.mfa.verifyTotp(secret, dto.totpCode)) {
      await this.preAuth.recordFailedAttempt(dto.preAuthToken);
      await this.auditLogin(user.id, user.role, user.org_id, false, meta);
      throw problem({
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid MFA code',
        code: 'MFA_INVALID',
      });
    }

    await this.preAuth.delete(dto.preAuthToken);
    return this.completeLogin(user, meta);
  }

  async getMe(userId: string): Promise<MeDto> {
    const user = await this.findUserById(userId);
    if (!user) {
      throw problem({
        title: 'Unauthorized',
        status: 401,
        detail: 'User not found',
        code: 'UNAUTHORIZED',
      });
    }
    this.assertAccountActive(user);
    return this.toMeFromRow(user);
  }

  async logout(rawToken: string | undefined): Promise<LogoutResponseDto> {
    if (rawToken) {
      await this.sessions.destroySession(rawToken);
    }
    return { success: true, message: 'Logged out successfully' };
  }

  async createSessionForUserId(
    userId: string,
    meta?: RequestMeta,
  ): Promise<{ rawToken: string; sessionId: string; me: MeDto }> {
    const user = await this.findUserById(userId);
    if (!user) {
      throw problem({
        title: 'Unauthorized',
        status: 401,
        detail: 'User not found',
        code: 'UNAUTHORIZED',
      });
    }
    const context: UserContext = {
      userId: user.id,
      email: user.email,
      role: user.role,
      orgId: user.org_id,
    };
    const { rawToken, sessionId } = await this.sessions.createSession(context, {
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
    return { rawToken, sessionId, me: this.toMeFromRow(user) };
  }

  private async completeLogin(user: DbUserRow, meta: RequestMeta): Promise<MeDto> {
    await this.pool.query('SELECT app.record_login_success($1)', [user.id]);
    await this.auditLogin(user.id, user.role, user.org_id, true, meta);
    return this.toMeFromRow(user);
  }

  private async auditLogin(
    actorId: string | null,
    actorRole: string,
    orgId: string | null,
    success: boolean,
    meta: RequestMeta,
    client?: PoolClient,
  ): Promise<void> {
    const input: AuditRecordInput = {
      actorId,
      actorRole,
      orgId,
      action: success ? 'auth.login.success' : 'auth.login.failed',
      entity: 'user',
      after: { success },
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
      requestId: meta.requestId ?? null,
    };
    if (actorId) {
      input.entityId = actorId;
    }
    if (client) {
      await appendAuditEvent(client, input);
      return;
    }
    const pooled = await this.pool.connect();
    try {
      await appendAuditEvent(pooled, input);
    } finally {
      pooled.release();
    }
  }

  private assertAccountActive(user: DbUserRow): void {
    if (user.status === 'suspended' || user.status === 'deleted') {
      throw problem({
        title: 'Forbidden',
        status: 403,
        detail: 'Account is not active',
        code: 'ACCOUNT_SUSPENDED',
      });
    }
    if (user.org_id && user.org_status === 'suspended') {
      throw problem({
        title: 'Forbidden',
        status: 403,
        detail: 'Organization is suspended',
        code: 'ORG_SUSPENDED',
      });
    }
  }

  private toMeFromRow(user: DbUserRow): MeDto {
    const org =
      user.org_id && user.org_name
        ? {
            id: user.org_id,
            name: user.org_name,
            logoUrl: user.logo_key ? `https://cdn.hellosmart.ai/${user.logo_key}` : null,
          }
        : null;
    return toMeDto({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      mustResetPassword: user.must_reset_password,
      org,
    });
  }

  private async findUserByEmail(email: string): Promise<DbUserRow | null> {
    const result = await this.pool.query<DbUserRow>(
      `SELECT id, org_id, email::text AS email, name, role, password_hash,
              status, must_reset_password, mfa_secret_ref,
              org_status, org_name, logo_key
       FROM app.find_user_for_login($1)
       LIMIT 1`,
      [email],
    );
    return result.rows[0] ?? null;
  }

  private async findUserById(userId: string): Promise<DbUserRow | null> {
    const result = await this.pool.query<DbUserRow>(
      `SELECT id, org_id, email::text AS email, name, role, password_hash,
              status, must_reset_password, mfa_secret_ref,
              org_status, org_name, logo_key
       FROM app.find_user_by_id($1)
       LIMIT 1`,
      [userId],
    );
    return result.rows[0] ?? null;
  }
}

function invalidCredentials(): never {
  throw problem({
    title: 'Unauthorized',
    status: 401,
    detail: 'Invalid email or password',
    code: 'INVALID_CREDENTIALS',
  });
}
