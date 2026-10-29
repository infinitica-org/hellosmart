import crypto from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import type { CreateCandidateDto, CandidateDto } from '@hs/contracts';
import { MailService } from '../../common/services/mail.service.js';
import { problem } from '../../common/errors/app-http.exception.js';
import type { UserContext } from '../../common/types/user-context.js';
import type { RequestMeta } from '../auth/auth.service.js';
import { appendAuditEvent } from '../audit/audit-writer.js';
import { PG_POOL } from '../database/database.tokens.js';
import { withOrg } from '../tenancy/with-org.js';

@Injectable()
export class CandidatesService {
  private readonly logger = new Logger(CandidatesService.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(MailService) private readonly mailService: MailService,
  ) {}

  async create(
    dto: CreateCandidateDto,
    actor: UserContext,
    meta: RequestMeta,
  ): Promise<CandidateDto> {
    const orgId = actor.orgId;
    if (!orgId) {
      throw problem({
        title: 'Forbidden',
        status: 403,
        detail: 'User does not belong to an organization',
        code: 'TENANT_REQUIRED',
      });
    }

    const candidateEmail = dto.email.trim().toLowerCase();
    const candidateName = dto.name.trim();
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest();
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const client = await this.pool.connect();
    let candidate: CandidateDto;
    let orgName = 'HelloSmart Organization';

    try {
      candidate = await withOrg(client, orgId, async (tx) => {
        // 1. Check existing active user with this email in the org
        const existing = await tx.query(
          `SELECT id FROM app.users WHERE org_id = $1 AND email = $2 AND status != 'deleted'`,
          [orgId, candidateEmail],
        );
        if (existing.rowCount && existing.rowCount > 0) {
          throw problem({
            title: 'Conflict',
            status: 409,
            detail: 'Candidate with this email already exists in your organization',
            code: 'CANDIDATE_ALREADY_EXISTS',
          });
        }

        // 2. Fetch organization name
        const orgRes = await tx.query<{ name: string }>(
          `SELECT name FROM app.organizations WHERE id = $1`,
          [orgId],
        );
        if (orgRes.rows[0]) {
          orgName = orgRes.rows[0].name;
        }

        // 3. Create candidate user in app.users
        const candidateId = crypto.randomUUID();
        const userRes = await tx.query<{ id: string; name: string; email: string; status: 'invited'; created_at: Date }>(
          `INSERT INTO app.users (
             id, org_id, email, email_verified_at, name, role, password_hash, status, must_reset_password
           ) VALUES ($1, $2, $3, NULL, $4, 'candidate', NULL, 'invited', true)
           RETURNING id, name, email, status, created_at`,
          [candidateId, orgId, candidateEmail, candidateName],
        );

        const createdUser = userRes.rows[0]!;

        // 4. Create invitation token in app.invitations
        await tx.query(
          `INSERT INTO app.invitations (
             id, org_id, user_id, email, role, token_hash, expires_at
           ) VALUES (gen_random_uuid(), $1, $2, $3, 'candidate', $4, $5)`,
          [orgId, candidateId, candidateEmail, tokenHash, expiresAt],
        );

        // 5. Append tamper-evident audit record (BR-31)
        await appendAuditEvent(tx, {
          actorId: actor.userId,
          actorRole: actor.role,
          orgId,
          action: 'candidate.invited',
          entity: 'candidate',
          entityId: candidateId,
          after: {
            name: candidateName,
            email: candidateEmail,
            role: 'candidate',
          },
          ip: meta.ip ?? null,
          userAgent: meta.userAgent ?? null,
          requestId: meta.requestId ?? null,
        });

        return {
          id: createdUser.id,
          name: createdUser.name,
          email: createdUser.email,
          status: createdUser.status,
          countedAgainstCapAt: null,
          createdAt: createdUser.created_at.toISOString(),
        };
      });
    } finally {
      client.release();
    }

    // 6. After transaction commits, send invitation email via MailService (BR-24)
    await this.mailService.sendInvitationEmail({
      to: candidateEmail,
      token: rawToken,
      role: 'candidate',
      orgName,
      orgId,
    });

    return candidate;
  }
}
