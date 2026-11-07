import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import {
  calculateResumeDeadline,
  parseTimingConfig,
  type TimingWindowConfig,
} from '../assessments/timing.service.js';

export type ActivityEventType = 'connect' | 'disconnect' | 'resume' | 'fullscreen_exit' | 'submit';

function asInet(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const trimmed = ip.trim();
  if (!trimmed) return null;
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(trimmed) || trimmed.includes(':')) {
    return trimmed;
  }
  return null;
}

export interface ActivityAssignmentRow {
  id: string;
  org_id: string;
  status: string;
  deadline_at: Date | null;
  extended_minutes: number;
  timing: TimingWindowConfig;
  workspace_id: string | null;
  disconnected_at: Date | null;
}

/**
 * BR-09 disconnect tracker.
 * Client-supplied timestamps are ignored. The server clock is the only source of disconnect and resume instants.
 * pause_timer_on_disconnect defaults to false, so a disconnect does not move deadline_at.
 */
@Injectable()
export class SessionActivityService {
  async record(params: {
    tx: PoolClient;
    assignment: ActivityAssignmentRow;
    eventType: ActivityEventType;
    ip?: string | null | undefined;
    now: Date;
  }): Promise<{ deadlineAt: Date | null; status: string; pauseAppliedMs: number }> {
    const { tx, assignment, eventType, now } = params;
    const timing = parseTimingConfig(assignment.timing);
    const pause = timing.pauseTimerOnDisconnect === true;
    let deadlineAt = assignment.deadline_at ? new Date(assignment.deadline_at) : null;
    let status = assignment.status;
    let pauseAppliedMs = 0;

    if (eventType === 'disconnect' || eventType === 'fullscreen_exit') {
      await tx.query(
        `UPDATE app.workspaces
            SET status = 'disconnected',
                disconnected_at = $3,
                last_activity_at = $3
          WHERE org_id = $1 AND assignment_id = $2`,
        [assignment.org_id, assignment.id, now.toISOString()],
      );
      if (status === 'in_progress') {
        status = 'disconnected';
        await tx.query(
          `UPDATE app.assignments SET status = 'disconnected' WHERE id = $1 AND org_id = $2`,
          [assignment.id, assignment.org_id],
        );
      }
    }

    if (eventType === 'resume' || eventType === 'connect') {
      const disconnectedAt = assignment.disconnected_at
        ? new Date(assignment.disconnected_at)
        : null;
      if (pause && deadlineAt && disconnectedAt && status === 'disconnected') {
        const next = calculateResumeDeadline({
          currentDeadline: deadlineAt,
          disconnectedAt,
          resumedAt: now,
          pauseTimerOnDisconnect: true,
          windowEndUtc: timing.windowEndUtc ?? null,
          extendedMinutes: assignment.extended_minutes ?? 0,
        });
        pauseAppliedMs = next.getTime() - deadlineAt.getTime();
        deadlineAt = next;
        await tx.query(
          `UPDATE app.assignments SET deadline_at = $3, status = 'in_progress' WHERE id = $1 AND org_id = $2`,
          [assignment.id, assignment.org_id, deadlineAt.toISOString()],
        );
      } else if (status === 'disconnected') {
        status = 'in_progress';
        await tx.query(
          `UPDATE app.assignments SET status = 'in_progress' WHERE id = $1 AND org_id = $2`,
          [assignment.id, assignment.org_id],
        );
      }
      await tx.query(
        `UPDATE app.workspaces
            SET status = 'connected',
                disconnected_at = NULL,
                last_activity_at = $3
          WHERE org_id = $1 AND assignment_id = $2`,
        [assignment.org_id, assignment.id, now.toISOString()],
      );
      status = status === 'disconnected' ? 'in_progress' : status;
    }

    await tx.query(
      `INSERT INTO app.activity_events (org_id, assignment_id, workspace_id, type, payload, ip, at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::inet, $7)`,
      [
        assignment.org_id,
        assignment.id,
        assignment.workspace_id,
        eventType === 'fullscreen_exit' ? 'fullscreen_exit' : eventType,
        JSON.stringify({
          pauseTimerOnDisconnect: pause,
          pauseAppliedMs,
          serverNowUtc: now.toISOString(),
        }),
        asInet(params.ip),
        now.toISOString(),
      ],
    );

    return { deadlineAt, status, pauseAppliedMs };
  }

  /**
   * BR-08, BR-11: Workspace activity heartbeat recording (I174).
   * If the workspace was disconnected, it seamlessly records a 'resume' event and re-computes deadline.
   * If already connected, it updates last_activity_at without creating redundant event rows.
   */
  async recordHeartbeat(params: {
    tx: PoolClient;
    assignment: ActivityAssignmentRow;
    ip?: string | null | undefined;
    now: Date;
  }): Promise<{ deadlineAt: Date | null; status: string; pauseAppliedMs: number }> {
    const { tx, assignment, ip, now } = params;

    if (assignment.status === 'disconnected') {
      return this.record({
        tx,
        assignment,
        eventType: 'resume',
        ip,
        now,
      });
    }

    // Refresh last_activity_at on the connected workspace
    await tx.query(
      `UPDATE app.workspaces
          SET last_activity_at = $3,
              status = 'connected'
        WHERE org_id = $1 AND assignment_id = $2`,
      [assignment.org_id, assignment.id, now.toISOString()],
    );

    const deadlineAt = assignment.deadline_at ? new Date(assignment.deadline_at) : null;
    return {
      deadlineAt,
      status: assignment.status,
      pauseAppliedMs: 0,
    };
  }
}
