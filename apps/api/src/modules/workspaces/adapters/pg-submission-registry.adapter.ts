import { Inject, Injectable } from '@nestjs/common';
import { PG_PLATFORM_POOL, PG_POOL, type PgPool } from '../../database/database.tokens.js';
import { withPlatform } from '../../tenancy/with-org.js';
import type { SubmissionRegistryPort } from '../ports/submission-registry.port.js';
import type { SubmissionContext, UnbundledAssignment } from '../submission-bundler.types.js';

interface WorkspaceContextRow {
  workspace_id: string;
  org_id: string;
  assignment_id: string;
  candidate_id: string;
  assignment_status: string;
  artifacts_ref: string | null;
  template_version_id: string | null;
  template_repo_ref: string | null;
  template_seed_ref: string | null;
}

interface UnbundledRow {
  assignment_id: string;
  workspace_id: string;
  org_id: string;
  candidate_id: string;
  submitted_at: Date;
}

@Injectable()
export class PgSubmissionRegistryAdapter implements SubmissionRegistryPort {
  constructor(
    @Inject(PG_POOL) private readonly appPool: PgPool,
    @Inject(PG_PLATFORM_POOL) private readonly platformPool: PgPool,
  ) {}

  async getWorkspaceSubmissionContext(workspaceId: string): Promise<SubmissionContext | null> {
    const client = await this.platformPool.connect();
    try {
      return await withPlatform(client, async (tx) => {
        const res = await tx.query<WorkspaceContextRow>(
          `SELECT w.id AS workspace_id,
                  w.org_id,
                  w.assignment_id,
                  w.candidate_id,
                  a.status AS assignment_status,
                  a.artifacts_ref,
                  s.template_version_id,
                  tv.manifest->>'repo_ref' AS template_repo_ref,
                  tv.manifest->>'seed_ref' AS template_seed_ref
             FROM app.workspaces w
             JOIN app.assignments a ON a.id = w.assignment_id AND a.org_id = w.org_id
             JOIN app.assessments s ON s.id = a.assessment_id AND s.org_id = w.org_id
        LEFT JOIN app.template_versions tv ON tv.id = s.template_version_id
            WHERE w.id = $1`,
          [workspaceId],
        );

        if (res.rowCount === 0 || !res.rows[0]) {
          return null;
        }

        const row = res.rows[0];
        const templateRef =
          row.template_repo_ref ||
          row.template_seed_ref ||
          row.template_version_id ||
          'template_base';

        return {
          workspaceId: row.workspace_id,
          orgId: row.org_id,
          assignmentId: row.assignment_id,
          candidateId: row.candidate_id,
          templateVersionId: row.template_version_id,
          templateRef,
          assignmentStatus: row.assignment_status,
          artifactsRef: row.artifacts_ref,
        };
      });
    } finally {
      client.release();
    }
  }

  /**
   * Scoped set-once write of artifacts_ref (Step 2).
   *
   * Note on tenancy execution context:
   * Although tenant-scoped database queries ideally run under `withOrg`, background system workers
   * (e.g. bundler sweeper, worker queues) have no authenticated user session. Under `withOrg`,
   * `app.current_user_role()` and `app.current_user_id()` evaluate to NULL. The `assignment_update` RLS
   * policy (0014) requires `app.is_platform() OR (org_id = app.current_org_id() AND (app.current_user_role() = 'company_admin' OR ...))`.
   * While `tenant_isolation` is currently permissive (`FOR ALL USING (org_id = app.current_org_id())`),
   * system background jobs must execute via `withPlatform` to guarantee execution resilience against future
   * tightening of tenant policies, while strictly enforcing org_id scoping in the WHERE clause.
   */
  async recordArtifactsRef(
    orgId: string,
    assignmentId: string,
    artifactsRef: string,
  ): Promise<void> {
    const client = await this.platformPool.connect();
    try {
      await withPlatform(client, async (tx) => {
        const updateRes = await tx.query(
          `UPDATE app.assignments
              SET artifacts_ref = $1
            WHERE id = $2
              AND org_id = $3
              AND status = 'submitted'
              AND artifacts_ref IS NULL`,
          [artifactsRef, assignmentId, orgId],
        );

        if (updateRes.rowCount === 0) {
          // Idempotency check: check if it was already set to the same key or if the target is invalid
          const checkRes = await tx.query<{
            status: string;
            artifacts_ref: string | null;
          }>(
            `SELECT status, artifacts_ref
               FROM app.assignments
              WHERE id = $1 AND org_id = $2`,
            [assignmentId, orgId],
          );

          if (checkRes.rowCount === 0) {
            throw new Error(`Assignment not found for org=${orgId} assignment=${assignmentId}`);
          }

          const existing = checkRes.rows[0]!;
          if (existing.artifacts_ref === artifactsRef) {
            // Idempotent success: artifacts_ref was already recorded with the same key
            return;
          }

          if (existing.artifacts_ref !== null) {
            throw new Error(
              `Cannot overwrite existing artifacts_ref '${existing.artifacts_ref}' with '${artifactsRef}' for assignment=${assignmentId} (Migration 0014 set-once invariant)`,
            );
          }

          if (existing.status !== 'submitted') {
            throw new Error(
              `Cannot record artifacts_ref for assignment=${assignmentId} in status '${existing.status}' (must be 'submitted')`,
            );
          }
        }
      });
    } finally {
      client.release();
    }
  }

  async listUnbundledSubmissions(limit: number): Promise<UnbundledAssignment[]> {
    const client = await this.platformPool.connect();
    try {
      return await withPlatform(client, async (tx) => {
        const res = await tx.query<UnbundledRow>(
          `SELECT a.id AS assignment_id,
                  w.id AS workspace_id,
                  a.org_id,
                  a.candidate_id,
                  a.submitted_at
             FROM app.assignments a
             JOIN app.workspaces w ON w.assignment_id = a.id AND w.org_id = a.org_id
            WHERE a.status = 'submitted'
              AND a.artifacts_ref IS NULL
            ORDER BY a.submitted_at ASC
            LIMIT $1`,
          [limit],
        );

        return res.rows.map((r) => ({
          assignmentId: r.assignment_id,
          workspaceId: r.workspace_id,
          orgId: r.org_id,
          candidateId: r.candidate_id,
          submittedAt: r.submitted_at,
        }));
      });
    } finally {
      client.release();
    }
  }
}
