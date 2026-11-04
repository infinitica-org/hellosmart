import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import type { ExtendAssignmentTimeDto, TimingStatus } from '@hs/contracts';
import { AuditService } from '../../common/audit/audit.service.js';
import { problem } from '../../common/errors/app-http.exception.js';
import type { UserContext } from '../../common/types/user-context.js';
import { PG_POOL } from '../database/database.tokens.js';
import { SubmissionsService } from '../submissions/submissions.service.js';
import { withOrg } from '../tenancy/with-org.js';
import {
  calculateEffectiveDeadline,
  evaluateWindow,
  parseTimingConfig,
  TimingService,
  windowForbidden,
  type TimingWindowConfig,
} from '../assessments/timing.service.js';
import { SessionActivityService, type ActivityEventType } from '../workspaces/session-activity.service.js';

interface AssignmentTimingRow {
  id: string;
  org_id: string;
  candidate_id: string;
  assessment_id: string;
  status: string;
  first_connect_at: Date | null;
  deadline_at: Date | null;
  extended_minutes: number;
  auto_submitted: boolean;
  timing: TimingWindowConfig;
  assessment_name: string;
  user_status: string;
  org_status: string;
  workspace_id: string | null;
  workspace_mode: string | null;
  disconnected_at: Date | null;
}

const ASSIGNMENT_SQL = `
  SELECT a.id, a.org_id, a.candidate_id, a.assessment_id, a.status,
         a.first_connect_at, a.deadline_at, a.extended_minutes, a.auto_submitted,
         s.timing, s.name AS assessment_name, s.workspace_mode,
         u.status AS user_status, o.status AS org_status,
         w.id AS workspace_id, w.disconnected_at
    FROM app.assignments a
    JOIN app.assessments s ON s.id = a.assessment_id AND s.org_id = a.org_id
    JOIN app.users u ON u.id = a.candidate_id AND u.org_id = a.org_id
    JOIN app.organizations o ON o.id = a.org_id
    LEFT JOIN app.workspaces w ON w.assignment_id = a.id AND w.org_id = a.org_id
   WHERE a.id = $1
`;

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly timing: TimingService,
    private readonly activity: SessionActivityService,
    private readonly submissions: SubmissionsService,
    private readonly audit: AuditService,
    @Optional() @Inject(PG_POOL) private readonly pool?: Pool,
  ) {}

  async getTiming(assignmentId: string, actor: UserContext, now = new Date()): Promise<TimingStatus> {
    return this.inOrg(actor, async (tx) => {
      const row = await this.loadForCandidate(tx, assignmentId, actor);
      const timing = parseTimingConfig(row.timing);
      return this.timing.status({
        timing,
        deadlineAt: row.deadline_at ? new Date(row.deadline_at) : null,
        now,
      }) as TimingStatus & { windowStatus: typeof decision.status };
    });
  }

  async connect(assignmentId: string, actor: UserContext, now = new Date()) {
    return this.inOrg(actor, async (tx) => {
      const row = await this.loadForCandidate(tx, assignmentId, actor);
      this.assertAccountActive(row);
      if (row.status === 'revoked') {
        throw problem({
          title: 'Forbidden',
          status: 403,
          detail: 'This assignment has been revoked.',
          code: 'ASSIGNMENT_REVOKED',
        });
      }
      if (row.status === 'submitted') {
        throw problem({
          title: 'Forbidden',
          status: 403,
          detail: 'This assignment has already been submitted.',
          code: 'ASSIGNMENT_SUBMITTED',
        });
      }

      const timing = parseTimingConfig(row.timing);
      const decision = evaluateWindow(timing, now);
      const alreadyStarted = row.first_connect_at != null && (row.status === 'in_progress' || row.status === 'disconnected');

      if (!alreadyStarted && decision.status === 'window_not_open') {
        throw windowForbidden(decision, 'WINDOW_NOT_OPEN');
      }
      if (!alreadyStarted && decision.status === 'expired') {
        throw windowForbidden(decision, 'WINDOW_EXPIRED');
      }
      if (row.deadline_at && now.getTime() > new Date(row.deadline_at).getTime() && row.status !== 'disconnected') {
        throw problem({
          title: 'Forbidden',
          status: 403,
          detail: 'The server deadline for this assignment has passed.',
          code: 'ASSIGNMENT_EXPIRED',
        });
      }

      if (!row.first_connect_at) {
        const deadline = calculateEffectiveDeadline(timing, now, row.extended_minutes ?? 0);
        await tx.query(
          `UPDATE app.assignments
              SET first_connect_at = $3, deadline_at = $4, status = 'in_progress'
            WHERE id = $1 AND org_id = $2 AND first_connect_at IS NULL`,
          [row.id, row.org_id, now.toISOString(), deadline.toISOString()],
        );
        await tx.query(
          `INSERT INTO app.workspaces (org_id, assignment_id, mode, status, started_at, last_activity_at)
           VALUES ($1, $2, $3, 'connected', $4, $4)
           ON CONFLICT (org_id, assignment_id) DO UPDATE
             SET status = 'connected', last_activity_at = EXCLUDED.last_activity_at`,
          [row.org_id, row.id, row.workspace_mode ?? 'cloud', now.toISOString()],
        );
        await this.activity.record({
          tx,
          assignment: { ...row, status: 'in_progress', deadline_at: deadline, workspace_id: row.workspace_id },
          eventType: 'connect',
          now,
        });
        return this.timing.status({ timing, deadlineAt: deadline, now });
      }

      if (row.status === 'disconnected') {
        const resumed = await this.activity.record({
          tx,
          assignment: this.activityRow(row),
          eventType: 'resume',
          now,
        });
        return this.timing.status({ timing, deadlineAt: resumed.deadlineAt, now });
      }

      return this.timing.status({
        timing,
        deadlineAt: row.deadline_at ? new Date(row.deadline_at) : null,
        now,
      });
    });
  }

  async recordEvent(params: {
    assignmentId: string;
    actor: UserContext;
    eventType: ActivityEventType;
    ip?: string | null;
    now?: Date;
  }) {
    const now = params.now ?? new Date();
    return this.inOrg(params.actor, async (tx) => {
      const row = await this.loadForCandidate(tx, params.assignmentId, params.actor);
      const timing = parseTimingConfig(row.timing);
      const before = row.deadline_at ? new Date(row.deadline_at).toISOString() : null;
      const result = await this.activity.record({
        tx,
        assignment: this.activityRow(row),
        eventType: params.eventType,
        ip: params.ip,
        now,
      });
      return {
        deadlineAtUtc: result.deadlineAt ? result.deadlineAt.toISOString() : before,
        status: result.status,
        pauseAppliedMs: result.pauseAppliedMs,
        pauseTimerOnDisconnect: timing.pauseTimerOnDisconnect,
        serverNowUtc: now.toISOString(),
      };
    });
  }

  async submit(assignmentId: string, actor: UserContext, now = new Date()) {
    return this.inOrg(actor, async (tx) => {
      const row = await this.loadForCandidate(tx, assignmentId, actor);
      const snapshot = await this.submissions.finalize({
        tx,
        orgId: row.org_id,
        assignmentId: row.id,
        autoSubmitted: false,
        now,
      });
      if (!snapshot) {
        throw problem({
          title: 'Conflict',
          status: 409,
          detail: 'This assignment is no longer open for submission.',
          code: 'ASSIGNMENT_NOT_OPEN',
        });
      }
      await this.audit.record(tx, {
        actorId: actor.userId,
        actorRole: actor.role,
        orgId: row.org_id,
        action: 'assignment.submitted',
        entity: 'assignment',
        entityId: row.id,
        after: { status: 'submitted', autoSubmitted: false },
        ip: null,
      });
      return snapshot;
    });
  }

  /**
   * CO-031 / BR-31. Company admins grant extra minutes during a live run.
   * Submitted and expired assignments reopen only for a company admin on this route.
   */
  async extendTime(params: {
    assignmentId: string;
    actor: UserContext;
    dto: ExtendAssignmentTimeDto;
    ip?: string | null;
    userAgent?: string | null;
    requestId?: string | null;
    now?: Date;
  }) {
    if (!params.actor.orgId) {
      throw problem({
        title: 'Forbidden',
        status: 403,
        detail: 'Organization context is required.',
        code: 'FORBIDDEN',
      });
    }
    if (params.actor.role !== 'company_admin' && params.actor.role !== 'platform_admin') {
      throw problem({
        title: 'Forbidden',
        status: 403,
        detail: 'Only a company admin can grant a time accommodation.',
        code: 'FORBIDDEN',
      });
    }

    const now = params.now ?? new Date();
    return this.inOrg(params.actor, async (tx) => {
      const found = await tx.query<AssignmentTimingRow>(
        `${ASSIGNMENT_SQL} AND a.org_id = $2`,
        [params.assignmentId, params.actor.orgId],
      );
      const row = found.rows[0];
      if (!row) {
        throw problem({
          title: 'Not Found',
          status: 404,
          detail: 'Assignment not found.',
          code: 'NOT_FOUND',
        });
      }
      if (row.status === 'revoked') {
        throw problem({
          title: 'Conflict',
          status: 409,
          detail: 'A revoked assignment cannot be extended.',
          code: 'ASSIGNMENT_REVOKED',
        });
      }

      const minutes = params.dto.additionalMinutes;
      const reopening = row.status === 'submitted' || row.status === 'expired';
      const baseMs = row.deadline_at ? new Date(row.deadline_at).getTime() : now.getTime();
      const anchor = reopening ? Math.max(baseMs, now.getTime()) : baseMs;
      const nextDeadline = row.deadline_at || reopening ? new Date(anchor + minutes * 60_000) : null;

      const updated = await tx.query<{ deadline_at: Date | null; extended_minutes: number; status: string }>(
        `UPDATE app.assignments
            SET extended_minutes = extended_minutes + $3,
                deadline_at = COALESCE($4::timestamptz, deadline_at),
                status = CASE WHEN status IN ('submitted', 'expired') THEN 'in_progress' ELSE status END,
                auto_submitted = CASE WHEN status IN ('submitted', 'expired') THEN false ELSE auto_submitted END
          WHERE id = $1 AND org_id = $2
          RETURNING deadline_at, extended_minutes, status`,
        [row.id, row.org_id, minutes, nextDeadline ? nextDeadline.toISOString() : null],
      );

      const after = updated.rows[0]!;
      await this.audit.record(tx, {
        actorId: params.actor.userId,
        actorRole: params.actor.role,
        orgId: row.org_id,
        action: reopening ? 'assignment.reopened' : 'assignment.time_extended',
        entity: 'assignment',
        entityId: row.id,
        before: {
          status: row.status,
          extendedMinutes: row.extended_minutes,
          deadlineAt: row.deadline_at ? new Date(row.deadline_at).toISOString() : null,
        },
        after: {
          status: after.status,
          extendedMinutes: after.extended_minutes,
          additionalMinutes: minutes,
          candidateId: row.candidate_id,
          reason: params.dto.reason,
          deadlineAt: after.deadline_at ? new Date(after.deadline_at).toISOString() : null,
          reopened: reopening,
        },
        ip: params.ip,
        userAgent: params.userAgent,
        requestId: params.requestId,
      });

      return {
        id: row.id,
        status: after.status,
        extendedMinutes: after.extended_minutes,
        additionalMinutes: minutes,
        deadlineAtUtc: after.deadline_at ? new Date(after.deadline_at).toISOString() : null,
        reopened: reopening,
      };
    });
  }

  private activityRow(row: AssignmentTimingRow) {
    return {
      id: row.id,
      org_id: row.org_id,
      status: row.status,
      deadline_at: row.deadline_at,
      extended_minutes: row.extended_minutes ?? 0,
      timing: row.timing,
      workspace_id: row.workspace_id,
      disconnected_at: row.disconnected_at,
    };
  }

  private assertAccountActive(row: AssignmentTimingRow): void {
    if (row.user_status === 'suspended') {
      throw problem({
        title: 'Forbidden',
        status: 403,
        detail: 'This account is suspended.',
        code: 'USER_SUSPENDED',
      });
    }
    if (row.org_status === 'suspended') {
      throw problem({
        title: 'Forbidden',
        status: 403,
        detail: 'This organization is suspended.',
        code: 'ORGANIZATION_SUSPENDED',
      });
    }
  }

  private async loadForCandidate(tx: PoolClient, assignmentId: string, actor: UserContext): Promise<AssignmentTimingRow> {
    if (!actor.orgId) {
      throw problem({
        title: 'Not Found',
        status: 404,
        detail: 'Assignment not found.',
        code: 'NOT_FOUND',
      });
    }
    const found = await tx.query<AssignmentTimingRow>(
      `${ASSIGNMENT_SQL} AND a.candidate_id = $2`,
      [assignmentId, actor.userId],
    );
    const row = found.rows[0];
    if (!row) {
      throw problem({
        title: 'Not Found',
        status: 404,
        detail: 'Assignment not found.',
        code: 'NOT_FOUND',
      });
    }
    return row;
  }

  private async inOrg<T>(actor: UserContext, fn: (tx: PoolClient) => Promise<T>): Promise<T> {
    if (!actor.orgId) {
      throw problem({
        title: 'Forbidden',
        status: 403,
        detail: 'Organization context is required.',
        code: 'FORBIDDEN',
      });
    }
    if (!this.pool) {
      throw problem({
        title: 'Service Unavailable',
        status: 503,
        detail: 'Database is not configured.',
        code: 'DATABASE_UNAVAILABLE',
      });
    }
    const client = await this.pool.connect();
    try {
      return await withOrg(client, actor.orgId, fn);
    } finally {
      client.release();
    }
  }
}
