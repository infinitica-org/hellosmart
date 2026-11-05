import { Inject, Injectable } from '@nestjs/common';
import type {
  ChangePasswordDto,
  ChangePasswordResponseDto,
  LoginDto,
  LogoutResponseDto,
  MeDto,
  MfaVerifyDto,
  MfaSetupConfirmDto,
  MfaSetupConfirmResponse,
  MfaSetupStartResponse,
  MfaStatusResponse,
} from '@hs/contracts';
import type { Pool, PoolClient } from 'pg';
import { problem } from '../../common/errors/app-http.exception.js';
import type { UserContext, UserRole } from '../../common/types/user-context.js';
import { appendAuditEvent } from '../audit/audit-writer.js';
import type { AuditRecordInput } from '../audit/audit.types.js';
import { PG_POOL } from '../database/database.tokens.js';
import { SessionService, SESSION_TTL_SECONDS } from '../session/session.service.js';
import { withOrg, withPlatform } from '../tenancy/with-org.js';
import { toMeDto } from './auth.mapper.js';
import { LoginLockoutService } from './login-lockout.service.js';
import { MfaService } from './mfa.service.js';
import { PasswordPolicyService } from './password-policy.service.js';
import { PreAuthService } from './pre-auth.service.js';
import { hashPassword, verifyPassword, verifyWithDummyTiming } from './password.js';

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
    @Inject(PasswordPolicyService) private readonly passwordPolicy: PasswordPolicyService,
  ) {}

  async login(
    dto: LoginDto,
    meta: RequestMeta,
  ): Promise<MeDto | { mfaRequired: true; preAuthToken: string }> {
    const email = dto.email.trim().toLowerCase();
    await this.lockout.assertNotLocked(email, meta.ip);

    const user = await this.findUserByEmail(email);
    if (!user) {
      await verifyWithDummyTiming(dto.password);
      await this.lockout.recordFailure(email, meta.ip);
      await this.auditLogin(null, 'anonymous', null, false, meta);
      throw invalidCredentials();
    }

    this.assertAccountActive(user);

    const hash = user.password_hash;
    if (!hash) {
      await verifyWithDummyTiming(dto.password);
      await this.lockout.recordFailure(email, meta.ip);
      await this.auditLogin(user.id, user.role, user.org_id, false, meta);
      throw invalidCredentials();
    }

    const ok = await verifyPassword(hash, dto.password);
    if (!ok) {
      await this.lockout.recordFailure(email, meta.ip);
      await this.auditLogin(user.id, user.role, user.org_id, false, meta);
      throw invalidCredentials();
    }

    await this.lockout.clearFailures(email, meta.ip);

    if (user.role === 'platform_admin' && this.platformAdminRequiresMfa(user)) {
      if (dto.mfaCode) {
        if (this.looksLikeBackupCode(dto.mfaCode)) {
          const normalizedBackup = this.mfa.formatBackupCode(dto.mfaCode);
          const remaining = await this.mfa.countUnusedBackupCodes(user.id);
          if (remaining === 0) {
            await this.lockout.recordFailure(email, meta.ip);
            await this.auditLogin(user.id, user.role, user.org_id, false, meta);
            throw problem({
              title: 'Unauthorized',
              status: 401,
              detail:
                'No backup codes are stored for this account. Use your authenticator app, then generate backup codes under Admin → Security.',
              code: 'MFA_NO_BACKUP_CODES',
            });
          }
          const consumed = await this.mfa.consumeBackupCode(user.id, normalizedBackup);
          if (!consumed) {
            await this.lockout.recordFailure(email, meta.ip);
            await this.auditLogin(user.id, user.role, user.org_id, false, meta);
            throw problem({
              title: 'Unauthorized',
              status: 401,
              detail: 'Invalid backup code',
              code: 'MFA_INVALID',
            });
          }
          return this.completeLogin(user, meta, true);
        }

        const secret = this.mfa.resolveSecret(user.mfa_secret_ref);
        const { valid, step } = this.mfa.verifyTotpWithStep(secret, dto.mfaCode);
        if (!valid || step === undefined) {
          await this.lockout.recordFailure(email, meta.ip);
          await this.auditLogin(user.id, user.role, user.org_id, false, meta);
          throw problem({
            title: 'Unauthorized',
            status: 401,
            detail: 'Invalid MFA code',
            code: 'MFA_INVALID',
          });
        }
        // Atomic TOTP replay protection (S0-T14-3)
        const consumed = await this.mfa.consumeStep(user.id, step);
        if (!consumed) {
          await this.lockout.recordFailure(email, meta.ip);
          await this.auditLogin(user.id, user.role, user.org_id, false, meta);
          throw problem({
            title: 'Unauthorized',
            status: 401,
            detail: 'MFA code already used. Please wait for a new code.',
            code: 'MFA_REPLAY_DETECTED',
          });
        }
        if (this.mfa.needsReencryption(user.mfa_secret_ref)) {
          void this.mfa.upgradeSecret(user.id, secret).catch(() => {});
        }
        return this.completeLogin(user, meta, true);
      }
      const preAuthToken = await this.preAuth.issue(user.id);
      return { mfaRequired: true, preAuthToken };
    }

    return this.completeLogin(user, meta, false);
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

    if (dto.backupCode) {
      const normalizedBackup = this.mfa.formatBackupCode(dto.backupCode);
      const remaining = await this.mfa.countUnusedBackupCodes(user.id);
      if (remaining === 0) {
        await this.auditLogin(user.id, user.role, user.org_id, false, meta);
        throw problem({
          title: 'Unauthorized',
          status: 401,
          detail:
            'No backup codes are stored for this account (common with legacy env-based MFA). Sign in with your authenticator app, then open Admin → Security to generate backup codes.',
          code: 'MFA_NO_BACKUP_CODES',
        });
      }
      const consumed = await this.mfa.consumeBackupCode(user.id, normalizedBackup);
      if (!consumed) {
        await this.preAuth.recordFailedAttempt(dto.preAuthToken);
        await this.auditLogin(user.id, user.role, user.org_id, false, meta);
        throw problem({
          title: 'Unauthorized',
          status: 401,
          detail: 'Invalid backup code',
          code: 'MFA_INVALID',
        });
      }
      await this.preAuth.delete(dto.preAuthToken);
      await this.auditLogin(user.id, user.role, user.org_id, true, meta);
      return this.completeLogin(user, meta);
    }

    if (!dto.totpCode) {
      throw problem({
        title: 'Bad Request',
        status: 400,
        detail: 'TOTP code or backup code is required',
        code: 'VALIDATION_ERROR',
      });
    }

    const secret = this.mfa.resolveSecret(user.mfa_secret_ref);
    const { valid, step } = this.mfa.verifyTotpWithStep(secret, dto.totpCode);
    if (!valid || step === undefined) {
      await this.preAuth.recordFailedAttempt(dto.preAuthToken);
      await this.auditLogin(user.id, user.role, user.org_id, false, meta);
      throw problem({
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid MFA code',
        code: 'MFA_INVALID',
      });
    }

    // Atomic TOTP replay protection (S0-T14-3)
    const consumed = await this.mfa.consumeStep(user.id, step);
    if (!consumed) {
      await this.preAuth.recordFailedAttempt(dto.preAuthToken);
      await this.auditLogin(user.id, user.role, user.org_id, false, meta);
      throw problem({
        title: 'Unauthorized',
        status: 401,
        detail: 'MFA code already used. Please wait for a new code.',
        code: 'MFA_REPLAY_DETECTED',
      });
    }

    await this.preAuth.delete(dto.preAuthToken);
    if (this.mfa.needsReencryption(user.mfa_secret_ref)) {
      void this.mfa.upgradeSecret(user.id, secret).catch(() => {});
    }
    return this.completeLogin(user, meta);
  }

  async getMfaStatus(userId: string): Promise<MfaStatusResponse> {
    const user = await this.findUserById(userId);
    if (!user || user.role !== 'platform_admin') {
      throw problem({
        title: 'Forbidden',
        status: 403,
        detail: 'MFA enrollment is only available for platform administrators',
        code: 'FORBIDDEN',
      });
    }
    const enrolled = Boolean(user.mfa_secret_ref?.trim());
    const backupCodesRemaining = enrolled
      ? await this.mfa.countUnusedBackupCodes(userId)
      : 0;
    return { enrolled, backupCodesRemaining };
  }

  async startMfaEnrollment(userId: string, meta: RequestMeta): Promise<MfaSetupStartResponse> {
    const user = await this.findUserById(userId);
    if (!user || user.role !== 'platform_admin') {
      throw problem({
        title: 'Forbidden',
        status: 403,
        detail: 'MFA enrollment is only available for platform administrators',
        code: 'FORBIDDEN',
      });
    }
    if (user.mfa_secret_ref?.trim()) {
      throw problem({
        title: 'Conflict',
        status: 409,
        detail: 'MFA is already enabled. Contact support to reset.',
        code: 'MFA_ALREADY_ENROLLED',
      });
    }

    const generated = this.mfa.generateMfaSecret(user.email);
    const stored = await this.mfa.setEnrollmentPending(userId, generated.encryptedSecret);
    if (!stored) {
      throw problem({
        title: 'Internal Server Error',
        status: 500,
        detail: 'Could not start MFA enrollment',
        code: 'MFA_SETUP_FAILED',
      });
    }

    await this.auditMfaEvent(user.id, user.role, user.org_id, 'auth.mfa.setup_started', meta);
    return {
      secret: generated.secret,
      otpauthUri: generated.uri,
    };
  }

  async confirmMfaEnrollment(
    userId: string,
    dto: MfaSetupConfirmDto,
    meta: RequestMeta,
  ): Promise<MfaSetupConfirmResponse> {
    const user = await this.findUserById(userId);
    if (!user || user.role !== 'platform_admin') {
      throw problem({
        title: 'Forbidden',
        status: 403,
        detail: 'MFA enrollment is only available for platform administrators',
        code: 'FORBIDDEN',
      });
    }
    if (user.mfa_secret_ref?.trim()) {
      throw problem({
        title: 'Conflict',
        status: 409,
        detail: 'MFA is already enabled',
        code: 'MFA_ALREADY_ENROLLED',
      });
    }

    const pendingRef = await this.mfa.getEnrollmentPendingRef(userId);
    const pendingSecret = this.mfa.resolvePendingSecret(pendingRef);
    const { valid } = this.mfa.verifyTotpWithStep(pendingSecret, dto.totpCode);
    if (!valid) {
      throw problem({
        title: 'Bad Request',
        status: 400,
        detail: 'Authenticator code did not match. Check your device time and try again.',
        code: 'MFA_INVALID',
      });
    }

    const encryptedSecret = this.mfa.encryptSecret(pendingSecret);
    const confirmed = await this.mfa.confirmEnrollment(userId, encryptedSecret);
    if (!confirmed) {
      throw problem({
        title: 'Internal Server Error',
        status: 500,
        detail: 'Could not confirm MFA enrollment',
        code: 'MFA_SETUP_FAILED',
      });
    }

    const backupCodes = this.mfa.generateBackupCodes(10);
    const hashes = backupCodes.map((code) => this.mfa.hashBackupCode(code));
    await this.mfa.storeBackupCodeHashes(userId, hashes);

    await this.auditMfaEvent(user.id, user.role, user.org_id, 'auth.mfa.enrolled', meta, {
      backupCodesIssued: backupCodes.length,
    });

    return { backupCodes };
  }

  async regenerateBackupCodes(
    userId: string,
    dto: MfaSetupConfirmDto,
    meta: RequestMeta,
  ): Promise<MfaSetupConfirmResponse> {
    const user = await this.findUserById(userId);
    if (!user || user.role !== 'platform_admin') {
      throw problem({
        title: 'Forbidden',
        status: 403,
        detail: 'MFA enrollment is only available for platform administrators',
        code: 'FORBIDDEN',
      });
    }
    if (!user.mfa_secret_ref?.trim()) {
      throw problem({
        title: 'Bad Request',
        status: 400,
        detail: 'Enable MFA before generating backup codes',
        code: 'MFA_NOT_ENROLLED',
      });
    }

    const secret = this.mfa.resolveSecret(user.mfa_secret_ref);
    const { valid } = this.mfa.verifyTotpWithStep(secret, dto.totpCode);
    if (!valid) {
      throw problem({
        title: 'Bad Request',
        status: 400,
        detail: 'Authenticator code did not match. Check your device time and try again.',
        code: 'MFA_INVALID',
      });
    }

    const backupCodes = this.mfa.generateBackupCodes(10);
    const hashes = backupCodes.map((code) => this.mfa.hashBackupCode(code));
    await this.mfa.storeBackupCodeHashes(userId, hashes);

    await this.auditMfaEvent(user.id, user.role, user.org_id, 'auth.mfa.backup_codes_regenerated', meta, {
      backupCodesIssued: backupCodes.length,
    });

    return { backupCodes };
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

  async markCurrentSessionMfaVerified(rawToken: string | undefined): Promise<void> {
    await this.sessions.markMfaVerified(rawToken);
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
    options?: { mfaVerified?: boolean },
  ): Promise<{ rawToken: string; sessionId: string; cookieMaxAgeSeconds: number; me: MeDto }> {
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
    const { rawToken, sessionId, cookieMaxAgeSeconds } = await this.sessions.createSession(context, {
      ip: meta?.ip,
      userAgent: meta?.userAgent,
      mfaVerified: options?.mfaVerified ?? false,
    });
    return { rawToken, sessionId, cookieMaxAgeSeconds, me: this.toMeFromRow(user) };
  }

  private async completeLogin(
    user: DbUserRow,
    meta: RequestMeta,
    mfaVerified = false,
  ): Promise<MeDto & { mfaVerified?: boolean }> {
    await this.pool.query('SELECT app.record_login_success($1)', [user.id]);
    await this.auditLogin(user.id, user.role, user.org_id, true, meta);
    const me = this.toMeFromRow(user);
    if (mfaVerified) {
      return { ...me, mfaVerified: true };
    }
    return me;
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

  private platformAdminRequiresMfa(user: DbUserRow): boolean {
    const ref = user.mfa_secret_ref?.trim();
    return Boolean(ref);
  }

  private looksLikeBackupCode(value: string): boolean {
    const cleaned = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleaned.length === 8) {
      return true;
    }
    return /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(value.trim().toUpperCase());
  }

  private async auditMfaEvent(
    actorId: string,
    actorRole: string,
    orgId: string | null,
    action: string,
    meta: RequestMeta,
    after?: Record<string, unknown>,
  ): Promise<void> {
    const input: AuditRecordInput = {
      actorId,
      actorRole,
      orgId,
      action,
      entity: 'user',
      entityId: actorId,
      after: after ?? null,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
      requestId: meta.requestId ?? null,
    };
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

  async identifyLoginEmail(_email: string): Promise<{ recognized: true }> {
    // Constant-shaped anti-enumeration response. MFA UX is driven by /auth/login.
    return { recognized: true };
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

  async changePassword(
    userContext: UserContext,
    currentSessionId: string | undefined,
    dto: ChangePasswordDto,
    meta: RequestMeta,
  ): Promise<ChangePasswordResponseDto> {
    const client = await this.pool.connect();
    try {
      // 1. Fetch user data scoped to tenant or platform context
      const user = await (userContext.orgId
        ? withOrg(client, userContext.orgId, async (tx) => {
            const res = await tx.query<DbUserRow>(
              `SELECT u.id, u.org_id, u.email::text AS email, u.name, u.role, u.password_hash,
                      u.status, u.must_reset_password, u.mfa_secret_ref,
                      o.status AS org_status, o.name AS org_name, o.logo_key
               FROM app.users u
               LEFT JOIN app.organizations o ON o.id = u.org_id
               WHERE u.id = $1 AND u.deleted_at IS NULL`,
              [userContext.userId],
            );
            return res.rows[0] ?? null;
          })
        : withPlatform(client, async (tx) => {
            const res = await tx.query<DbUserRow>(
              `SELECT u.id, u.org_id, u.email::text AS email, u.name, u.role, u.password_hash,
                      u.status, u.must_reset_password, u.mfa_secret_ref,
                      NULL AS org_status, NULL AS org_name, NULL AS logo_key
               FROM app.users u
               WHERE u.id = $1 AND u.deleted_at IS NULL`,
              [userContext.userId],
            );
            return res.rows[0] ?? null;
          }));

      if (!user) {
        throw problem({
          title: 'Not Found',
          status: 404,
          detail: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      this.assertAccountActive(user);

      // 2. Verify current password
      if (!user.password_hash) {
        await verifyWithDummyTiming(dto.currentPassword);
        throw problem({
          title: 'Bad Request',
          status: 400,
          detail: 'Current password is incorrect',
          code: 'INVALID_CREDENTIALS',
        });
      }

      const currentPasswordValid = await verifyPassword(user.password_hash, dto.currentPassword);
      if (!currentPasswordValid) {
        throw problem({
          title: 'Bad Request',
          status: 400,
          detail: 'Current password is incorrect',
          code: 'INVALID_CREDENTIALS',
        });
      }

      // 3. Local password policy check
      const localResult = this.passwordPolicy.evaluateLocal(dto.newPassword, {
        email: user.email,
        name: user.name,
        companyName: user.org_name ?? undefined,
        role: user.role,
      });

      if (!localResult.ok) {
        throw problem({
          title: 'Unprocessable Entity',
          status: 422,
          detail: 'Password does not meet security requirements',
          code: 'PASSWORD_POLICY_VIOLATION',
          reasons: localResult.reasons,
        });
      }

      // 4. Have I Been Pwned breach check
      const breachResult = await this.passwordPolicy.checkBreached(dto.newPassword);
      if (breachResult.breached) {
        throw problem({
          title: 'Unprocessable Entity',
          status: 422,
          detail: 'This password has appeared in a known data breach and cannot be used',
          code: 'PASSWORD_BREACHED',
          reasons: ['breached'],
        });
      }

      // 5. Password history check (last 5 + current hash)
      const historyResult = await (userContext.orgId
        ? withOrg(client, userContext.orgId, async (tx) =>
            this.passwordPolicy.checkHistory(user.id, dto.newPassword, tx),
          )
        : withPlatform(client, async (tx) =>
            this.passwordPolicy.checkHistory(user.id, dto.newPassword, tx),
          ));

      if (historyResult.reused) {
        throw problem({
          title: 'Unprocessable Entity',
          status: 422,
          detail: 'Cannot reuse any of your last 5 passwords',
          code: 'PASSWORD_REUSED',
          reasons: ['reused'],
        });
      }

      // 6. Hash new password with Argon2id
      const newHash = await hashPassword(dto.newPassword);

      // 7. Atomic DB update with row lock and audit event
      if (userContext.orgId) {
        await withOrg(client, userContext.orgId, async (tx) => {
          await tx.query(
            `UPDATE app.users
             SET password_hash = $1,
                 must_reset_password = false,
                 failed_logins = 0,
                 locked_until = NULL
             WHERE id = $2`,
            [newHash, user.id],
          );

          await this.passwordPolicy.recordPasswordHistory(user.id, newHash, tx);

          await appendAuditEvent(tx, {
            actorId: user.id,
            actorRole: user.role,
            orgId: user.org_id,
            action: 'password.changed',
            entity: 'user',
            entityId: user.id,
            before: null,
            after: {
              must_reset_password: false,
              revoked_other_sessions: true,
            },
            ip: meta.ip,
            userAgent: meta.userAgent,
            requestId: meta.requestId,
          });
        });
      } else {
        await withPlatform(client, async (tx) => {
          await tx.query(
            `UPDATE app.users
             SET password_hash = $1,
                 must_reset_password = false,
                 failed_logins = 0,
                 locked_until = NULL
             WHERE id = $2`,
            [newHash, user.id],
          );

          await this.passwordPolicy.recordPasswordHistory(user.id, newHash, tx);

          await appendAuditEvent(tx, {
            actorId: user.id,
            actorRole: user.role,
            orgId: null,
            action: 'password.changed',
            entity: 'user',
            entityId: user.id,
            before: null,
            after: {
              must_reset_password: false,
              revoked_other_sessions: true,
            },
            ip: meta.ip,
            userAgent: meta.userAgent,
            requestId: meta.requestId,
          });
        });
      }

      // 8. Revoke all other sessions for this user
      if (currentSessionId) {
        await this.sessions.revokeOtherSessionsForUser(user.id, currentSessionId);
      } else {
        await this.sessions.revokeAllSessionsForUser(user.id);
      }

      return {
        success: true,
        message: 'Password changed successfully.',
      };
    } finally {
      client.release();
    }
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
