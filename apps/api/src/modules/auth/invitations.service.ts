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
  type AcceptInvitationRequest,
  type AcceptInvitationResponse,
  type InvitationDetailsResponse,
  PasswordPolicySchema,
} from '@hs/contracts';
import { PG_POOL } from '../database/database.tokens.js';
import { SessionService } from '../session/session.service.js';
import { PasswordPolicyService } from './password-policy.service.js';
import { hashPassword } from './password.js';

/**
 * Standard RFC 9457 Problem Details Exception for Invalid Invitation.
 * Identical generic 404 status and message for non-existent, expired, or used invitations.
 */
export class InvitationInvalidException extends HttpException {
  constructor(requestId?: string) {
    super(
      {
        type: 'https://hellosmart.ai/problems/invitation-invalid',
        title: 'Invitation Invalid',
        status: HttpStatus.NOT_FOUND,
        detail: 'The invitation is invalid, has expired, or has already been used.',
        code: 'INVITATION_INVALID',
        ...(requestId ? { requestId } : {}),
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

/**
 * Standard RFC 9457 Problem Details Exception for Weak Password.
 */
export class WeakPasswordException extends HttpException {
  constructor(detail?: string, requestId?: string) {
    super(
      {
        type: 'https://hellosmart.ai/problems/weak-password',
        title: 'Weak Password',
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        detail: detail ?? 'Password does not meet complexity requirements.',
        code: 'WEAK_PASSWORD',
        ...(requestId ? { requestId } : {}),
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Optional() @Inject(SessionService) private readonly sessionService?: SessionService,
    @Optional() @Inject(PasswordPolicyService) private readonly passwordPolicyService?: PasswordPolicyService,
  ) {}

  /**
   * Hashes a raw token string using SHA-256 binary.
   */
  hashToken(token: string): Buffer {
    return crypto.createHash('sha256').update(token.trim()).digest();
  }

  /**
   * Validates an invitation token and returns non-sensitive metadata (email, role, orgName).
   * Returns identical generic 404 for unknown, expired, or used invitations.
   */
  async lookupInvitation(token: string, requestId?: string): Promise<InvitationDetailsResponse> {
    if (!token || typeof token !== 'string') {
      throw new InvitationInvalidException(requestId);
    }

    const tokenHash = this.hashToken(token);

    if (!this.pool) {
      throw new Error('Database pool is not configured');
    }

    // Calls PostgreSQL SECURITY DEFINER function to bypass tenant filter securely
    // without exposing cross-tenant tables to unauthenticated callers.
    const result = await this.pool.query(
      `SELECT id, org_id, user_id, email, role, org_name, expires_at, used_at
       FROM app.find_invitation_by_token_hash($1)`,
      [tokenHash],
    );

    const row = result.rows[0];
    if (!row) {
      throw new InvitationInvalidException(requestId);
    }

    return {
      email: row.email,
      role: row.role,
      orgName: row.org_name,
    };
  }

  /**
   * Atomically accepts an invitation:
   * 1. Validates password against shared policy
   * 2. Atomically marks invitation as used in a transaction (protecting against concurrency)
   * 3. Hashes password using Argon2id
   * 4. Updates user record to active
   * 5. Appends tamper-evident audit record to audit.events
   * 6. Triggers session revocation (hook)
   */
  async acceptInvitation(
    input: AcceptInvitationRequest,
    options: {
      clientIp?: string | undefined;
      userAgent?: string | undefined;
      requestId?: string | undefined;
    } = {},
  ): Promise<AcceptInvitationResponse> {
    // 1. Password policy validation (S0-T17 shared contract)
    const policyResult = PasswordPolicySchema.safeParse(input.password);
    if (!policyResult.success) {
      const issue = policyResult.error.issues[0]?.message ?? 'Password does not meet complexity requirements.';
      throw new WeakPasswordException(issue, options.requestId);
    }

    if (this.passwordPolicyService) {
      const breachCheck = await this.passwordPolicyService.checkBreached(input.password);
      if (breachCheck.breached) {
        throw new WeakPasswordException(
          'This password has appeared in a known data breach and cannot be used.',
          options.requestId,
        );
      }
    }

    if (!input.token || typeof input.token !== 'string') {
      throw new InvitationInvalidException(options.requestId);
    }

    const tokenHash = this.hashToken(input.token);

    if (!this.pool) {
      throw new Error('Database pool is not configured');
    }

    // 2. Hash password using Argon2id in application memory
    const passwordHash = await hashPassword(input.password);

    // 3. Atomically consume invitation, activate user, and record tamper-evident audit log
    // via secure PostgreSQL SECURITY DEFINER function.
    const result = await this.pool.query(
      `SELECT success, user_id, org_id, email, role
       FROM app.accept_invitation($1, $2, $3, $4, $5)`,
      [
        tokenHash,
        passwordHash,
        options.clientIp ?? '127.0.0.1',
        options.userAgent ?? 'unknown',
        options.requestId ?? '',
      ],
    );

    const row = result.rows[0];
    if (!row || !row.success) {
      throw new InvitationInvalidException(options.requestId);
    }

    // 4. Record initial password in history so it cannot be reused
    if (this.passwordPolicyService && this.pool) {
      try {
        await this.passwordPolicyService.recordPasswordHistory(
          row.user_id,
          passwordHash,
          this.pool as any,
        );
      } catch (err: unknown) {
        this.logger.warn(`Failed to record initial password history for user ${row.user_id}`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 5. Session Revocation hook
    await this.revokeUserSessions(row.user_id);

    return {
      success: true,
      message: 'Password set successfully. Please log in.',
    };
  }

  /**
   * Revokes existing sessions for the specified user (e.g. across multiple devices).
   */
  async revokeUserSessions(userId: string): Promise<void> {
    if (this.sessionService) {
      await this.sessionService.revokeAllSessionsForUser(userId);
      this.logger.log(`Active sessions revoked for user ${userId} on invitation acceptance.`);
    } else {
      this.logger.debug(`Session revocation hook invoked for user ${userId} (session infrastructure pending).`);
    }
  }
}
