import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { PG_PLATFORM_POOL, PG_POOL, type PgPool } from '../database/database.tokens.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { EmailService } from '../emails/email.service.js';
import { SessionService } from '../session/session.service.js';
import { SubmissionsService } from '../submissions/submissions.service.js';
import { withOrg, withPlatform } from '../tenancy/with-org.js';

export const AUTO_SUBMIT_ADVISORY_LOCK_ID = 8472938203;

export interface AutoSubmitReport {
  scanned: number;
  submitted: number;
  skipped: number;
  failures: number;
  skippedDueToLock: boolean;
}

interface DueAssignment {
  id: string;
  org_id: string;
  candidate_id: string;
  candidate_email: string | null;
  candidate_name: string | null;
  assessment_name: string | null;
  org_name: string | null;
}

@Injectable()
export class AutoSubmitWorker {
  private readonly logger = new Logger(AutoSubmitWorker.name);

  constructor(
    @Inject(PG_POOL) private readonly appPool: PgPool,
    @Inject(PG_PLATFORM_POOL) private readonly platformPool: PgPool,
    private readonly submissions: SubmissionsService,
    private readonly audit: AuditService,
    @Optional() private readonly sessions?: SessionService,
    @Optional() private readonly emails?: EmailService,
  ) {}

  /**
   * Submits assignments whose server deadline has passed.
   * referenceTime is injectable so tests can move the clock without changing PostgreSQL now().
   * SELECT FOR UPDATE SKIP LOCKED keeps two workers, and a manual submit, from double-finalizing.
   */
  async sweep(options?: { referenceTime?: Date; limit?: number; orgId?: string }): Promise<AutoSubmitReport> {
    const now = options?.referenceTime ?? new Date();
    const limit = options?.limit ?? 50;
    const lockClient = await this.platformPool.connect();
    let lockAcquired = false;

    try {
      const lock = await lockClient.query<{ acquired: boolean }>(
        'SELECT pg_try_advisory_lock($1) AS acquired',
        [AUTO_SUBMIT_ADVISORY_LOCK_ID],
      );
      lockAcquired = Boolean(lock.rows[0]?.acquired);
      if (!lockAcquired) {
        return { scanned: 0, submitted: 0, skipped: 0, failures: 0, skippedDueToLock: true };
      }

      const due = await withPlatform(lockClient, async (tx) => {
        const result = await tx.query<DueAssignment>(
          `SELECT a.id, a.org_id, a.candidate_id,
                  u.email AS candidate_email, u.name AS candidate_name,
                  s.name AS assessment_name, o.name AS org_name
             FROM app.assignments a
             JOIN app.users u ON u.id = a.candidate_id AND u.org_id = a.org_id
             JOIN app.assessments s ON s.id = a.assessment_id AND s.org_id = a.org_id
             JOIN app.organizations o ON o.id = a.org_id
            WHERE a.status IN ('in_progress', 'disconnected')
              AND a.deadline_at IS NOT NULL
              AND a.deadline_at <= $1
              AND ($2::uuid IS NULL OR a.org_id = $2::uuid)
            ORDER BY a.deadline_at
            LIMIT $3
            FOR UPDATE OF a SKIP LOCKED`,
          [now.toISOString(), options?.orgId ?? null, limit],
        );
        return result.rows;
      });

      let submitted = 0;
      let skipped = 0;
      let failures = 0;

      for (const row of due) {
        try {
          const didSubmit = await this.submitOne(row, now);
          if (didSubmit) submitted += 1;
          else skipped += 1;
        } catch (error: unknown) {
          failures += 1;
          const message = error instanceof Error ? error.message : 'auto-submit failed';
          this.logger.error(`auto-submit failed for assignment ${row.id}: ${message}`);
        }
      }

      return { scanned: due.length, submitted, skipped, failures, skippedDueToLock: false };
    } finally {
      if (lockAcquired) {
        await lockClient.query('SELECT pg_advisory_unlock($1)', [AUTO_SUBMIT_ADVISORY_LOCK_ID]);
      }
      lockClient.release();
    }
  }

  private async submitOne(row: DueAssignment, now: Date): Promise<boolean> {
    const client = await this.appPool.connect();
    let created = false;
    try {
      created = await withOrg(client, row.org_id, async (tx: PoolClient) => {
        const locked = await tx.query<{ id: string }>(
          `SELECT id FROM app.assignments
            WHERE id = $1
              AND org_id = $2
              AND status IN ('in_progress', 'disconnected')
              AND deadline_at <= $3
            FOR UPDATE SKIP LOCKED`,
          [row.id, row.org_id, now.toISOString()],
        );
        if (locked.rowCount === 0) {
          return false;
        }
        const snapshot = await this.submissions.finalize({
          tx,
          orgId: row.org_id,
          assignmentId: row.id,
          autoSubmitted: true,
          now,
        });
        if (!snapshot) {
          return false;
        }
        await this.audit.record(tx, {
          actorId: null,
          actorRole: 'system',
          orgId: row.org_id,
          action: 'assignment.auto_submitted',
          entity: 'assignment',
          entityId: row.id,
          after: { status: 'submitted', autoSubmitted: true },
        });
        if (this.emails && row.candidate_email) {
          await this.emails.enqueue(
            {
              orgId: row.org_id,
              to: row.candidate_email,
              template: 'submission-receipt',
              vars: {
                candidateName: row.candidate_name ?? 'there',
                companyName: row.org_name ?? 'HelloSmart',
                assessmentName: row.assessment_name ?? 'your assessment',
                actionUrl: '/candidate',
                expiresAtFormatted: now.toISOString(),
                durationMinutes: '',
              },
            },
            tx,
          );
        }
        return true;
      });
    } finally {
      client.release();
    }

    if (created && this.sessions) {
      try {
        await this.sessions.revokeAllSessionsForUser(row.candidate_id);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'session revoke failed';
        this.logger.warn(`write token revoke failed for assignment ${row.id}: ${message}`);
      }
    }
    return created;
  }
}
