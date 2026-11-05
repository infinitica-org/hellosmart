import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';

export interface SubmissionSnapshot {
  id: string;
  assignmentId: string;
  autoSubmitted: boolean;
  submittedAt: string;
  created: boolean;
}

/**
 * Persists the candidate's latest artifacts and draft answers.
 * The conditional assignment update is the race boundary with the auto-submit worker:
 * exactly one of manual submit or the worker observes a row still in progress.
 */
@Injectable()
export class SubmissionsService {
  async finalize(params: {
    tx: PoolClient;
    orgId: string;
    assignmentId: string;
    autoSubmitted: boolean;
    now: Date;
  }): Promise<SubmissionSnapshot | null> {
    const updated = await params.tx.query<{
      id: string;
      artifacts_ref: string | null;
      draft_answers: unknown;
    }>(
      `UPDATE app.assignments
          SET status = 'submitted',
              submitted_at = $3,
              auto_submitted = $4,
              write_revoked_at = $3
        WHERE id = $1
          AND org_id = $2
          AND status IN ('in_progress', 'disconnected')
        RETURNING id, artifacts_ref, draft_answers`,
      [params.assignmentId, params.orgId, params.now.toISOString(), params.autoSubmitted],
    );

    if (updated.rowCount === 0) {
      return null;
    }

    const row = updated.rows[0]!;
    const snapshot = await params.tx.query<{ snapshot_ref: string | null }>(
      `UPDATE app.workspaces
          SET status = 'ended',
              ended_at = $3,
              snapshot_ref = COALESCE(snapshot_ref, $4),
              write_token_hash = NULL
        WHERE org_id = $2 AND assignment_id = $1
        RETURNING snapshot_ref`,
      [params.assignmentId, params.orgId, params.now.toISOString(), row.artifacts_ref],
    );

    const inserted = await params.tx.query<{ id: string; submitted_at: Date }>(
      `INSERT INTO app.submissions (
         org_id, assignment_id, artifacts_ref, text_answers, final_snapshot_ref,
         submitted_at, auto_submitted, results_released
       ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, false)
       ON CONFLICT (org_id, assignment_id) DO NOTHING
       RETURNING id, submitted_at`,
      [
        params.orgId,
        params.assignmentId,
        row.artifacts_ref,
        JSON.stringify(row.draft_answers ?? {}),
        snapshot.rows[0]?.snapshot_ref ?? row.artifacts_ref,
        params.now.toISOString(),
        params.autoSubmitted,
      ],
    );

    const existing =
      inserted.rows[0] ??
      (
        await params.tx.query<{ id: string; submitted_at: Date }>(
          `SELECT id, submitted_at FROM app.submissions WHERE org_id = $1 AND assignment_id = $2`,
          [params.orgId, params.assignmentId],
        )
      ).rows[0];

    return {
      id: existing?.id ?? params.assignmentId,
      assignmentId: params.assignmentId,
      autoSubmitted: params.autoSubmitted,
      submittedAt: (existing?.submitted_at ?? params.now).toISOString(),
      created: inserted.rowCount === 1,
    };
  }
}
