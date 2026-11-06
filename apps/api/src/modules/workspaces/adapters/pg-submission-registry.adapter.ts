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
              SET artifacts_ref = $3
            WHERE id = $1 AND org_id = $2`,
          [assignmentId, orgId, artifactsRef],
        );
        if (updateRes.rowCount === 0) {
          throw new Error(
            `Assignment not found or update blocked for org=${orgId} assignment=${assignmentId}`,
          );
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
