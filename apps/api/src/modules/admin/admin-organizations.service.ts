import crypto from 'node:crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  AdminMetricsDtoSchema,
  PaginatedOrgListDtoSchema,
  type AdminMetricsDto,
  type CreateOrgDto,
  type OrgDto,
  type OrgListQueryDto,
  type PaginatedOrgListDto,
  type UpdateOrgStatusDto,
} from '@hs/contracts';
import type { Pool } from 'pg';
import { MailService } from '../../common/services/mail.service.js';
import { hashPassword } from '../auth/password.js';
import type { RequestMeta } from '../auth/auth.service.js';
import { problem } from '../../common/errors/app-http.exception.js';
import type { UserContext } from '../../common/types/user-context.js';
import { appendAuditEvent } from '../audit/audit-writer.js';
import { PG_PLATFORM_POOL } from '../database/database.tokens.js';
import { EMAIL_SENDER_PORT, type EmailSenderPort } from '../adapters/adapters.tokens.js';
import { SessionService } from '../session/session.service.js';
import { withPlatform } from '../tenancy/with-org.js';
import { slugifyOrgName, toOrgDto, type OrganizationRow } from './org.mapper.js';

const DEFAULT_TRIAL_DAYS = 14;
const DEFAULT_MAX_TEMPLATES = 3;
const DEFAULT_MAX_CANDIDATES = 10;

@Injectable()
export class AdminOrganizationsService {
  constructor(
    @Inject(PG_PLATFORM_POOL) private readonly pool: Pool,
    @Inject(EMAIL_SENDER_PORT) private readonly email: EmailSenderPort,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Optional() @Inject(MailService) private readonly mailService?: MailService,
  ) {}

  async provision(
    dto: CreateOrgDto,
    actor: UserContext,
    meta: RequestMeta,
  ): Promise<OrgDto> {
    const slug = dto.slug ?? slugifyOrgName(dto.name);
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Could not derive a valid slug from organization name',
        code: 'VALIDATION_ERROR',
      });
    }

    const adminEmail = dto.adminEmail.trim().toLowerCase();
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest();
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours (BR-24)
    const invitePassword = crypto.randomUUID();
    const passwordHash = await hashPassword(invitePassword);

    const client = await this.pool.connect();
    let org: OrgDto;
    try {
      org = await withPlatform(client, async (tx) => {
        const slugConflict = await tx.query('SELECT 1 FROM app.organizations WHERE slug = $1', [slug]);
        if (slugConflict.rowCount && slugConflict.rowCount > 0) {
          throw problem({
            title: 'Conflict',
            status: 409,
            detail: 'Organization slug already exists',
            code: 'ORG_SLUG_CONFLICT',
          });
        }

        const orgId = crypto.randomUUID();
        const adminId = crypto.randomUUID();
        const retentionDays = dto.retentionDays ?? 90;
        const isPaidPlan =
          dto.planId === 'plan_pro' ||
          dto.planId === 'pro' ||
          dto.planId === 'paid' ||
          dto.planId === 'paid_active';
        const initialStatus = isPaidPlan ? 'paid_active' : 'trial_active';
        const trialDays = dto.trialDays ?? DEFAULT_TRIAL_DAYS;
        const trialEnds = isPaidPlan
          ? null
          : new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
        const maxTemplates = dto.maxTemplates ?? DEFAULT_MAX_TEMPLATES;
        const maxCandidates = dto.maxCandidates ?? DEFAULT_MAX_CANDIDATES;

        const orgInsert = await tx.query<OrganizationRow>(
          `INSERT INTO app.organizations (id, name, slug, status, custom_domain, retention_days, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, name, slug, status, logo_key, custom_domain, retention_days, created_at`,
          [orgId, dto.name.trim(), slug, initialStatus, dto.customDomain ?? null, retentionDays, actor.userId],
        );

        await tx.query(
          `INSERT INTO app.entitlements (org_id, max_templates, max_candidates, trial_ends_at)
           VALUES ($1, $2, $3, $4)`,
          [orgId, maxTemplates, maxCandidates, trialEnds],
        );

        await tx.query(
          `INSERT INTO app.users (
             id, org_id, email, email_verified_at, name, role, password_hash, status, must_reset_password
           ) VALUES ($1, $2, $3, NULL, $4, 'company_admin', $5, 'invited', true)`,
          [adminId, orgId, adminEmail, dto.adminName.trim(), passwordHash],
        );

        await tx.query(
          `INSERT INTO app.invitations (
             id, org_id, user_id, email, role, token_hash, expires_at
           ) VALUES (gen_random_uuid(), $1, $2, $3, 'company_admin', $4, $5)`,
          [orgId, adminId, adminEmail, tokenHash, expiresAt],
        );

        await appendAuditEvent(tx, {
          actorId: actor.userId,
          actorRole: actor.role,
          orgId,
          action: 'org.provisioned',
          entity: 'organization',
          entityId: orgId,
          after: {
            name: dto.name,
            slug,
            adminEmail,
            planId: dto.planId ?? null,
          },
          ip: meta.ip ?? null,
          userAgent: meta.userAgent ?? null,
          requestId: meta.requestId ?? null,
        });

        const created = orgInsert.rows[0];
        if (!created) {
          throw problem({
            title: 'Internal Server Error',
            status: 500,
            detail: 'Organization insert failed',
            code: 'ORG_INSERT_FAILED',
          });
        }
        return toOrgDto(created, dto.planId ?? null, dto.whiteLabel ?? false);
      });
    } finally {
      client.release();
    }

    if (this.mailService) {
      await this.mailService.sendInvitationEmail({
        to: adminEmail,
        token: rawToken,
        role: 'company_admin',
        orgName: dto.name,
        orgId: org.id,
      });
    } else {
      await this.email.send({
        to: adminEmail,
        template: 'company_admin_invite',
        vars: { name: dto.adminName, orgName: dto.name },
        orgId: org.id,
      });
    }

    return org;
  }

  async updateStatus(
    orgId: string,
    dto: UpdateOrgStatusDto,
    actor: UserContext,
    meta: RequestMeta,
  ): Promise<OrgDto> {
    const client = await this.pool.connect();
    try {
      return await withPlatform(client, async (tx) => {
        const existing = await tx.query<OrganizationRow>(
          `SELECT id, name, slug, status, logo_key, custom_domain, retention_days, created_at
           FROM app.organizations WHERE id = $1`,
          [orgId],
        );
        const before = existing.rows[0];
        if (!before) {
          throw problem({
            title: 'Not Found',
            status: 404,
            detail: 'Organization not found',
            code: 'ORG_NOT_FOUND',
          });
        }

        const updated = await tx.query<OrganizationRow>(
          `UPDATE app.organizations SET status = $2, updated_at = now()
           WHERE id = $1
           RETURNING id, name, slug, status, logo_key, custom_domain, retention_days, created_at`,
          [orgId, dto.status],
        );
        const row = updated.rows[0];
        if (!row) {
          throw problem({
            title: 'Internal Server Error',
            status: 500,
            detail: 'Organization update failed',
            code: 'ORG_UPDATE_FAILED',
          });
        }

        await appendAuditEvent(tx, {
          actorId: actor.userId,
          actorRole: actor.role,
          orgId,
          action: 'org.status_changed',
          entity: 'organization',
          entityId: orgId,
          before: { status: before.status, reason: dto.reason ?? null },
          after: { status: dto.status, reason: dto.reason ?? null },
          ip: meta.ip ?? null,
          userAgent: meta.userAgent ?? null,
          requestId: meta.requestId ?? null,
        });

        if (dto.status === 'suspended') {
          const users = await tx.query<{ id: string }>(
            `SELECT id FROM app.users WHERE org_id = $1 AND deleted_at IS NULL`,
            [orgId],
          );
          for (const user of users.rows) {
            await this.sessions.revokeAllSessionsForUser(user.id);
          }
        }

        return toOrgDto(row);
      });
    } finally {
      client.release();
    }
  }

  async list(): Promise<OrgDto[]> {
    const client = await this.pool.connect();

    try {
      return await withPlatform(client, async (tx) => {
        const result = await tx.query<OrganizationRow>(
          `SELECT id, name, slug, status, logo_key, custom_domain,
                  retention_days, created_at
           FROM app.organizations
           ORDER BY created_at DESC`,
        );

        return result.rows.map((row) =>
          toOrgDto(row, null, false),
        );
      });
    } finally {
      client.release();
    }
  }

  async listOrganizations(query: OrgListQueryDto): Promise<PaginatedOrgListDto> {
    const client = await this.pool.connect();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    try {
      return await withPlatform(client, async (tx) => {
        const conditions: string[] = [];
        const params: unknown[] = [];

        if (query.status) {
          params.push(query.status);
          conditions.push(`o.status = $${params.length}`);
        }

        if (query.search && query.search.trim().length > 0) {
          params.push(`%${query.search.trim()}%`);
          conditions.push(`(
            o.name ILIKE $${params.length} 
            OR o.slug ILIKE $${params.length}
            OR EXISTS (
              SELECT 1 FROM app.users u 
              WHERE u.org_id = o.id 
                AND u.role = 'company_admin' 
                AND u.deleted_at IS NULL 
                AND u.email ILIKE $${params.length}
            )
          )`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const countQuery = `SELECT COUNT(*)::int AS total FROM app.organizations o ${whereClause}`;
        const countResult = await tx.query<{ total: number }>(countQuery, params);
        const total = countResult.rows[0]?.total ?? 0;

        const queryParams = [...params, pageSize, offset];
        const itemsSql = `
          SELECT
            o.id,
            o.name,
            o.slug,
            o.status,
            o.created_at,
            e.trial_ends_at,
            COALESCE(e.max_templates, 3)::int AS max_templates,
            COALESCE(e.max_candidates, 10)::int AS max_candidates,
            (
              SELECT u.email
              FROM app.users u
              WHERE u.org_id = o.id
                AND u.role = 'company_admin'
                AND u.deleted_at IS NULL
              ORDER BY u.created_at ASC
              LIMIT 1
            ) AS admin_email,
            (
              SELECT u.name
              FROM app.users u
              WHERE u.org_id = o.id
                AND u.role = 'company_admin'
                AND u.deleted_at IS NULL
              ORDER BY u.created_at ASC
              LIMIT 1
            ) AS admin_name,
            COALESCE(
              (
                SELECT COUNT(*)::int
                FROM app.users u
                WHERE u.org_id = o.id
                  AND u.role = 'candidate'
                  AND u.status != 'deleted'
                  AND u.deleted_at IS NULL
              ),
              0
            )::int AS candidate_count
          FROM app.organizations o
          LEFT JOIN app.entitlements e ON e.org_id = o.id
          ${whereClause}
          ORDER BY o.created_at DESC
          LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `;

        interface OrgListRow {
          id: string;
          name: string;
          slug: string;
          status: string;
          created_at: Date | string;
          trial_ends_at: Date | string | null;
          candidate_count: number;
          admin_email?: string | null;
          admin_name?: string | null;
          max_templates?: number | null;
          max_candidates?: number | null;
        }

        const itemsResult = await tx.query<OrgListRow>(itemsSql, queryParams);

        const items = itemsResult.rows.map((row) => ({
          id: row.id,
          name: row.name,
          slug: row.slug,
          status: row.status as any,
          candidateCount: Number(row.candidate_count ?? 0),
          adminEmail: row.admin_email || '',
          adminName: row.admin_name || '',
          maxTemplates: Number(row.max_templates ?? 3),
          maxCandidates: Number(row.max_candidates ?? 10),
          createdAt:
            row.created_at instanceof Date
              ? row.created_at.toISOString()
              : new Date(row.created_at).toISOString(),
          trialEndsAt: row.trial_ends_at
            ? row.trial_ends_at instanceof Date
              ? row.trial_ends_at.toISOString()
              : new Date(row.trial_ends_at).toISOString()
            : null,
        }));

        const response: PaginatedOrgListDto = {
          items,
          page,
          pageSize,
          total,
        };

        return PaginatedOrgListDtoSchema.parse(response);
      });
    } finally {
      client.release();
    }
  }

  async getMetrics(): Promise<AdminMetricsDto> {
    const client = await this.pool.connect();

    try {
      return await withPlatform(client, async (tx) => {
        const metricsSql = `
          SELECT
            (SELECT COUNT(*)::int FROM app.organizations) AS total_companies,
            (
              SELECT COUNT(*)::int
              FROM app.organizations o
              JOIN app.entitlements e ON e.org_id = o.id
              WHERE o.status = 'trial_active'
                AND e.trial_ends_at > now()
            ) AS active_trials,
            (
              SELECT COUNT(*)::int
              FROM app.users
              WHERE role = 'candidate'
                AND status != 'deleted'
                AND deleted_at IS NULL
            ) AS total_candidates
        `;

        interface MetricsRow {
          total_companies: number;
          active_trials: number;
          total_candidates: number;
        }

        const result = await tx.query<MetricsRow>(metricsSql);
        const row = result.rows[0];

        const metrics: AdminMetricsDto = {
          totalCompanies: Number(row?.total_companies ?? 0),
          activeTrials: Number(row?.active_trials ?? 0),
          totalCandidates: Number(row?.total_candidates ?? 0),
        };

        return AdminMetricsDtoSchema.parse(metrics);
      });
    } finally {
      client.release();
    }
  }
}
