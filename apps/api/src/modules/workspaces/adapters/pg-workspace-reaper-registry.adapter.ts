import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { PG_PLATFORM_POOL, PG_POOL, type PgPool } from '../../database/database.tokens.js';
import { withOrg, withPlatform } from '../../tenancy/with-org.js';
import type { WorkspaceReaperRegistryPort } from '../ports/workspace-reaper-registry.port.js';
import type { ClaimedWorkspace, ReapCandidate } from '../workspace-reaper.types.js';

interface RawCandidateRow {
  workspace_id: string;
  org_id: string;
  assignment_id: string;
  candidate_id: string;
  workspace_status: string;
  started_at: Date;
  last_activity_at: Date;
  ended_at: Date | null;
  snapshot_ref: string | null;
  runtime_ref: string | null;
  assignment_status: string;
  deadline_at: Date | null;
  extended_minutes: number;
  submitted_at: Date | null;
  auto_submitted: boolean;
  artifacts_ref: string | null;
  candidate_deleted_at: Date | null;
}

@Injectable()
export class PgWorkspaceReaperRegistryAdapter implements WorkspaceReaperRegistryPort {
  private readonly logger = new Logger(PgWorkspaceReaperRegistryAdapter.name);

  constructor(
    @Inject(PG_POOL) private readonly appPool: PgPool,
    @Inject(PG_PLATFORM_POOL) private readonly platformPool: PgPool,
  ) {}

  async findReapCandidates(options: {
    now: Date;
    disconnectedCutoff: Date;
    idleCutoff: Date;
    idleEnabled: boolean;
    limit: number;
  }): Promise<ReapCandidate[]> {
    const client = await this.platformPool.connect();
    try {
      return await withPlatform(client, async (tx: PoolClient) => {
        const result = await tx.query<RawCandidateRow>(
          `SELECT
             w.id AS workspace_id,
             w.org_id,
             w.assignment_id,
             w.candidate_id,
             w.status AS workspace_status,
             w.started_at,
             w.last_activity_at,
             w.ended_at,
             w.snapshot_ref,
             w.runtime_ref,
             a.status AS assignment_status,
             a.deadline_at,
             a.extended_minutes,
             a.submitted_at,
             a.auto_submitted,
             a.artifacts_ref,
             u.deleted_at AS candidate_deleted_at
           FROM app.workspaces w
           JOIN app.assignments a ON a.id = w.assignment_id AND a.org_id = w.org_id
           JOIN app.users u ON u.id = w.candidate_id AND u.org_id = w.org_id
           WHERE w.status IN ('connected', 'disconnected', 'ended')
             AND (
               -- 1. Disconnected beyond timeout threshold
               (w.status = 'disconnected' AND w.last_activity_at <= $1)
               -- 2. Idle connected beyond threshold (if enabled)
               OR ($2::boolean = true AND w.status = 'connected' AND w.last_activity_at <= $3)
               -- 3. Assessment deadline expired
               OR (a.deadline_at IS NOT NULL AND a.deadline_at <= $4)
               -- 4. Assignment concluded or orphaned
               OR (a.status IN ('submitted', 'expired', 'revoked'))
               -- 5. Candidate soft-deleted
               OR (u.deleted_at IS NOT NULL)
               -- 6. Stale claimed session abandoned mid-teardown
               OR (w.status = 'ended' AND w.ended_at IS NOT NULL AND w.ended_at <= $1)
             )
           ORDER BY w.last_activity_at ASC
           LIMIT $5`,
          [
            options.disconnectedCutoff.toISOString(),
            options.idleEnabled,
            options.idleCutoff.toISOString(),
            options.now.toISOString(),
            options.limit,
          ],
        );

        return result.rows.map((row) => ({
          workspaceId: row.workspace_id,
          orgId: row.org_id,
          assignmentId: row.assignment_id,
          candidateId: row.candidate_id,
          workspaceStatus: row.workspace_status,
          startedAt: new Date(row.started_at),
          lastActivityAt: new Date(row.last_activity_at),
          endedAt: row.ended_at ? new Date(row.ended_at) : null,
          snapshotRef: row.snapshot_ref,
          runtimeRef: row.runtime_ref,
          assignmentStatus: row.assignment_status,
          deadlineAt: row.deadline_at ? new Date(row.deadline_at) : null,
          extendedMinutes: row.extended_minutes ?? 0,
          submittedAt: row.submitted_at ? new Date(row.submitted_at) : null,
          autoSubmitted: row.auto_submitted ?? false,
          artifactsRef: row.artifacts_ref,
          candidateDeletedAt: row.candidate_deleted_at ? new Date(row.candidate_deleted_at) : null,
        }));
      });
    } finally {
      client.release();
    }
  }

  async countActiveWorkspaces(): Promise<number> {
    const client = await this.platformPool.connect();
    try {
      return await withPlatform(client, async (tx: PoolClient) => {
        const res = await tx.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count
             FROM app.workspaces
            WHERE status IN ('provisioning', 'connected', 'disconnected', 'ended')`,
        );
        return parseInt(res.rows[0]?.count ?? '0', 10);
      });
    } finally {
      client.release();
    }
  }

  async claimWorkspace(params: {
    workspaceId: string;
    orgId: string;
    expectedStatus: string;
    expectedLastActivityAt: Date;
    now: Date;
  }): Promise<ClaimedWorkspace | null> {
    const client = await this.appPool.connect();
    try {
      return await withOrg(client, params.orgId, async (tx: PoolClient) => {
        const res = await tx.query<{
          id: string;
          org_id: string;
          assignment_id: string;
          candidate_id: string;
          status: string;
          ended_at: Date;
          snapshot_ref: string | null;
          runtime_ref: string | null;
        }>(
          `UPDATE app.workspaces
              SET status = 'ended',
                  ended_at = $1,
                  updated_at = $1
            WHERE id = $2
              AND org_id = $3
              AND status = $4
              AND last_activity_at = $5
            RETURNING id, org_id, assignment_id, candidate_id, status, ended_at, snapshot_ref, runtime_ref`,
          [
            params.now.toISOString(),
            params.workspaceId,
            params.orgId,
            params.expectedStatus,
            params.expectedLastActivityAt.toISOString(),
          ],
        );

        if (res.rowCount === 0) {
          return null;
        }

        const row = res.rows[0]!;
        return {
          workspaceId: row.id,
          orgId: row.org_id,
          assignmentId: row.assignment_id,
          candidateId: row.candidate_id,
          status: row.status,
          endedAt: new Date(row.ended_at),
          snapshotRef: row.snapshot_ref,
          runtimeRef: row.runtime_ref,
        };
      });
    } finally {
      client.release();
    }
  }

  async markDestroyed(params: {
    workspaceId: string;
    orgId: string;
    snapshotRef: string;
    endedAt: Date;
  }): Promise<void> {
    const client = await this.appPool.connect();
    try {
      await withOrg(client, params.orgId, async (tx: PoolClient) => {
        const res = await tx.query(
          `UPDATE app.workspaces
              SET status = 'destroyed',
                  ended_at = $1,
                  snapshot_ref = $2,
                  updated_at = $1
            WHERE id = $3 AND org_id = $4`,
          [params.endedAt.toISOString(), params.snapshotRef, params.workspaceId, params.orgId],
        );
        if (res.rowCount === 0) {
          this.logger.warn(
            `Workspace ${params.workspaceId} not found in org ${params.orgId} when marking destroyed`,
          );
        }
      });
    } finally {
      client.release();
    }
  }

  async releaseClaim(params: {
    workspaceId: string;
    orgId: string;
    originalStatus: string;
    originalEndedAt: Date | null;
  }): Promise<void> {
    const client = await this.appPool.connect();
    try {
      await withOrg(client, params.orgId, async (tx: PoolClient) => {
        await tx.query(
          `UPDATE app.workspaces
              SET status = $1,
                  ended_at = $2,
                  updated_at = now()
            WHERE id = $3 AND org_id = $4 AND status = 'ended'`,
          [
            params.originalStatus,
            params.originalEndedAt ? params.originalEndedAt.toISOString() : null,
            params.workspaceId,
            params.orgId,
          ],
        );
      });
    } finally {
      client.release();
    }
  }
}
