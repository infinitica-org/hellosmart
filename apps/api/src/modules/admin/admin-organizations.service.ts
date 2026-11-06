import crypto from 'node:crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  AdminMetricsDtoSchema,
  PaginatedOrgListDtoSchema,
  OrgDetailDtoSchema,
  type AdminMetricsDto,
  type CreateOrgDto,
  type OrgDto,
  type OrgListQueryDto,
  type PaginatedOrgListDto,
  type UpdateOrgStatusDto,
  type OrgDetailDto,
  type UpdateOrgEntitlementsDto,
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

  async getOrganizationById(orgId: string): Promise<OrgDetailDto> {
    const client = await this.pool.connect();
    try {
      return await withPlatform(client, async (tx) => {
        const orgSql = `
          SELECT
            o.id,
            o.name,
            o.slug,
            o.status,
            o.logo_key,
            o.custom_domain,
            o.retention_days,
            o.created_at,
            o.updated_at,
            e.max_templates,
            e.max_candidates,
            e.trial_ends_at,
            e.pending_invite_multiplier,
            e.flags,
            e.updated_at AS entitlements_updated_at,
            u.id AS admin_id,
            u.name AS admin_name,
            u.email AS admin_email,
            u.status AS admin_status,
            u.last_login_at AS admin_last_login_at,
            COALESCE(
              (SELECT COUNT(*)::int FROM app.users cu WHERE cu.org_id = o.id AND cu.role = 'candidate' AND cu.status != 'deleted' AND cu.deleted_at IS NULL),
              0
            )::int AS candidate_count,
            COALESCE(
              (SELECT COUNT(*)::int FROM app.assessments a WHERE a.org_id = o.id AND a.deleted_at IS NULL),
              0
            )::int AS assessment_count,
            COALESCE(
              (SELECT COUNT(*)::int FROM app.workspaces w WHERE w.org_id = o.id AND w.status IN ('provisioning', 'not_connected', 'connected', 'disconnected')),
              0
            )::int AS active_workspaces_count
          FROM app.organizations o
          LEFT JOIN app.entitlements e ON e.org_id = o.id
          LEFT JOIN LATERAL (
            SELECT id, name, email, status, last_login_at
            FROM app.users
            WHERE org_id = o.id AND role = 'company_admin' AND deleted_at IS NULL
            ORDER BY created_at ASC
            LIMIT 1
          ) u ON true
          WHERE o.id = $1
        `;

        const result = await tx.query(orgSql, [orgId]);
        const row = result.rows[0];
        if (!row) {
          throw problem({
            title: 'Not Found',
            status: 404,
            detail: `Organization with id "${orgId}" was not found`,
            code: 'ORG_NOT_FOUND',
          });
        }

        const parseIsoDate = (val: any): string => {
          if (val instanceof Date) return val.toISOString();
          if (typeof val === 'string' && val.length > 0) {
            const d = new Date(val);
            if (!isNaN(d.getTime())) return d.toISOString();
          }
          return new Date().toISOString();
        };

        const adminObj = row.admin_id
          ? {
              id: row.admin_id,
              name: row.admin_name || 'Admin',
              email: row.admin_email,
              status: row.admin_status || 'active',
              lastLoginAt: row.admin_last_login_at
                ? row.admin_last_login_at instanceof Date
                  ? row.admin_last_login_at.toISOString()
                  : new Date(row.admin_last_login_at).toISOString()
                : null,
            }
          : null;

        const detail: OrgDetailDto = {
          id: row.id,
          name: row.name,
          slug: row.slug,
          status: row.status,
          planId: row.status === 'paid_active' ? 'plan_pro' : 'plan_trial',
          logoUrl: row.logo_key ?? null,
          whiteLabel: Boolean(row.flags?.white_label),
          customDomain: row.custom_domain ?? null,
          retentionDays: row.retention_days,
          createdAt: parseIsoDate(row.created_at),
          updatedAt: parseIsoDate(row.updated_at || row.created_at),
          adminUser: adminObj,
          primaryAdmin: adminObj,
          entitlements: {
            orgId: row.id,
            maxTemplates: Number(row.max_templates ?? 3),
            maxCandidates: Number(row.max_candidates ?? 10),
            trialEndsAt: row.trial_ends_at
              ? row.trial_ends_at instanceof Date
                ? row.trial_ends_at.toISOString()
                : new Date(row.trial_ends_at).toISOString()
              : null,
            pendingInviteMultiplier: Number(row.pending_invite_multiplier ?? 2.0),
            flags: typeof row.flags === 'object' && row.flags !== null ? row.flags : {},
            updatedAt: parseIsoDate(row.entitlements_updated_at || row.updated_at || row.created_at),
          },
          stats: {
            candidateCount: Number(row.candidate_count ?? 0),
            assessmentCount: Number(row.assessment_count ?? 0),
            activeWorkspacesCount: Number(row.active_workspaces_count ?? 0),
          },
        };

        return OrgDetailDtoSchema.parse(detail);
      });
    } finally {
      client.release();
    }
  }

  async updateEntitlements(
    orgId: string,
    dto: UpdateOrgEntitlementsDto,
    actor: UserContext,
    meta: RequestMeta,
  ): Promise<OrgDetailDto> {
    const client = await this.pool.connect();
    try {
      return await withPlatform(client, async (tx) => {
        const orgCheck = await tx.query('SELECT id, name FROM app.organizations WHERE id = $1', [orgId]);
        if (!orgCheck.rows[0]) {
          throw problem({
            title: 'Not Found',
            status: 404,
            detail: `Organization with id "${orgId}" was not found`,
            code: 'ORG_NOT_FOUND',
          });
        }

        const existingRes = await tx.query(
          `SELECT org_id, max_templates, max_candidates, trial_ends_at, pending_invite_multiplier, flags
           FROM app.entitlements WHERE org_id = $1`,
          [orgId],
        );
        const existing = existingRes.rows[0] || {
          org_id: orgId,
          max_templates: 3,
          max_candidates: 10,
          trial_ends_at: null,
          pending_invite_multiplier: 2.0,
          flags: {},
        };

        const newMaxTemplates = dto.maxTemplates ?? existing.max_templates;
        const newMaxCandidates = dto.maxCandidates ?? existing.max_candidates;
        const newTrialEnds =
          dto.trialEndsAt !== undefined
            ? dto.trialEndsAt
              ? new Date(dto.trialEndsAt)
              : null
            : existing.trial_ends_at;
        const newPendingMultiplier = dto.pendingInviteMultiplier ?? existing.pending_invite_multiplier;
        const newFlags = {
          ...(typeof existing.flags === 'object' && existing.flags !== null ? existing.flags : {}),
          ...(dto.flags || {}),
        };

        await tx.query(
          `INSERT INTO app.entitlements (
             org_id, max_templates, max_candidates, trial_ends_at, pending_invite_multiplier, flags, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, now())
           ON CONFLICT (org_id) DO UPDATE SET
             max_templates = EXCLUDED.max_templates,
             max_candidates = EXCLUDED.max_candidates,
             trial_ends_at = EXCLUDED.trial_ends_at,
             pending_invite_multiplier = EXCLUDED.pending_invite_multiplier,
             flags = EXCLUDED.flags,
             updated_at = now()`,
          [orgId, newMaxTemplates, newMaxCandidates, newTrialEnds, newPendingMultiplier, JSON.stringify(newFlags)],
        );

        await appendAuditEvent(tx, {
          actorId: actor.userId,
          actorRole: actor.role,
          orgId,
          action: 'entitlements.modified',
          entity: 'entitlements',
          entityId: orgId,
          before: {
            max_templates: existing.max_templates,
            max_candidates: existing.max_candidates,
            trial_ends_at: existing.trial_ends_at
              ? existing.trial_ends_at instanceof Date
                ? existing.trial_ends_at.toISOString()
                : new Date(existing.trial_ends_at).toISOString()
              : null,
            pending_invite_multiplier: Number(existing.pending_invite_multiplier),
            flags: existing.flags,
          },
          after: {
            max_templates: newMaxTemplates,
            max_candidates: newMaxCandidates,
            trial_ends_at: newTrialEnds instanceof Date ? newTrialEnds.toISOString() : newTrialEnds,
            pending_invite_multiplier: Number(newPendingMultiplier),
            flags: newFlags,
            reason: dto.reason ?? null,
          },
          ip: meta.ip ?? null,
          userAgent: meta.userAgent ?? null,
          requestId: meta.requestId ?? null,
        });

        // Re-read and return detailed view
        const updatedDetail = await this.getOrganizationById(orgId);
        return updatedDetail;
      });
    } finally {
      client.release();
    }
  }
}
