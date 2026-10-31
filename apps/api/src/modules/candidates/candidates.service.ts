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

  async findAll(
    filters: { search?: string | undefined; status?: string | undefined; page?: number | undefined; limit?: number | undefined },
    actor: UserContext,
  ): Promise<{ items: CandidateDto[]; total: number; page: number; limit: number; totalPages: number }> {
    const orgId = actor.orgId;
    if (!orgId) {
      throw problem({
        title: 'Forbidden',
        status: 403,
        detail: 'User does not belong to an organization',
        code: 'TENANT_REQUIRED',
      });
    }

    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filters.limit) || 10));
    const offset = (page - 1) * limit;

    const client = await this.pool.connect();
    try {
      return await withOrg(client, orgId, async (tx) => {
        const conditions: string[] = ["org_id = $1", "role = 'candidate'", "status != 'deleted'"];
        const values: unknown[] = [orgId];
        let paramIdx = 2;

        if (filters.search && filters.search.trim()) {
          conditions.push(`(name ILIKE $${paramIdx} OR email ILIKE $${paramIdx})`);
          values.push(`%${filters.search.trim()}%`);
          paramIdx++;
        }

        if (filters.status && filters.status !== 'all') {
          conditions.push(`status = $${paramIdx}`);
          values.push(filters.status.trim());
          paramIdx++;
        }

        const whereClause = conditions.join(' AND ');

        const countRes = await tx.query<{ count: string }>(
          `SELECT count(*)::text as count FROM app.users WHERE ${whereClause}`,
          values,
        );
        const total = Number.parseInt(countRes.rows[0]?.count || '0', 10);

        const dataRes = await tx.query<{
          id: string;
          name: string;
          email: string;
          status: 'invited' | 'active' | 'suspended' | 'deleted';
          created_at: Date;
        }>(
          `SELECT id, name, email, status, created_at
           FROM app.users
           WHERE ${whereClause}
           ORDER BY created_at DESC
           LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
          [...values, limit, offset],
        );

        const items: CandidateDto[] = dataRes.rows.map((row) => ({
          id: row.id,
          name: row.name,
          email: row.email,
          status: row.status === 'suspended' ? 'invited' : (row.status as 'invited' | 'active' | 'deleted'),
          countedAgainstCapAt: null,
          createdAt: row.created_at.toISOString(),
        }));

        return {
          items,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        };
      });
    } finally {
      client.release();
    }
  }

  async bulkCreate(
    payload: { candidates: CreateCandidateDto[] },
    actor: UserContext,
    meta: RequestMeta,
  ): Promise<{ created: CandidateDto[]; errors: { row: number; email: string; reason: string }[] }> {
    const created: CandidateDto[] = [];
    const errors: { row: number; email: string; reason: string }[] = [];

    for (let i = 0; i < payload.candidates.length; i++) {
      const candidateDto = payload.candidates[i]!;
      try {
        const res = await this.create(candidateDto, actor, meta);
        created.push(res);
      } catch (err: any) {
        errors.push({
          row: i + 1,
          email: candidateDto.email,
          reason: err?.detail || err?.message || 'Failed to import candidate',
        });
      }
    }

    return { created, errors };
  }

  async update(
    candidateId: string,
    dto: { name?: string | undefined; email?: string | undefined },
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

    const client = await this.pool.connect();
    try {
      return await withOrg(client, orgId, async (tx) => {
        const findRes = await tx.query<{
          id: string;
          name: string;
          email: string;
          status: 'invited' | 'active' | 'suspended';
          created_at: Date;
        }>(
          `SELECT id, name, email, status, created_at FROM app.users WHERE id = $1 AND org_id = $2 AND role = 'candidate'`,
          [candidateId, orgId],
        );

        if (findRes.rowCount === 0) {
          throw problem({
            title: 'Not Found',
            status: 404,
            detail: 'Candidate not found in your organization',
            code: 'CANDIDATE_NOT_FOUND',
          });
        }

        const candidate = findRes.rows[0]!;

        if (dto.email && dto.email.trim().toLowerCase() !== candidate.email && candidate.status === 'active') {
          throw problem({
            title: 'Conflict',
            status: 409,
            detail: 'Cannot change email of an active candidate with an existing session account',
            code: 'EMAIL_CHANGE_FORBIDDEN',
          });
        }

        const newName = dto.name?.trim() || candidate.name;
        const newEmail = dto.email?.trim().toLowerCase() || candidate.email;

        const updateRes = await tx.query<{
          id: string;
          name: string;
          email: string;
          status: 'invited' | 'active' | 'suspended';
          created_at: Date;
        }>(
          `UPDATE app.users SET name = $1, email = $2 WHERE id = $3 AND org_id = $4 RETURNING id, name, email, status, created_at`,
          [newName, newEmail, candidateId, orgId],
        );

        const updated = updateRes.rows[0]!;

        await appendAuditEvent(tx, {
          actorId: actor.userId,
          actorRole: actor.role,
          orgId,
          action: 'candidate.updated',
          entity: 'candidate',
          entityId: candidateId,
          before: { name: candidate.name, email: candidate.email },
          after: { name: updated.name, email: updated.email },
          ip: meta.ip ?? null,
          userAgent: meta.userAgent ?? null,
          requestId: meta.requestId ?? null,
        });

        return {
          id: updated.id,
          name: updated.name,
          email: updated.email,
          status: updated.status === 'suspended' ? 'invited' : (updated.status as 'invited' | 'active' | 'deleted'),
          countedAgainstCapAt: null,
          createdAt: updated.created_at.toISOString(),
        };
      });
    } finally {
      client.release();
    }
  }

  async delete(
    candidateId: string,
    actor: UserContext,
    meta: RequestMeta,
  ): Promise<{ success: boolean; message: string }> {
    const orgId = actor.orgId;
    if (!orgId) {
      throw problem({
        title: 'Forbidden',
        status: 403,
        detail: 'User does not belong to an organization',
        code: 'TENANT_REQUIRED',
      });
    }

    const client = await this.pool.connect();
    try {
      return await withOrg(client, orgId, async (tx) => {
        const findRes = await tx.query<{ id: string; email: string }>(
          `SELECT id, email FROM app.users WHERE id = $1 AND org_id = $2 AND role = 'candidate' AND status != 'deleted'`,
          [candidateId, orgId],
        );

        if (findRes.rowCount === 0) {
          throw problem({
            title: 'Not Found',
            status: 404,
            detail: 'Candidate not found',
            code: 'CANDIDATE_NOT_FOUND',
          });
        }

        await tx.query(
          `UPDATE app.users SET status = 'deleted', deleted_at = now() WHERE id = $1 AND org_id = $2`,
          [candidateId, orgId],
        );

        await tx.query(
          `DELETE FROM app.invitations WHERE user_id = $1 AND org_id = $2`,
          [candidateId, orgId],
        );

        await appendAuditEvent(tx, {
          actorId: actor.userId,
          actorRole: actor.role,
          orgId,
          action: 'candidate.deleted',
          entity: 'candidate',
          entityId: candidateId,
          after: { status: 'deleted' },
          ip: meta.ip ?? null,
          userAgent: meta.userAgent ?? null,
          requestId: meta.requestId ?? null,
        });

        return { success: true, message: 'Candidate soft-deleted successfully' };
      });
    } finally {
      client.release();
    }
  }

  async resendInvite(
    candidateId: string,
    actor: UserContext,
    meta: RequestMeta,
  ): Promise<{ success: boolean; sentAt: string }> {
    const orgId = actor.orgId;
    if (!orgId) {
      throw problem({
        title: 'Forbidden',
        status: 403,
        detail: 'User does not belong to an organization',
        code: 'TENANT_REQUIRED',
      });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest();
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const client = await this.pool.connect();
    let candidateEmail = '';
    let orgName = 'HelloSmart Organization';

    try {
      await withOrg(client, orgId, async (tx) => {
        const userRes = await tx.query<{ email: string; status: string }>(
          `SELECT email, status FROM app.users WHERE id = $1 AND org_id = $2 AND role = 'candidate'`,
          [candidateId, orgId],
        );

        if (userRes.rowCount === 0) {
          throw problem({
            title: 'Not Found',
            status: 404,
            detail: 'Candidate not found',
            code: 'CANDIDATE_NOT_FOUND',
          });
        }

        candidateEmail = userRes.rows[0]!.email;

        const orgRes = await tx.query<{ name: string }>(
          `SELECT name FROM app.organizations WHERE id = $1`,
          [orgId],
        );
        if (orgRes.rows[0]) {
          orgName = orgRes.rows[0].name;
        }

        await tx.query(
          `DELETE FROM app.invitations WHERE user_id = $1 AND org_id = $2`,
          [candidateId, orgId],
        );

        await tx.query(
          `INSERT INTO app.invitations (
             id, org_id, user_id, email, role, token_hash, expires_at
           ) VALUES (gen_random_uuid(), $1, $2, $3, 'candidate', $4, $5)`,
          [orgId, candidateId, candidateEmail, tokenHash, expiresAt],
        );

        await appendAuditEvent(tx, {
          actorId: actor.userId,
          actorRole: actor.role,
          orgId,
          action: 'candidate.invite_resent',
          entity: 'candidate',
          entityId: candidateId,
          ip: meta.ip ?? null,
          userAgent: meta.userAgent ?? null,
          requestId: meta.requestId ?? null,
        });
      });
    } finally {
      client.release();
    }

    await this.mailService.sendInvitationEmail({
      to: candidateEmail,
      token: rawToken,
      role: 'candidate',
      orgName,
      orgId,
    });

    return { success: true, sentAt: new Date().toISOString() };
  }
}
