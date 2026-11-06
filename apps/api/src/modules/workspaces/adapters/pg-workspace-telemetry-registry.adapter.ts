import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { PG_POOL, type PgPool } from '../../database/database.tokens.js';
import { withPlatform } from '../../tenancy/with-org.js';
import type { WorkspaceTelemetryRegistryPort } from '../ports/workspace-telemetry-registry.port.js';
import type {
  UsageAggregateSummary,
  UsageQueryFilter,
  WorkspaceSessionMetadata,
  WorkspaceUsageInsertParams,
  WorkspaceUsageRecord,
} from '../workspace-telemetry.types.js';

interface RawUsageRow {
  id: string;
  workspace_id: string;
  org_id: string;
  assignment_id: string;
  assessment_id: string;
  candidate_id: string;
  compute_seconds: string;
  compute_minutes: number;
  storage_mb: number | null;
  prompt_tokens: string;
  completion_tokens: string;
  total_cost_usd: string;
  breakdown: any;
  pricing_version: string;
  status: string;
  flags: string[];
  started_at: Date | string;
  ended_at: Date | string;
  created_at: Date | string;
}

function mapRawUsage(row: RawUsageRow): WorkspaceUsageRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    orgId: row.org_id,
    assignmentId: row.assignment_id,
    assessmentId: row.assessment_id,
    candidateId: row.candidate_id,
    computeSeconds: BigInt(row.compute_seconds),
    computeMinutes: row.compute_minutes,
    storageMb: row.storage_mb,
    promptTokens: BigInt(row.prompt_tokens),
    completionTokens: BigInt(row.completion_tokens),
    totalCostUsd: row.total_cost_usd,
    breakdown: Array.isArray(row.breakdown) ? row.breakdown : [],
    pricingVersion: row.pricing_version,
    status: row.status as any,
    flags: (row.flags || []) as any,
    startedAt: new Date(row.started_at),
    endedAt: new Date(row.ended_at),
    createdAt: new Date(row.created_at),
  };
}

@Injectable()
export class PgWorkspaceTelemetryRegistryAdapter implements WorkspaceTelemetryRegistryPort {
  private readonly logger = new Logger(PgWorkspaceTelemetryRegistryAdapter.name);

  constructor(@Inject(PG_POOL) private readonly pool: PgPool) {}

  async getWorkspaceSession(workspaceId: string): Promise<WorkspaceSessionMetadata | null> {
    const client = await this.pool.connect();
    try {
      return await withPlatform(client, async (tx: PoolClient) => {
        const res = await tx.query<{
          workspace_id: string;
          org_id: string;
          assignment_id: string;
          assessment_id: string;
          candidate_id: string;
          status: string;
          started_at: Date | string;
          ended_at: Date | string | null;
        }>(
          `SELECT w.id AS workspace_id,
                  w.org_id,
                  w.assignment_id,
                  a.assessment_id,
                  w.candidate_id,
                  w.status,
                  w.started_at,
                  w.ended_at
             FROM app.workspaces w
             JOIN app.assignments a ON w.org_id = a.org_id AND w.assignment_id = a.id
            WHERE w.id = $1`,
          [workspaceId],
        );

        if (res.rowCount === 0) {
          return null;
        }
        const row = res.rows[0]!;
        return {
          workspaceId: row.workspace_id,
          orgId: row.org_id,
          assignmentId: row.assignment_id,
          assessmentId: row.assessment_id,
          candidateId: row.candidate_id,
          status: row.status,
          startedAt: new Date(row.started_at),
          endedAt: row.ended_at ? new Date(row.ended_at) : null,
        };
      });
    } finally {
      client.release();
    }
  }

  async insertUsage(usage: WorkspaceUsageInsertParams): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      return await withPlatform(client, async (tx: PoolClient) => {
        const res = await tx.query(
          `INSERT INTO app.workspace_usage (
             workspace_id,
             org_id,
             assignment_id,
             assessment_id,
             candidate_id,
             compute_seconds,
             compute_minutes,
             storage_mb,
             prompt_tokens,
             completion_tokens,
             total_cost_usd,
             breakdown,
             pricing_version,
             status,
             flags,
             started_at,
             ended_at
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
           )
           ON CONFLICT (workspace_id) DO NOTHING
           RETURNING id`,
          [
            usage.workspaceId,
            usage.orgId,
            usage.assignmentId,
            usage.assessmentId,
            usage.candidateId,
            usage.computeSeconds.toString(),
            usage.computeMinutes,
            usage.storageMb,
            usage.promptTokens.toString(),
            usage.completionTokens.toString(),
            usage.totalCostUsd,
            JSON.stringify(usage.breakdown),
            usage.pricingVersion,
            usage.status,
            usage.flags,
            usage.startedAt.toISOString(),
            usage.endedAt.toISOString(),
          ],
        );

        return (res.rowCount ?? 0) > 0;
      });
    } finally {
      client.release();
    }
  }

  async getUsageByWorkspace(workspaceId: string): Promise<WorkspaceUsageRecord | null> {
    const client = await this.pool.connect();
    try {
      return await withPlatform(client, async (tx: PoolClient) => {
        const res = await tx.query<RawUsageRow>(
          `SELECT id, workspace_id, org_id, assignment_id, assessment_id, candidate_id,
                  compute_seconds, compute_minutes, storage_mb, prompt_tokens, completion_tokens,
                  total_cost_usd, breakdown, pricing_version, status, flags,
                  started_at, ended_at, created_at
             FROM app.workspace_usage
            WHERE workspace_id = $1`,
          [workspaceId],
        );
        if (res.rowCount === 0) {
          return null;
        }
        return mapRawUsage(res.rows[0]!);
      });
    } finally {
      client.release();
    }
  }

  async listUsage(
    filter: UsageQueryFilter,
  ): Promise<{ items: WorkspaceUsageRecord[]; total: number }> {
    const client = await this.pool.connect();
    try {
      return await withPlatform(client, async (tx: PoolClient) => {
        const conditions: string[] = [];
        const params: any[] = [];
        let idx = 1;

        if (filter.orgId) {
          conditions.push(`org_id = $${idx++}`);
          params.push(filter.orgId);
        }
        if (filter.assessmentId) {
          conditions.push(`assessment_id = $${idx++}`);
          params.push(filter.assessmentId);
        }
        if (filter.candidateId) {
          conditions.push(`candidate_id = $${idx++}`);
          params.push(filter.candidateId);
        }
        if (filter.fromDate) {
          conditions.push(`started_at >= $${idx++}`);
          params.push(filter.fromDate.toISOString());
        }
        if (filter.toDate) {
          conditions.push(`ended_at <= $${idx++}`);
          params.push(filter.toDate.toISOString());
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const countRes = await tx.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM app.workspace_usage ${whereClause}`,
          params,
        );
        const total = parseInt(countRes.rows[0]?.count || '0', 10);

        const limit = filter.limit ?? 50;
        const offset = filter.offset ?? 0;

        const dataParams = [...params, limit, offset];
        const dataRes = await tx.query<RawUsageRow>(
          `SELECT id, workspace_id, org_id, assignment_id, assessment_id, candidate_id,
                  compute_seconds, compute_minutes, storage_mb, prompt_tokens, completion_tokens,
                  total_cost_usd, breakdown, pricing_version, status, flags,
                  started_at, ended_at, created_at
             FROM app.workspace_usage
             ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${idx++} OFFSET $${idx++}`,
          dataParams,
        );

        return {
          items: dataRes.rows.map(mapRawUsage),
          total,
        };
      });
    } finally {
      client.release();
    }
  }

  async getSpendTotals(filter: UsageQueryFilter): Promise<UsageAggregateSummary> {
    const client = await this.pool.connect();
    try {
      return await withPlatform(client, async (tx: PoolClient) => {
        const conditions: string[] = [];
        const params: any[] = [];
        let idx = 1;

        if (filter.orgId) {
          conditions.push(`org_id = $${idx++}`);
          params.push(filter.orgId);
        }
        if (filter.assessmentId) {
          conditions.push(`assessment_id = $${idx++}`);
          params.push(filter.assessmentId);
        }
        if (filter.candidateId) {
          conditions.push(`candidate_id = $${idx++}`);
          params.push(filter.candidateId);
        }
        if (filter.fromDate) {
          conditions.push(`started_at >= $${idx++}`);
          params.push(filter.fromDate.toISOString());
        }
        if (filter.toDate) {
          conditions.push(`ended_at <= $${idx++}`);
          params.push(filter.toDate.toISOString());
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const res = await tx.query<{
          total_sessions: number;
          total_compute_seconds: string;
          total_compute_minutes: number;
          total_prompt_tokens: string;
          total_completion_tokens: string;
          total_cost_usd: string;
        }>(
          `SELECT COUNT(*)::int AS total_sessions,
                  COALESCE(SUM(compute_seconds), 0)::text AS total_compute_seconds,
                  COALESCE(SUM(compute_minutes), 0)::int AS total_compute_minutes,
                  COALESCE(SUM(prompt_tokens), 0)::text AS total_prompt_tokens,
                  COALESCE(SUM(completion_tokens), 0)::text AS total_completion_tokens,
                  COALESCE(SUM(total_cost_usd), 0)::numeric(14,6)::text AS total_cost_usd
             FROM app.workspace_usage
             ${whereClause}`,
          params,
        );

        const row = res.rows[0]!;
        return {
          totalSessions: row.total_sessions || 0,
          totalComputeSeconds: BigInt(row.total_compute_seconds || '0'),
          totalComputeMinutes: row.total_compute_minutes || 0,
          totalPromptTokens: BigInt(row.total_prompt_tokens || '0'),
          totalCompletionTokens: BigInt(row.total_completion_tokens || '0'),
          totalCostUsd: row.total_cost_usd || '0.000000',
        };
      });
    } finally {
      client.release();
    }
  }

  async listCompletedWithoutUsage(limit: number): Promise<string[]> {
    const client = await this.pool.connect();
    try {
      return await withPlatform(client, async (tx: PoolClient) => {
        const res = await tx.query<{ id: string }>(
          `SELECT w.id
             FROM app.workspaces w
            WHERE w.status IN ('ended', 'destroyed')
              AND w.ended_at IS NOT NULL
              AND NOT EXISTS (
                SELECT 1 FROM app.workspace_usage u WHERE u.workspace_id = w.id
              )
            ORDER BY w.ended_at ASC
            LIMIT $1`,
          [limit],
        );
        return res.rows.map((r) => r.id);
      });
    } finally {
      client.release();
    }
  }
}
