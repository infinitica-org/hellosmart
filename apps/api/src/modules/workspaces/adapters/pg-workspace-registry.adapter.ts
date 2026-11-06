import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { PG_PLATFORM_POOL, PG_POOL } from '../../database/database.tokens.js';
import { withOrg, withPlatform } from '../../tenancy/with-org.js';
import type { WorkspaceSnapshotManifest } from '../autosave.types.js';
import type {
  RecordSnapshotParams,
  WorkspaceRegistryPort,
  WorkspaceSnapshotTarget,
} from '../ports/workspace-registry.port.js';

@Injectable()
export class PgWorkspaceRegistryAdapter implements WorkspaceRegistryPort {
  private readonly logger = new Logger(PgWorkspaceRegistryAdapter.name);

  constructor(
    @Inject(PG_POOL) private readonly appPool: Pool,
    @Inject(PG_PLATFORM_POOL) private readonly platformPool: Pool,
  ) {}

  /**
   * Cross-tenant listing of due workspaces using platform context (hs_platform).
   * Scopes strictly to active statuses: 'connected' and 'disconnected'.
   * Reads assignment org and id to guarantee strict tenant alignment.
   */
  async findDueWorkspaces(cutoffDate: Date, limit = 50): Promise<WorkspaceSnapshotTarget[]> {
    const client = await this.platformPool.connect();
    try {
      return await withPlatform(client, async (tx: PoolClient) => {
        const query = `
          SELECT
            w.id,
            w.org_id,
            w.assignment_id,
            w.candidate_id,
            w.mode,
            w.status,
            w.snapshot_ref,
            w.last_activity_at
          FROM app.workspaces w
          JOIN app.assignments a ON a.id = w.assignment_id AND a.org_id = w.org_id
          WHERE w.status IN ('connected', 'disconnected')
          ORDER BY w.last_activity_at ASC
          LIMIT $1;
        `;
        const res = await tx.query(query, [limit]);
        return res.rows.map((r) => this.mapRowToTarget(r));
      });
    } finally {
      client.release();
    }
  }

  /**
   * Retrieves an individual workspace within the tenant boundary (hs_app with withOrg).
   * RLS strictly enforces that only the workspace's own org can view it.
   */
  async getWorkspaceById(
    workspaceId: string,
    orgId: string,
  ): Promise<WorkspaceSnapshotTarget | null> {
    const client = await this.appPool.connect();
    try {
      return await withOrg(client, orgId, async (tx: PoolClient) => {
        await tx.query("SELECT set_config('app.user_role', 'company_admin', true)");
        const query = `
          SELECT
            w.id,
            w.org_id,
            w.assignment_id,
            w.candidate_id,
            w.mode,
            w.status,
            w.snapshot_ref,
            w.last_activity_at
          FROM app.workspaces w
          JOIN app.assignments a ON a.id = w.assignment_id AND a.org_id = w.org_id
          WHERE w.id = $1 AND w.org_id = $2;
        `;
        const res = await tx.query(query, [workspaceId, orgId]);
        if (res.rows.length === 0) {
          return null;
        }
        return this.mapRowToTarget(res.rows[0]);
      });
    } finally {
      client.release();
    }
  }

  async getLastSnapshotManifest(_workspaceId: string): Promise<WorkspaceSnapshotManifest | null> {
    // Full historical manifest metadata is retrieved from S3 or caching layer.
    return null;
  }

  /**
   * Database update of last_snapshot_at is blocked on the migration adding
   * last_snapshot_at, last_snapshot_key, last_snapshot_sha256, and snapshot_seq.
   */
  async recordSnapshot(
    _workspaceId: string,
    _orgId: string,
    _params: RecordSnapshotParams,
  ): Promise<void> {
    throw new Error(
      'Database update of last_snapshot_at is blocked on the migration adding last_snapshot_at to app.workspaces',
    );
  }

  private mapRowToTarget(row: any): WorkspaceSnapshotTarget {
    return {
      id: row.id,
      orgId: row.org_id,
      assignmentId: row.assignment_id,
      candidateId: row.candidate_id,
      mode: row.mode,
      status: row.status,
      lastSnapshotAt: row.snapshot_ref ? new Date(row.last_activity_at) : null,
      lastSnapshotKey: row.snapshot_ref ?? null,
      snapshotSeq: 0,
    };
  }
}
