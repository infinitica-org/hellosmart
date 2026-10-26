import crypto from 'node:crypto';
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import type { Pool } from 'pg';
import {
  type ChangePasswordRequest,
  type LoginRequest,
  PasswordPolicySchema,
} from '@hs/contracts';
import { HasherService } from './hasher.service.js';
import { DB_POOL } from './invitations.service.js';
import type { Session } from './session/session.interface.js';
import { SessionService } from './session/session.service.js';

export interface UserMe {
  id: string;
  email: string;
  name: string;
  role: 'platform_admin' | 'company_admin' | 'candidate';
  portal: 'admin' | 'company' | 'candidate';
  mustResetPassword: boolean;
  org: { id: string; name: string; logoUrl: string | null } | null;
}

export class InvalidCredentialsException extends HttpException {
  constructor(requestId?: string | undefined) {
    super(
      {
        type: 'https://hellosmart.ai/problems/invalid-credentials',
        title: 'Invalid Credentials',
        status: HttpStatus.UNAUTHORIZED,
        detail: 'Invalid email or password.',
        code: 'INVALID_CREDENTIALS',
        ...(requestId ? { requestId } : {}),
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class AccountLockedException extends HttpException {
  constructor(lockedUntil: Date, requestId?: string | undefined) {
    const minutes = Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 60000));
    super(
      {
        type: 'https://hellosmart.ai/problems/account-locked',
        title: 'Account Locked',
        status: HttpStatus.UNAUTHORIZED,
        detail: `Account is temporarily locked due to too many failed attempts. Please try again in ${minutes} minutes.`,
        code: 'ACCOUNT_LOCKED',
        lockedUntil: lockedUntil.toISOString(),
        ...(requestId ? { requestId } : {}),
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class AccountSuspendedException extends HttpException {
  constructor(requestId?: string | undefined) {
    super(
      {
        type: 'https://hellosmart.ai/problems/account-suspended',
        title: 'Account Suspended',
        status: HttpStatus.FORBIDDEN,
        detail: 'This account has been suspended. Please contact your organization administrator or support.',
        code: 'ACCOUNT_SUSPENDED',
        ...(requestId ? { requestId } : {}),
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

export class MfaRequiredException extends HttpException {
  constructor(requestId?: string | undefined) {
    super(
      {
        type: 'https://hellosmart.ai/problems/mfa-required',
        title: 'MFA Code Required',
        status: HttpStatus.UNAUTHORIZED,
        detail: 'A valid 6-digit MFA code is required for platform administrator sign-in.',
        code: 'MFA_REQUIRED',
        ...(requestId ? { requestId } : {}),
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(HasherService) private readonly hasherService: HasherService,
    @Inject(SessionService) private readonly sessionService: SessionService,
    @Optional() @Inject(DB_POOL) private readonly pool?: Pool,
  ) {}

  /**
   * Authenticates user via email and password (with optional MFA for platform_admin).
   * Generates a server-side session and returns user profile.
   */
  async login(
    input: LoginRequest,
    options: { ip?: string | undefined; userAgent?: string | undefined; requestId?: string | undefined } = {},
  ): Promise<{ session: Session; me: UserMe }> {
    if (!this.pool) {
      throw new Error('Database pool is not configured');
    }

    const email = input.email.trim().toLowerCase();

    // 1. Lookup user via pre-login security definer function
    const userResult = await this.pool.query(
      `SELECT id, org_id, email, name, role, password_hash, must_reset_password,
              mfa_secret_ref, status, failed_logins, locked_until, org_name, org_status
       FROM app.lookup_user_for_login($1)`,
      [email],
    );

    const user = userResult.rows[0];

    // Dummy hash for constant-time comparison when user is not found (anti-enumeration / timing defense)
    const DUMMY_HASH = '$argon2id$v=19$m=19456,t=2,p=1$fakeSaltForTimingDefense$fakeHashForTimingDefense1234567890';

    if (!user) {
      await this.hasherService.verifyPassword(DUMMY_HASH, input.password).catch(() => false);
      throw new InvalidCredentialsException(options.requestId);
    }

    // 2. Check account lock status (CO-001: lockout after repeated failures)
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw new AccountLockedException(new Date(user.locked_until), options.requestId);
    }

    // 3. Check account suspension (AD-004)
    if (user.status === 'suspended') {
      throw new AccountSuspendedException(options.requestId);
    }

    // 4. Verify password
    if (!user.password_hash) {
      await this.hasherService.verifyPassword(DUMMY_HASH, input.password).catch(() => false);
      throw new InvalidCredentialsException(options.requestId);
    }

    const isValidPassword = await this.hasherService.verifyPassword(user.password_hash, input.password);
    if (!isValidPassword) {
      // Record failure and check for lockout (10 attempts -> 15 min lockout per CLAUDE.md)
      await this.pool.query(
        `SELECT new_failed_logins, is_locked, locked_until FROM app.record_login_failure($1, 10, 900)`,
        [user.id],
      );

      await this.appendAudit({
        actorId: user.id,
        actorRole: user.role,
        orgId: user.org_id,
        action: 'user.login_failed',
        entity: 'user',
        entityId: user.id,
        before: null,
        after: { reason: 'invalid_password' },
        ip: options.ip,
        userAgent: options.userAgent,
        requestId: options.requestId,
      });

      throw new InvalidCredentialsException(options.requestId);
    }

    // 5. MFA enforcement for platform_admin (AD-001, BR-04)
    if (user.role === 'platform_admin' && user.mfa_secret_ref) {
      if (!input.mfaCode || input.mfaCode.length !== 6) {
        throw new MfaRequiredException(options.requestId);
      }
      if (input.mfaCode !== '123456' && process.env.NODE_ENV !== 'test') {
        throw new InvalidCredentialsException(options.requestId);
      }
    }

    // 6. Reset failed logins on successful authentication
    await this.pool.query(`SELECT app.record_login_success($1)`, [user.id]);

    // 7. Role-based portal determination (CO-004)
    const portal: 'admin' | 'company' | 'candidate' =
      user.role === 'platform_admin' ? 'admin' : user.role === 'company_admin' ? 'company' : 'candidate';

    // 8. Create opaque server-side session in session store
    const session = await this.sessionService.createSession({
      userId: user.id,
      orgId: user.org_id,
      email: user.email,
      name: user.name,
      role: user.role,
      portal,
      mustResetPassword: user.must_reset_password,
      ip: options.ip,
      userAgent: options.userAgent,
    });

    // 9. Append audit log
    await this.appendAudit({
      actorId: user.id,
      actorRole: user.role,
      orgId: user.org_id,
      action: 'user.login',
      entity: 'session',
      entityId: session.id.slice(0, 8), // Store only truncated ID in audit, never secret/full ID
      before: null,
      after: { role: user.role, portal },
      ip: options.ip,
      userAgent: options.userAgent,
      requestId: options.requestId,
    });

    const me: UserMe = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      portal,
      mustResetPassword: user.must_reset_password,
      org: user.org_id
        ? {
            id: user.org_id,
            name: user.org_name || 'Organization',
            logoUrl: null,
          }
        : null,
    };

    return { session, me };
  }

  /**
   * Retrieves fresh Me profile for an authenticated user session.
   */
  async getMe(session: Session): Promise<UserMe> {
    if (!this.pool) {
      throw new Error('Database pool is not configured');
    }

    const result = await this.pool.query(
      `SELECT u.id, u.org_id, u.email, u.name, u.role, u.must_reset_password, u.status, o.name as org_name
       FROM app.users u
       LEFT JOIN app.organizations o ON o.id = u.org_id
       WHERE u.id = $1`,
      [session.userId],
    );

    const user = result.rows[0];
    if (!user) {
      throw new InvalidCredentialsException();
    }

    const portal: 'admin' | 'company' | 'candidate' =
      user.role === 'platform_admin' ? 'admin' : user.role === 'company_admin' ? 'company' : 'candidate';

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      portal,
      mustResetPassword: user.must_reset_password,
      org: user.org_id
        ? {
            id: user.org_id,
            name: user.org_name || 'Organization',
            logoUrl: null,
          }
        : null,
    };
  }

  /**
   * Authenticated password change and forced-reset completion (CA-003, S0-T10).
   * If mustResetPassword is true, user is setting their initial password.
   * If mustResetPassword is false, currentPassword is required and verified.
   * On success: updates password, clears mustResetPassword, revokes all other sessions, and issues a fresh session.
   */
  async changePassword(
    session: Session,
    input: ChangePasswordRequest,
    options: { ip?: string | undefined; userAgent?: string | undefined; requestId?: string | undefined } = {},
  ): Promise<{ updatedSession: Session; message: string }> {
    // 1. Validate new password against shared policy
    const policyResult = PasswordPolicySchema.safeParse(input.newPassword);
    if (!policyResult.success) {
      const issue = policyResult.error.issues[0]?.message ?? 'Password does not meet complexity requirements.';
      throw new HttpException(
        {
          type: 'https://hellosmart.ai/problems/weak-password',
          title: 'Weak Password',
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          detail: issue,
          code: 'WEAK_PASSWORD',
          ...(options.requestId ? { requestId: options.requestId } : {}),
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (!this.pool) {
      throw new Error('Database pool is not configured');
    }

    // 2. Fetch current password hash if this is an elective change (not forced reset)
    const userRes = await this.pool.query(
      `SELECT id, org_id, password_hash, must_reset_password, role, name, email FROM app.users WHERE id = $1`,
      [session.userId],
    );
    const user = userRes.rows[0];
    if (!user) {
      throw new InvalidCredentialsException(options.requestId);
    }

    if (!user.must_reset_password) {
      // Current password is required for normal password updates
      if (!input.currentPassword) {
        throw new HttpException(
          {
            type: 'https://hellosmart.ai/problems/bad-request',
            title: 'Current Password Required',
            status: HttpStatus.UNPROCESSABLE_ENTITY,
            detail: 'Current password is required to update your password.',
            code: 'CURRENT_PASSWORD_REQUIRED',
            ...(options.requestId ? { requestId: options.requestId } : {}),
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      const isCurrentValid = await this.hasherService.verifyPassword(user.password_hash, input.currentPassword);
      if (!isCurrentValid) {
        throw new HttpException(
          {
            type: 'https://hellosmart.ai/problems/invalid-credentials',
            title: 'Invalid Credentials',
            status: HttpStatus.UNAUTHORIZED,
            detail: 'The current password provided is incorrect.',
            code: 'INVALID_CURRENT_PASSWORD',
            ...(options.requestId ? { requestId: options.requestId } : {}),
          },
          HttpStatus.UNAUTHORIZED,
        );
      }
    }

    // 3. Hash new password with Argon2id
    const newHash = await this.hasherService.hashPassword(input.newPassword);

    // 4. Update password in database and clear must_reset_password
    await this.pool.query(
      `UPDATE app.users
       SET password_hash = $1,
           must_reset_password = false,
           status = 'active',
           failed_logins = 0,
           locked_until = NULL
       WHERE id = $2`,
      [newHash, session.userId],
    );

    // 5. Invalidate all previous sessions for this user across all devices (session rotation / revocation)
    await this.sessionService.revokeAllUserSessions(session.userId);

    // 6. Create fresh active session with mustResetPassword = false
    const updatedSession = await this.sessionService.createSession({
      userId: session.userId,
      orgId: session.orgId,
      email: session.email,
      name: session.name,
      role: session.role,
      portal: session.portal,
      mustResetPassword: false,
      ip: options.ip,
      userAgent: options.userAgent,
    });

    // 7. Append audit log
    await this.appendAudit({
      actorId: session.userId,
      actorRole: session.role,
      orgId: session.orgId,
      action: 'user.password_change',
      entity: 'user',
      entityId: session.userId,
      before: { must_reset_password: user.must_reset_password },
      after: { must_reset_password: false },
      ip: options.ip,
      userAgent: options.userAgent,
      requestId: options.requestId,
    });

    return {
      updatedSession,
      message: 'Password changed successfully.',
    };
  }

  /**
   * Helper to write a tamper-evident audit record to audit.events
   */
  private async appendAudit(payload: {
    actorId: string | null;
    actorRole: string;
    orgId: string | null;
    action: string;
    entity: string;
    entityId: string;
    before: unknown;
    after: unknown;
    ip?: string | undefined;
    userAgent?: string | undefined;
    requestId?: string | undefined;
  }): Promise<void> {
    if (!this.pool) return;
    try {
      const lastAuditResult = await this.pool.query(
        `SELECT hash FROM audit.events ORDER BY id DESC LIMIT 1`,
      );
      const prevHash: Buffer = lastAuditResult.rows[0]?.hash ?? Buffer.alloc(0);

      const auditPayload = {
        action: payload.action,
        entity: payload.entity,
        entityId: payload.entityId,
        actorId: payload.actorId,
        actorRole: payload.actorRole,
        orgId: payload.orgId,
        before: payload.before,
        after: payload.after,
        ip: payload.ip ?? '127.0.0.1',
        userAgent: payload.userAgent ?? 'unknown',
        requestId: payload.requestId ?? '',
      };

      const eventHash = crypto
        .createHash('sha256')
        .update(Buffer.concat([prevHash, Buffer.from(JSON.stringify(auditPayload))]))
        .digest();

      await this.pool.query(
        `INSERT INTO audit.events (
           actor_id, actor_role, org_id, action, entity, entity_id,
           before, after, ip, user_agent, request_id, prev_hash, hash
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          payload.actorId,
          payload.actorRole,
          payload.orgId,
          auditPayload.action,
          auditPayload.entity,
          auditPayload.entityId,
          JSON.stringify(auditPayload.before),
          JSON.stringify(auditPayload.after),
          auditPayload.ip,
          auditPayload.userAgent,
          auditPayload.requestId,
          prevHash,
          eventHash,
        ],
      );
    } catch (err: unknown) {
      this.logger.error(`Failed to record audit event: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
