import crypto from 'node:crypto';
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import {
  type AcceptInvitationRequest,
  type AcceptInvitationResponse,
  type InvitationDetailsResponse,
  PasswordPolicySchema,
} from '@hs/contracts';
import { HasherService } from './hasher.service.js';
import { SessionService } from './session/session.service.js';

export const DB_POOL = 'DB_POOL';

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
    @Inject(HasherService) private readonly hasherService: HasherService,
    @Optional() @Inject(DB_POOL) private readonly pool?: Pool,
    @Optional() @Inject(SessionService) private readonly sessionService?: SessionService,
  ) {}

  /**
   * Hashes a raw token string (hex or base64url) using SHA-256 binary.
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
       FROM app.lookup_invitation($1)`,
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

    if (!input.token || typeof input.token !== 'string') {
      throw new InvitationInvalidException(options.requestId);
    }

    const tokenHash = this.hashToken(input.token);

    if (!this.pool) {
      throw new Error('Database pool is not configured');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 2. Concurrency-safe atomic consumption:
      // UPDATE ... WHERE used_at IS NULL AND expires_at > now() ensures only 1 concurrent attempt succeeds.
      const inviteResult = await client.query(
        `UPDATE app.invitations
         SET used_at = now()
         WHERE token_hash = $1
           AND used_at IS NULL
           AND expires_at > now()
         RETURNING id, org_id, user_id, email, role`,
        [tokenHash],
      );

      const invitation = inviteResult.rows[0];
      if (!invitation) {
        await client.query('ROLLBACK');
        throw new InvitationInvalidException(options.requestId);
      }

      // 3. Hash password using Argon2id
      const passwordHash = await this.hasherService.hashPassword(input.password);

      // 4. Activate user and clear must_reset_password flag
      await client.query(
        `UPDATE app.users
         SET password_hash = $1,
             must_reset_password = false,
             status = 'active',
             email_verified_at = coalesce(email_verified_at, now())
         WHERE id = $2 AND org_id = $3`,
        [passwordHash, invitation.user_id, invitation.org_id],
      );

      // 5. Append tamper-evident audit log entry (BR-31)
      const auditPayload = {
        action: 'invitation.accepted',
        entity: 'user',
        entityId: invitation.user_id,
        actorId: invitation.user_id,
        actorRole: invitation.role,
        orgId: invitation.org_id,
        before: { status: 'invited', must_reset_password: true },
        after: { status: 'active', must_reset_password: false, email_verified: true },
        ip: options.clientIp ?? '127.0.0.1',
        userAgent: options.userAgent ?? 'unknown',
        requestId: options.requestId ?? '',
      };

      // Advisory transaction lock serializes audit hash chain writes under concurrency
      await client.query(`SELECT pg_advisory_xact_lock(hashtext('audit.events'))`);

      // Read the tail of audit.events (protected by advisory lock) to compute sequential hash chain
      const lastAuditResult = await client.query(
        `SELECT hash FROM audit.events ORDER BY id DESC LIMIT 1`,
      );
      const prevHash: Buffer = lastAuditResult.rows[0]?.hash ?? Buffer.alloc(0);

      // Compute sha256(prev_hash || payload)
      const eventHash = crypto
        .createHash('sha256')
        .update(Buffer.concat([prevHash, Buffer.from(JSON.stringify(auditPayload))]))
        .digest();

      await client.query(
        `INSERT INTO audit.events (
           actor_id, actor_role, org_id, action, entity, entity_id,
           before, after, ip, user_agent, request_id, prev_hash, hash
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          invitation.user_id,
          invitation.role,
          invitation.org_id,
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

      // 6. Session Revocation hook
      await this.revokeUserSessions(invitation.user_id);

      await client.query('COMMIT');

      return {
        success: true,
        message: 'Password set successfully. Please log in.',
      };
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Rollback failed if transaction already closed
      }
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Revokes existing sessions for the specified user (e.g. across multiple devices).
   */
  async revokeUserSessions(userId: string): Promise<void> {
    if (this.sessionService) {
      await this.sessionService.revokeAllUserSessions(userId);
      this.logger.log(`Active sessions revoked for user ${userId} on invitation acceptance.`);
    } else {
      this.logger.debug(`Session revocation hook invoked for user ${userId} (session infrastructure pending).`);
    }
  }
}
