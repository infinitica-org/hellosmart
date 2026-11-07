import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import {
  type AdminWorkspaceQueryDto,
  type AdminWorkspacesListResponseDto,
  type AdminWorkspaceListItemDto,
  type AdminWorkspaceDetailDto,
  type EmergencyDestroyWorkspaceDto,
  type EmergencyDestroyResponseDto,
  AdminWorkspacesListResponseDtoSchema,
  AdminWorkspaceDetailDtoSchema,
  EmergencyDestroyResponseDtoSchema,
} from '@hs/contracts';
import { PG_PLATFORM_POOL } from '../database/database.tokens.js';
import { problem } from '../../common/errors/app-http.exception.js';
import type { UserContext } from '../../common/types/user-context.js';
import type { RequestMeta } from '../auth/auth.service.js';
import { appendAuditEvent } from '../audit/audit-writer.js';
import { withPlatform } from '../tenancy/with-org.js';

function parseIso(val: any): string {
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'string' && val.length > 0) {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

function parseOptionalIso(val: any): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'string' && val.length > 0) {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

function asInet(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const trimmed = ip.trim();
  if (!trimmed) return null;
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(trimmed) || trimmed.includes(':')) {
    return trimmed;
  }
  return null;
}

@Injectable()
export class AdminWorkspacesService {
  private readonly logger = new Logger(AdminWorkspacesService.name);

  constructor(
    @Inject(PG_PLATFORM_POOL)
    private readonly pool: Pool,
  ) {}

  /**
   * List workspaces across all tenants with filtering, search, pagination, and platform aggregate metrics (AD-018).
   */
  async listWorkspaces(
    query: AdminWorkspaceQueryDto,
    actor: UserContext,
  ): Promise<AdminWorkspacesListResponseDto> {
    const client = await this.pool.connect();
    try {
      return await withPlatform(client, async (tx) => {
        const page = Math.max(1, query.page || 1);
        const pageSize = Math.min(100, Math.max(1, query.page_size || 25));
        const offset = (page - 1) * pageSize;

        const whereClauses: string[] = ['1=1'];
        const queryParams: any[] = [];
        let paramIdx = 1;

        if (query.org_id) {
          whereClauses.push(`w.org_id = $${paramIdx++}`);
          queryParams.push(query.org_id);
        }

        if (query.status && query.status !== 'all') {
          if (query.status === 'active') {
            whereClauses.push(
              `w.status IN ('queued', 'provisioning', 'not_connected', 'connected', 'disconnected')`,
            );
          } else {
            whereClauses.push(`w.status = $${paramIdx++}`);
            queryParams.push(query.status);
          }
        }

        if (query.mode && query.mode !== 'all') {
          whereClauses.push(`w.mode = $${paramIdx++}`);
          queryParams.push(query.mode);
        }

        if (query.search && query.search.trim()) {
          const searchPattern = `%${query.search.trim()}%`;
          whereClauses.push(
            `(u.name ILIKE $${paramIdx} OR u.email ILIKE $${paramIdx} OR o.name ILIKE $${paramIdx} OR asm.name ILIKE $${paramIdx} OR w.id::text ILIKE $${paramIdx})`,
          );
          queryParams.push(searchPattern);
          paramIdx++;
        }

        const whereSql = whereClauses.join(' AND ');

        // 1. Get filtered total count
        const countSql = `
          SELECT COUNT(*)::int AS total
          FROM app.workspaces w
          JOIN app.organizations o ON o.id = w.org_id
          JOIN app.assignments a ON a.id = w.assignment_id AND a.org_id = w.org_id
          JOIN app.users u ON u.id = a.candidate_id
          JOIN app.assessments asm ON asm.id = a.assessment_id AND asm.org_id = w.org_id
          WHERE ${whereSql}
        `;
        const countRes = await tx.query(countSql, queryParams);
        const total = countRes.rows[0]?.total || 0;

        // 2. Fetch page items
        const listSql = `
          SELECT
            w.id,
            w.org_id,
            o.name AS org_name,
            o.slug AS org_slug,
            a.candidate_id,
            u.name AS candidate_name,
            u.email AS candidate_email,
            w.assignment_id,
            a.assessment_id,
            asm.name AS assessment_name,
            w.mode,
            w.status,
            w.runtime_ref,
            w.snapshot_ref,
            w.started_at,
            w.last_activity_at,
            w.disconnected_at,
            w.ended_at,
            a.deadline_at,
            pca.allocated_amount_cents,
            pca.used_amount_cents,
            pca.balance_cents,
            pca.markup_percentage,
            pca.spend_cap_cents
          FROM app.workspaces w
          JOIN app.organizations o ON o.id = w.org_id
          JOIN app.assignments a ON a.id = w.assignment_id AND a.org_id = w.org_id
          JOIN app.users u ON u.id = a.candidate_id
          JOIN app.assessments asm ON asm.id = a.assessment_id AND asm.org_id = w.org_id
          LEFT JOIN LATERAL (
            SELECT allocated_amount_cents, used_amount_cents, balance_cents, markup_percentage, spend_cap_cents
            FROM app.platform_credit_allocations
            WHERE org_id = w.org_id AND status = 'active'
            ORDER BY created_at DESC
            LIMIT 1
          ) pca ON true
          WHERE ${whereSql}
          ORDER BY w.last_activity_at DESC, w.started_at DESC
          LIMIT $${paramIdx++} OFFSET $${paramIdx++}
        `;
        queryParams.push(pageSize, offset);

        const listRes = await tx.query(listSql, queryParams);

        // 3. Platform aggregate metrics
        const metricsSql = `
          SELECT
            COUNT(*)::int AS total_workspaces,
            COUNT(*) FILTER (WHERE status IN ('queued', 'provisioning', 'not_connected', 'connected', 'disconnected'))::int AS active_workspaces,
            COUNT(*) FILTER (WHERE status = 'connected')::int AS connected_count,
            COUNT(*) FILTER (WHERE status = 'disconnected')::int AS disconnected_count,
            COUNT(*) FILTER (WHERE status = 'destroyed')::int AS destroyed_count,
            COUNT(*) FILTER (WHERE status = 'ended')::int AS ended_count,
            COUNT(DISTINCT org_id)::int AS tracked_tenants_count
          FROM app.workspaces
        `;
        const metricsRes = await tx.query(metricsSql);
        const mRow = metricsRes.rows[0] || {};

        const nowMs = Date.now();

        const items: AdminWorkspaceListItemDto[] = listRes.rows.map((row: any) => {
          const lastActivityDate = row.last_activity_at ? new Date(row.last_activity_at) : new Date(row.started_at);
          const idleMinutes = Math.max(0, Math.floor((nowMs - lastActivityDate.getTime()) / 60000));
          const isOnline = row.status === 'connected' && idleMinutes < 5;

          return {
            id: row.id,
            orgId: row.org_id,
            orgName: row.org_name,
            orgSlug: row.org_slug,
            candidateId: row.candidate_id,
            candidateName: row.candidate_name,
            candidateEmail: row.candidate_email,
            assignmentId: row.assignment_id,
            assessmentId: row.assessment_id,
            assessmentName: row.assessment_name,
            mode: row.mode,
            status: row.status,
            runtimeRef: row.runtime_ref ?? null,
            snapshotRef: row.snapshot_ref ?? null,
            startedAt: parseIso(row.started_at),
            lastActivityAt: parseIso(row.last_activity_at),
            disconnectedAt: parseOptionalIso(row.disconnected_at),
            endedAt: parseOptionalIso(row.ended_at),
            deadlineAt: parseOptionalIso(row.deadline_at),
            idleMinutes,
            isOnline,
            spendInfo: {
              meteringStatus: 'unconnected',
              meteringNotice: 'AI proxy runtime metering unconnected',
              allocatedAmountCents: row.allocated_amount_cents != null ? Number(row.allocated_amount_cents) : null,
              usedAmountCents: row.used_amount_cents != null ? Number(row.used_amount_cents) : null,
              balanceCents: row.balance_cents != null ? Number(row.balance_cents) : null,
              markupPercentage: row.markup_percentage != null ? Number(row.markup_percentage) : null,
              spendCapCents: row.spend_cap_cents != null ? Number(row.spend_cap_cents) : null,
            },
          };
        });

        const totalPages = Math.ceil(total / pageSize);

        const responsePayload = {
          items,
          total,
          page,
          pageSize,
          totalPages,
          metrics: {
            totalWorkspaces: Number(mRow.total_workspaces ?? 0),
            activeWorkspaces: Number(mRow.active_workspaces ?? 0),
            connectedCount: Number(mRow.connected_count ?? 0),
            disconnectedCount: Number(mRow.disconnected_count ?? 0),
            destroyedCount: Number(mRow.destroyed_count ?? 0),
            endedCount: Number(mRow.ended_count ?? 0),
            trackedTenantsCount: Number(mRow.tracked_tenants_count ?? 0),
          },
        };

        return AdminWorkspacesListResponseDtoSchema.parse(responsePayload);
      });
    } finally {
      client.release();
    }
  }

  /**
   * Retrieve single workspace detail with activity timeline and credit allocation (AD-018, BR-22).
   */
  async getWorkspaceDetail(
    id: string,
    actor: UserContext,
  ): Promise<AdminWorkspaceDetailDto> {
    const client = await this.pool.connect();
    try {
      return await withPlatform(client, async (tx) => {
        const detailSql = `
          SELECT
            w.id,
            w.org_id,
            o.name AS org_name,
            o.slug AS org_slug,
            a.candidate_id,
            u.name AS candidate_name,
            u.email AS candidate_email,
            w.assignment_id,
            a.assessment_id,
            asm.name AS assessment_name,
            w.mode,
            w.status,
            w.runtime_ref,
            w.snapshot_ref,
            w.started_at,
            w.last_activity_at,
            w.disconnected_at,
            w.ended_at,
            a.deadline_at,
            a.extended_minutes,
            a.first_connect_at,
            a.submitted_at,
            a.auto_submitted,
            a.write_revoked_at,
            pca.id AS allocation_id,
            pca.allocated_amount_cents,
            pca.used_amount_cents,
            pca.balance_cents,
            pca.markup_percentage,
            pca.spend_cap_cents,
            pca.status AS allocation_status
          FROM app.workspaces w
          JOIN app.organizations o ON o.id = w.org_id
          JOIN app.assignments a ON a.id = w.assignment_id AND a.org_id = w.org_id
          JOIN app.users u ON u.id = a.candidate_id
          JOIN app.assessments asm ON asm.id = a.assessment_id AND asm.org_id = w.org_id
          LEFT JOIN LATERAL (
            SELECT id, allocated_amount_cents, used_amount_cents, balance_cents, markup_percentage, spend_cap_cents, status
            FROM app.platform_credit_allocations
            WHERE org_id = w.org_id AND status = 'active'
            ORDER BY created_at DESC
            LIMIT 1
          ) pca ON true
          WHERE w.id = $1
        `;
        const res = await tx.query(detailSql, [id]);
        const row = res.rows[0];

        if (!row) {
          throw problem({
            title: 'Not Found',
            status: 404,
            detail: `Workspace with id "${id}" was not found`,
            code: 'WORKSPACE_NOT_FOUND',
          });
        }

        // Recent activity events
        const eventsSql = `
          SELECT id, type, payload, ip::text, at
          FROM app.activity_events
          WHERE org_id = $1 AND (workspace_id = $2 OR assignment_id = $3)
          ORDER BY at DESC
          LIMIT 25
        `;
        const eventsRes = await tx.query(eventsSql, [row.org_id, row.id, row.assignment_id]);

        const recentEvents = eventsRes.rows.map((ev: any) => ({
          id: ev.id,
          type: ev.type,
          payload: ev.payload || {},
          ip: ev.ip ?? null,
          at: parseIso(ev.at),
        }));

        const nowMs = Date.now();
        const lastActivityDate = row.last_activity_at ? new Date(row.last_activity_at) : new Date(row.started_at);
        const idleMinutes = Math.max(0, Math.floor((nowMs - lastActivityDate.getTime()) / 60000));
        const isOnline = row.status === 'connected' && idleMinutes < 5;

        const detailPayload = {
          id: row.id,
          orgId: row.org_id,
          orgName: row.org_name,
          orgSlug: row.org_slug,
          candidateId: row.candidate_id,
          candidateName: row.candidate_name,
          candidateEmail: row.candidate_email,
          assignmentId: row.assignment_id,
          assessmentId: row.assessment_id,
          assessmentName: row.assessment_name,
          mode: row.mode,
          status: row.status,
          runtimeRef: row.runtime_ref ?? null,
          snapshotRef: row.snapshot_ref ?? null,
          startedAt: parseIso(row.started_at),
          lastActivityAt: parseIso(row.last_activity_at),
          disconnectedAt: parseOptionalIso(row.disconnected_at),
          endedAt: parseOptionalIso(row.ended_at),
          deadlineAt: parseOptionalIso(row.deadline_at),
          idleMinutes,
          isOnline,
          spendInfo: {
            meteringStatus: 'unconnected' as const,
            meteringNotice: 'AI proxy runtime metering unconnected',
            allocatedAmountCents: row.allocated_amount_cents != null ? Number(row.allocated_amount_cents) : null,
            usedAmountCents: row.used_amount_cents != null ? Number(row.used_amount_cents) : null,
            balanceCents: row.balance_cents != null ? Number(row.balance_cents) : null,
            markupPercentage: row.markup_percentage != null ? Number(row.markup_percentage) : null,
            spendCapCents: row.spend_cap_cents != null ? Number(row.spend_cap_cents) : null,
          },
          recentEvents,
          tenantCreditAllocation: row.allocation_id
            ? {
                id: row.allocation_id,
                allocatedAmountCents: Number(row.allocated_amount_cents),
                usedAmountCents: Number(row.used_amount_cents),
                balanceCents: Number(row.balance_cents),
                markupPercentage: Number(row.markup_percentage),
                spendCapCents: row.spend_cap_cents != null ? Number(row.spend_cap_cents) : null,
                status: row.allocation_status,
              }
            : null,
          assignmentTiming: {
            deadlineAt: parseOptionalIso(row.deadline_at),
            extendedMinutes: Number(row.extended_minutes ?? 0),
            firstConnectAt: parseOptionalIso(row.first_connect_at),
            submittedAt: parseOptionalIso(row.submitted_at),
            autoSubmitted: Boolean(row.auto_submitted),
            writeRevokedAt: parseOptionalIso(row.write_revoked_at),
          },
        };

        return AdminWorkspaceDetailDtoSchema.parse(detailPayload);
      });
    } finally {
      client.release();
    }
  }

  /**
   * Super Admin Emergency Destroy Kill-Switch (AD-019, BR-22, BR-23).
   * Atomically destroys workspace, revokes assignment write capability, records activity event, and writes immutable audit log.
   */
  async destroyWorkspace(
    id: string,
    dto: EmergencyDestroyWorkspaceDto,
    actor: UserContext,
    meta: RequestMeta,
  ): Promise<EmergencyDestroyResponseDto> {
    const client = await this.pool.connect();
    try {
      return await withPlatform(client, async (tx) => {
        // 1. Fetch workspace to identify tenant and associated assignment
        const checkSql = `
          SELECT id, org_id, assignment_id, mode, status, snapshot_ref, runtime_ref
          FROM app.workspaces
          WHERE id = $1
        `;
        const checkRes = await tx.query(checkSql, [id]);
        const existing = checkRes.rows[0];

        if (!existing) {
          throw problem({
            title: 'Not Found',
            status: 404,
            detail: `Workspace with id "${id}" was not found`,
            code: 'WORKSPACE_NOT_FOUND',
          });
        }

        // 2. Standardized lock acquisition order: lock assignment row first (BR-22, concurrency hierarchy)
        const assignLockRes = await tx.query(
          `SELECT id, status, write_revoked_at
           FROM app.assignments
           WHERE id = $1 AND org_id = $2
           FOR UPDATE`,
          [existing.assignment_id, existing.org_id],
        );

        if (!assignLockRes.rowCount || assignLockRes.rowCount === 0) {
          throw problem({
            title: 'Internal Server Error',
            status: 500,
            detail: `Failed to revoke assignment "${existing.assignment_id}" for workspace "${id}": assignment not found in organization`,
            code: 'ASSIGNMENT_REVOCATION_FAILED',
          });
        }

        // 3. Lock workspace row second and re-verify lifecycle state
        const wsLockRes = await tx.query(
          `SELECT id, org_id, assignment_id, mode, status, snapshot_ref, runtime_ref
           FROM app.workspaces
           WHERE id = $1
           FOR UPDATE`,
          [id],
        );
        const lockedWs = wsLockRes.rows[0];

        if (!lockedWs || lockedWs.status === 'destroyed' || lockedWs.status === 'ended') {
          throw problem({
            title: 'Conflict',
            status: 409,
            detail: `Cannot destroy workspace: workspace is already in terminal state "${lockedWs?.status ?? 'unknown'}"`,
            code: 'WORKSPACE_ALREADY_TERMINATED',
          });
        }

        const now = new Date();
        const nowIso = now.toISOString();

        // 4. Atomically transition workspace to 'destroyed' and invalidate write token
        await tx.query(
          `UPDATE app.workspaces
              SET status = 'destroyed',
                  ended_at = $2,
                  write_token_hash = NULL,
                  updated_at = $2
            WHERE id = $1`,
          [id, nowIso],
        );

        // 5. Revoke assignment write capability and set status to 'revoked' with strict row count verification
        const assignRes = await tx.query(
          `UPDATE app.assignments
              SET write_revoked_at = $3,
                  status = 'revoked',
                  updated_at = $3
            WHERE id = $1 AND org_id = $2`,
          [existing.assignment_id, existing.org_id, nowIso],
        );

        if (!assignRes.rowCount || assignRes.rowCount !== 1) {
          throw problem({
            title: 'Internal Server Error',
            status: 500,
            detail: `Failed to revoke assignment "${existing.assignment_id}" for workspace "${id}": expected 1 row affected, got ${assignRes.rowCount ?? 0}`,
            code: 'ASSIGNMENT_REVOCATION_FAILED',
          });
        }

        // 6. Record activity event in app.activity_events
        await tx.query(
          `INSERT INTO app.activity_events (
             org_id, assignment_id, workspace_id, type, payload, ip, at
           ) VALUES ($1, $2, $3, 'disconnect', $4::jsonb, $5::inet, $6)`,
          [
            existing.org_id,
            existing.assignment_id,
            id,
            JSON.stringify({
              destroyed: true,
              emergency: true,
              reason: dto.reason,
              destroyedByRole: actor.role,
              destroyedByActorId: actor.userId,
            }),
            asInet(meta.ip),
            nowIso,
          ],
        );

        // 7. Append immutable audit event in audit.events (SHA-256 hash chained, same transaction)
        await appendAuditEvent(tx, {
          actorId: actor.userId,
          actorRole: actor.role,
          orgId: existing.org_id,
          action: 'workspace.emergency_destroyed',
          entity: 'workspace',
          entityId: id,
          before: {
            status: existing.status,
            runtimeRef: existing.runtime_ref,
            snapshotRef: existing.snapshot_ref,
          },
          after: {
            status: 'destroyed',
            reason: dto.reason,
            assignmentRevoked: true,
            endedAt: nowIso,
          },
          ip: meta.ip,
          userAgent: meta.userAgent,
          requestId: meta.requestId,
        });

        this.logger.warn(
          `[KILL-SWITCH] Workspace ${id} (org: ${existing.org_id}) emergency destroyed by ${actor.userId} (${actor.role}). Reason: ${dto.reason}`,
        );

        const response: EmergencyDestroyResponseDto = {
          success: true,
          workspaceId: id,
          status: 'destroyed',
          destroyedAt: nowIso,
          assignmentRevoked: true,
          reason: dto.reason,
          limitations: {
            runtimeTerminated: false,
            snapshotSaved: Boolean(existing.snapshot_ref),
            candidateNotified: false,
            notice:
              'Database status updated and assignment write capability revoked. Hypervisor container termination and push notifications are not connected in MMP; candidate session will disconnect on next ping.',
          },
        };

        return EmergencyDestroyResponseDtoSchema.parse(response);
      });
    } finally {
      client.release();
    }
  }
}

