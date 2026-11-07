import crypto from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { problem } from '../../common/errors/app-http.exception.js';
import type { UserContext } from '../../common/types/user-context.js';
import type { RequestMeta } from '../auth/auth.service.js';
import { appendAuditEvent } from '../audit/audit-writer.js';
import { PG_POOL } from '../database/database.tokens.js';
import { withUserSession } from '../tenancy/with-org.js';
import { createStorageAdapter, type StorageAdapter } from '@hs/adapters';
import type { UploadedArtifactMetadata } from '@hs/contracts';
import type { RecordConsentDto } from './dto/record-consent.dto.js';
import type { StartAssessmentDto } from './dto/start-assessment.dto.js';
import type { SubmitDeliverablesDto } from './dto/submit-deliverables.dto.js';
import type { SaveCandidateDraftDto } from './dto/candidate-draft.dto.js';

export interface CandidateAssignmentView {
  id: string;
  assessmentId: string;
  title: string;
  companyName: string;
  durationMinutes: number;
  status: 'invited' | 'window_not_open' | 'ready' | 'in_progress' | 'disconnected' | 'submitted' | 'expired' | 'revoked';
  windowStartUtc?: string | null;
  windowEndUtc?: string | null;
  submittedAt?: string | null;
  workspaceMode?: 'cloud' | 'chat';
  workspaceId?: string | null;
  instructions?: string | null;
  description?: string | null;
}

export interface CandidateAssessmentDetailView {
  id: string;
  assignmentId: string;
  name: string;
  companyName: string;
  durationMinutes: number;
  workspaceMode: 'cloud' | 'chat';
  status: string;
  instructions?: string | null;
  scenario?: string | null;
  deliverables?: string[];
  aiPolicy?: {
    enabled: boolean;
    allowedModels?: string[];
    capPerCandidate?: { unit: string; value: number };
    rpm?: number;
  };
  windowStartUtc?: string | null;
  windowEndUtc?: string | null;
}

export interface AssessmentTimingView {
  assessmentId: string;
  assignmentId: string;
  serverTimeUtc: string;
  deadlineUtc: string;
  durationMinutes: number;
  remainingMs: number;
  pauseTimerOnDisconnect: boolean;
  isExpired: boolean;
}

@Injectable()
export class CandidateAssessmentsService {
  private readonly logger = new Logger(CandidateAssessmentsService.name);
  private readonly storageAdapter: StorageAdapter;

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {
    this.storageAdapter = createStorageAdapter('memory');
  }

  /**
   * Helper to resolve an assignment for the calling candidate.
   * Supports querying by assignment.id or assessment.id.
   */
  private async resolveAssignment(
    tx: any,
    orgId: string,
    candidateId: string,
    idOrAssessmentId: string,
  ) {
    const res = await tx.query(
      `SELECT
         asg.id as assignment_id,
         asg.org_id,
         asg.assessment_id,
         asg.candidate_id,
         asg.status as assignment_status,
         asg.first_connect_at,
         asg.deadline_at,
         asg.extended_minutes,
         asg.submitted_at,
         asg.auto_submitted,
         asg.write_revoked_at,
         asm.name as assessment_name,
         asm.workspace_mode,
         asm.timing,
         asm.brief_overrides,
         asm.ai_policy,
         org.name as company_name,
         tv.manifest,
         ws.id as workspace_id,
         ws.status as workspace_status,
         c.id as consent_id,
         c.text_version as consent_version,
         c.accepted_at as consent_accepted_at
       FROM app.assignments asg
       JOIN app.assessments asm ON asm.id = asg.assessment_id AND asm.org_id = asg.org_id
       JOIN app.organizations org ON org.id = asg.org_id
       JOIN app.template_versions tv ON tv.id = asm.template_version_id
       LEFT JOIN app.workspaces ws ON ws.assignment_id = asg.id
       LEFT JOIN app.consents c ON c.assignment_id = asg.id
       WHERE asg.org_id = $1
         AND asg.candidate_id = $2
         AND (asg.id = $3 OR asg.assessment_id = $3)`,
      [orgId, candidateId, idOrAssessmentId],
    );

    if (res.rowCount === 0) {
      throw problem({
        title: 'Not Found',
        status: 404,
        detail: 'Assessment assignment not found or access denied',
        code: 'ASSIGNMENT_NOT_FOUND',
      });
    }

    return res.rows[0];
  }

  /**
   * GET /api/v1/candidate/assignments
   * Returns all active assessment assignments for authenticated candidate.
   */
  async getAssignments(actor: UserContext): Promise<CandidateAssignmentView[]> {
    if (!actor.orgId || !actor.userId) {
      throw problem({
        title: 'Forbidden',
        status: 403,
        detail: 'Candidate credentials required',
        code: 'FORBIDDEN',
      });
    }

    const client = await this.pool.connect();
    try {
      return await withUserSession(
        client,
        actor.orgId,
        actor.userId,
        actor.role || 'candidate',
        async (tx) => {
          const res = await tx.query(
            `SELECT
               asg.id as assignment_id,
               asg.assessment_id,
               asg.status as db_status,
               asg.first_connect_at,
               asg.deadline_at,
               asg.submitted_at,
               asm.name as assessment_name,
               asm.workspace_mode,
               asm.timing,
               asm.brief_overrides,
               org.name as company_name,
               tv.manifest,
               ws.id as workspace_id
             FROM app.assignments asg
             JOIN app.assessments asm ON asm.id = asg.assessment_id AND asm.org_id = asg.org_id
             JOIN app.organizations org ON org.id = asg.org_id
             JOIN app.template_versions tv ON tv.id = asm.template_version_id
             LEFT JOIN app.workspaces ws ON ws.assignment_id = asg.id
             WHERE asg.org_id = $1
               AND asg.candidate_id = $2
             ORDER BY asg.created_at DESC`,
            [actor.orgId, actor.userId],
          );

          const now = Date.now();

          return res.rows.map((row: any): CandidateAssignmentView => {
            const timing = row.timing || {};
            const manifest = row.manifest || {};
            const durationMinutes = timing.durationMinutes || manifest.workspace?.timeoutMinutes || 90;
            const windowStartUtc = timing.windowStartUtc || null;
            const windowEndUtc = timing.windowEndUtc || null;

            let computedStatus = row.db_status;

            if (row.db_status === 'invited') {
              if (windowStartUtc && new Date(windowStartUtc).getTime() > now) {
                computedStatus = 'window_not_open';
              } else if (windowEndUtc && new Date(windowEndUtc).getTime() < now) {
                computedStatus = 'expired';
              } else {
                computedStatus = 'ready';
              }
            } else if (row.db_status === 'in_progress' || row.db_status === 'disconnected') {
              if (row.deadline_at && new Date(row.deadline_at).getTime() < now) {
                computedStatus = 'submitted'; // Auto-submitted at expiry
              }
            }

            const briefOverrides = row.brief_overrides || {};
            const scenario = briefOverrides.scenario || manifest.summary || manifest.title || '';
            const instructions = briefOverrides.instructions || manifest.instructions || '';

            return {
              id: row.assignment_id,
              assessmentId: row.assessment_id,
              title: row.assessment_name,
              companyName: row.company_name,
              durationMinutes,
              status: computedStatus,
              windowStartUtc,
              windowEndUtc,
              submittedAt: row.submitted_at ? new Date(row.submitted_at).toISOString() : null,
              workspaceMode: row.workspace_mode,
              workspaceId: row.workspace_id,
              instructions,
              description: scenario,
            };
          });
        },
      );
    } finally {
      client.release();
    }
  }

  /**
   * GET /api/v1/candidate/assessments/:id
   * Returns assessment details, brief, and deliverables specification.
   */
  async getAssessmentDetails(
    idOrAssessmentId: string,
    actor: UserContext,
  ): Promise<CandidateAssessmentDetailView> {
    if (!actor.orgId || !actor.userId) {
      throw problem({ title: 'Forbidden', status: 403, detail: 'Candidate credentials required', code: 'FORBIDDEN' });
    }

    const client = await this.pool.connect();
    try {
      return await withUserSession(
        client,
        actor.orgId,
        actor.userId,
        actor.role || 'candidate',
        async (tx) => {
          const row = await this.resolveAssignment(tx, actor.orgId!, actor.userId, idOrAssessmentId);
          const manifest = row.manifest || {};
          const timing = row.timing || {};
          const briefOverrides = row.brief_overrides || {};
          const aiPolicy = row.ai_policy || {};

          const durationMinutes = timing.durationMinutes || manifest.workspace?.timeoutMinutes || 90;
          const instructions = briefOverrides.instructions || manifest.instructions || null;
          const scenario = briefOverrides.scenario || manifest.summary || null;
          const deliverables = briefOverrides.deliverables || manifest.deliverables || [
            'Working source code repository',
            'Architecture and technical decision documentation',
            'Automated test suite with passing verification',
          ];

          return {
            id: row.assessment_id,
            assignmentId: row.assignment_id,
            name: row.assessment_name,
            companyName: row.company_name,
            durationMinutes,
            workspaceMode: row.workspace_mode,
            status: row.assignment_status,
            instructions,
            scenario,
            deliverables,
            aiPolicy: {
              enabled: Boolean(aiPolicy.enabled ?? true),
              allowedModels: aiPolicy.allowedModels || ['gpt-4o', 'claude-3-5-sonnet'],
              capPerCandidate: aiPolicy.capPerCandidate || { unit: 'tokens', value: 50000 },
              rpm: aiPolicy.rpm || 20,
            },
            windowStartUtc: timing.windowStartUtc || null,
            windowEndUtc: timing.windowEndUtc || null,
          };
        },
      );
    } finally {
      client.release();
    }
  }

  /**
   * POST /api/v1/candidate/assessments/:id/consent
   * Persists legal consent before workspace launch (BR-12).
   */
  async recordConsent(
    idOrAssessmentId: string,
    dto: RecordConsentDto,
    actor: UserContext,
    meta: RequestMeta,
  ) {
    if (!actor.orgId || !actor.userId) {
      throw problem({ title: 'Forbidden', status: 403, detail: 'Candidate credentials required', code: 'FORBIDDEN' });
    }

    const client = await this.pool.connect();
    try {
      return await withUserSession(
        client,
        actor.orgId,
        actor.userId,
        actor.role || 'candidate',
        async (tx) => {
          const row = await this.resolveAssignment(tx, actor.orgId!, actor.userId, idOrAssessmentId);

          // Authoritative check on assignment revocation state before recording consent (BR-22)
          const lockRes = await tx.query(
            `SELECT status, write_revoked_at FROM app.assignments WHERE id = $1 AND org_id = $2 AND candidate_id = $3 FOR UPDATE`,
            [row.assignment_id, actor.orgId, actor.userId],
          );

          if (lockRes.rowCount === 0) {
            throw problem({
              title: 'Not Found',
              status: 404,
              detail: 'Assessment assignment not found or access denied',
              code: 'ASSIGNMENT_NOT_FOUND',
            });
          }

          const lockedAssignment = lockRes.rows[0];

          if (
            lockedAssignment.status === 'revoked' ||
            lockedAssignment.write_revoked_at != null ||
            row.assignment_status === 'revoked' ||
            row.write_revoked_at != null
          ) {
            throw problem({
              title: 'Forbidden',
              status: 403,
              detail: 'Assessment access and write privileges have been revoked (BR-22)',
              code: 'ASSIGNMENT_REVOKED',
            });
          }

          if (row.consent_id) {
            // Already recorded (Idempotent response)
            return {
              success: true,
              consentId: row.consent_id,
              assignmentId: row.assignment_id,
              textVersion: row.consent_version,
              acceptedAt: new Date(row.consent_accepted_at).toISOString(),
            };
          }

          const consentId = crypto.randomUUID();
          const ipAddress = meta.ip || '127.0.0.1';
          const userAgent = meta.userAgent || 'unknown';

          const res = await tx.query(
            `INSERT INTO app.consents (
               id, org_id, assignment_id, candidate_id, mode, text_version, ip_address, user_agent, accepted_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
             RETURNING id, assignment_id, text_version, accepted_at`,
            [
              consentId,
              actor.orgId,
              row.assignment_id,
              actor.userId,
              row.workspace_mode,
              dto.textVersion,
              ipAddress,
              userAgent,
            ],
          );

          await appendAuditEvent(tx, {
            orgId: actor.orgId!,
            actorId: actor.userId,
            actorRole: 'candidate',
            action: 'candidate.consent_accepted',
            entity: `assignment:${row.assignment_id}`,
            before: null,
            after: { consentId, textVersion: dto.textVersion, mode: row.workspace_mode },
            ip: ipAddress,
          });

          return {
            success: true,
            consentId: res.rows[0].id,
            assignmentId: res.rows[0].assignment_id,
            textVersion: res.rows[0].text_version,
            acceptedAt: new Date(res.rows[0].accepted_at).toISOString(),
          };
        },
      );
    } finally {
      client.release();
    }
  }

  /**
   * POST /api/v1/candidate/assessments/:id/start
   * Starts or reconnects to assessment session. Establishes authoritative timer (BR-08).
   */
  async startAssessment(
    idOrAssessmentId: string,
    _dto: StartAssessmentDto,
    actor: UserContext,
    meta: RequestMeta,
  ) {
    if (!actor.orgId || !actor.userId) {
      throw problem({ title: 'Forbidden', status: 403, detail: 'Candidate credentials required', code: 'FORBIDDEN' });
    }

    const client = await this.pool.connect();
    try {
      return await withUserSession(
        client,
        actor.orgId,
        actor.userId,
        actor.role || 'candidate',
        async (tx) => {
          const row = await this.resolveAssignment(tx, actor.orgId!, actor.userId, idOrAssessmentId);

          // 1. Consent Gate: Must accept legal consent first (BR-12)
          if (!row.consent_id) {
            throw problem({
              title: 'Precondition Required',
              status: 403,
              detail: 'Legal consent must be accepted before launching workspace (BR-12)',
              code: 'CONSENT_REQUIRED',
            });
          }

          // 2. Window Gate
          const now = Date.now();
          const timing = row.timing || {};
          if (timing.windowStartUtc && new Date(timing.windowStartUtc).getTime() > now) {
            throw problem({
              title: 'Forbidden',
              status: 403,
              detail: 'Assessment window has not yet opened',
              code: 'WINDOW_NOT_OPEN',
            });
          }
          if (timing.windowEndUtc && new Date(timing.windowEndUtc).getTime() < now) {
            throw problem({
              title: 'Forbidden',
              status: 403,
              detail: 'Assessment window has closed',
              code: 'WINDOW_EXPIRED',
            });
          }

          // 3. Status Gate & Authoritative Assignment Row Lock (BR-22)
          const lockRes = await tx.query(
            `SELECT status, write_revoked_at, first_connect_at, deadline_at
             FROM app.assignments
             WHERE id = $1
               AND org_id = $2
               AND candidate_id = $3
             FOR UPDATE`,
            [row.assignment_id, actor.orgId, actor.userId],
          );

          if (lockRes.rowCount === 0) {
            throw problem({
              title: 'Not Found',
              status: 404,
              detail: 'Assessment assignment not found or access denied',
              code: 'ASSIGNMENT_NOT_FOUND',
            });
          }

          const lockedAssignment = lockRes.rows[0];

          // Reject revoked assignments immediately before issuing ticket or updating workspace (BR-22)
          if (
            lockedAssignment.status === 'revoked' ||
            lockedAssignment.write_revoked_at != null ||
            row.assignment_status === 'revoked' ||
            row.write_revoked_at != null
          ) {
            throw problem({
              title: 'Forbidden',
              status: 403,
              detail: 'Assessment access and write privileges have been revoked (BR-22)',
              code: 'ASSIGNMENT_REVOKED',
            });
          }

          if (
            lockedAssignment.status === 'submitted' ||
            row.assignment_status === 'submitted'
          ) {
            throw problem({
              title: 'Conflict',
              status: 409,
              detail: 'Assessment has already been submitted',
              code: 'ASSESSMENT_ALREADY_SUBMITTED',
            });
          }

          // 4. Authoritative Timer Initialization (BR-08, BR-09)
          const durationMinutes = timing.durationMinutes || row.manifest?.workspace?.timeoutMinutes || 90;
          let firstConnectAt = lockedAssignment.first_connect_at
            ? new Date(lockedAssignment.first_connect_at)
            : row.first_connect_at
              ? new Date(row.first_connect_at)
              : null;
          let deadlineAt = lockedAssignment.deadline_at
            ? new Date(lockedAssignment.deadline_at)
            : row.deadline_at
              ? new Date(row.deadline_at)
              : null;

          if (!firstConnectAt) {
            // Initial connect: Anchor timer
            firstConnectAt = new Date();
            deadlineAt = new Date(firstConnectAt.getTime() + durationMinutes * 60 * 1000);

            await tx.query(
              `UPDATE app.assignments
               SET first_connect_at = $1, deadline_at = $2, status = 'in_progress', updated_at = now()
               WHERE id = $3 AND status != 'revoked' AND write_revoked_at IS NULL`,
              [firstConnectAt.toISOString(), deadlineAt.toISOString(), row.assignment_id],
            );

            await appendAuditEvent(tx, {
              orgId: actor.orgId!,
              actorId: actor.userId,
              actorRole: 'candidate',
              action: 'workspace.connect',
              entity: `assignment:${row.assignment_id}`,
              before: { status: lockedAssignment.status },
              after: { status: 'in_progress', firstConnectAt, deadlineAt },
              ip: meta.ip || '127.0.0.1',
            });
          } else if (lockedAssignment.status === 'disconnected') {
            // Reconnect: Keep existing first_connect_at & deadline_at
            await tx.query(
              `UPDATE app.assignments
               SET status = 'in_progress', updated_at = now()
               WHERE id = $1 AND status != 'revoked' AND write_revoked_at IS NULL`,
              [row.assignment_id],
            );
          }

          // 5. Workspace Session Provisioning
          let workspaceId = row.workspace_id;
          if (!workspaceId) {
            workspaceId = crypto.randomUUID();
            await tx.query(
              `INSERT INTO app.workspaces (
                 id, org_id, assignment_id, candidate_id, mode, status, runtime_ref
               ) VALUES ($1, $2, $3, $4, $5, 'connected', $6)`,
              [workspaceId, actor.orgId, row.assignment_id, actor.userId, row.workspace_mode, `sysbox-${workspaceId.slice(0, 8)}`],
            );
          } else {
            const wsUpdateRes = await tx.query(
              `UPDATE app.workspaces
                  SET status = 'connected',
                      last_activity_at = now()
                WHERE id = $1
                  AND status != 'destroyed'`,
              [workspaceId],
            );

            if (wsUpdateRes.rowCount === 0) {
              throw problem({
                title: 'Conflict',
                status: 409,
                detail: 'Cannot reconnect workspace: workspace is in terminal state (destroyed) (BR-22)',
                code: 'WORKSPACE_ALREADY_TERMINATED',
              });
            }
          }

          const remainingMs = Math.max(0, deadlineAt!.getTime() - Date.now());

          return {
            sessionId: workspaceId,
            assignmentId: row.assignment_id,
            mode: row.workspace_mode,
            status: 'connected',
            gatewayUrl: `wss://ws.hellosmart.ai/stream/${workspaceId}`,
            ticket: `tkt_${crypto.randomBytes(16).toString('hex')}`,
            serverTimeUtc: new Date().toISOString(),
            deadlineUtc: deadlineAt!.toISOString(),
            remainingMs,
            requireFullscreen: row.workspace_mode === 'cloud',
          };
        },
      );
    } finally {
      client.release();
    }
  }

  /**
   * POST /api/v1/candidate/assessments/:id/submit
   * Submits final deliverables, burns receipt, prevents duplicate submit (409) (BR-20).
   */
  async submitDeliverables(
    idOrAssessmentId: string,
    dto: SubmitDeliverablesDto,
    actor: UserContext,
    meta: RequestMeta,
  ) {
    if (!actor.orgId || !actor.userId) {
      throw problem({ title: 'Forbidden', status: 403, detail: 'Candidate credentials required', code: 'FORBIDDEN' });
    }

    const client = await this.pool.connect();
    try {
      return await withUserSession(
        client,
        actor.orgId,
        actor.userId,
        actor.role || 'candidate',
        async (tx) => {
          const row = await this.resolveAssignment(tx, actor.orgId!, actor.userId, idOrAssessmentId);

          // Atomic row-level lock on assignment to avoid race with draft saves and emergency destroy
          const lockRes = await tx.query(
            `SELECT status, submitted_at, write_revoked_at FROM app.assignments WHERE id = $1 AND org_id = $2 AND candidate_id = $3 FOR UPDATE`,
            [row.assignment_id, actor.orgId, actor.userId],
          );

          if (lockRes.rowCount === 0) {
            throw problem({
              title: 'Not Found',
              status: 404,
              detail: 'Assessment assignment not found or access denied',
              code: 'ASSIGNMENT_NOT_FOUND',
            });
          }

          const lockedAssignment = lockRes.rows[0];

          // Reject revoked assignments (BR-22 emergency destroy kill-switch)
          if (
            lockedAssignment.status === 'revoked' ||
            lockedAssignment.write_revoked_at != null ||
            row.assignment_status === 'revoked' ||
            row.write_revoked_at != null
          ) {
            throw problem({
              title: 'Forbidden',
              status: 403,
              detail: 'Assessment access and write privileges have been revoked (BR-22)',
              code: 'ASSIGNMENT_REVOKED',
            });
          }

          if (
            lockedAssignment.status === 'submitted' ||
            lockedAssignment.submitted_at ||
            row.assignment_status === 'submitted' ||
            row.submitted_at
          ) {
            throw problem({
              title: 'Conflict',
              status: 409,
              detail: 'Assessment deliverables have already been finalized and submitted (BR-20)',
              code: 'SUBMISSION_ALREADY_EXISTS',
            });
          }

          const submissionId = crypto.randomUUID();
          const receiptId = `sub_rec_${crypto.randomBytes(8).toString('hex')}`;
          const isExpired = row.deadline_at && new Date(row.deadline_at).getTime() < Date.now();

          // Fetch uploaded artifact metadata from drafts if available
          let uploadedArtifact = null;
          if (dto.uploadedArtifactId) {
            const draftRes = await tx.query(
              `SELECT uploaded_artifact FROM app.drafts WHERE assignment_id = $1`,
              [row.assignment_id],
            );
            if (draftRes.rowCount && draftRes.rowCount > 0) {
              uploadedArtifact = draftRes.rows[0].uploaded_artifact;
            }
          }

          // 1. Insert immutable submission record
          await tx.query(
            `INSERT INTO app.submissions (
               id, org_id, assignment_id, candidate_id, repository_url, branch_name,
               uploaded_artifact, architecture_notes, submitted_at, auto_submitted, receipt_id
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), $9, $10)`,
            [
              submissionId,
              actor.orgId,
              row.assignment_id,
              actor.userId,
              dto.repositoryUrl,
              dto.branchName,
              uploadedArtifact,
              dto.architectureNotes,
              Boolean(isExpired),
              receiptId,
            ],
          );

          // 2. Finalize assignment status
          await tx.query(
            `UPDATE app.assignments
             SET status = 'submitted', submitted_at = now(), auto_submitted = $1, updated_at = now()
             WHERE id = $2`,
            [Boolean(isExpired), row.assignment_id],
          );

          // 3. End workspace session (preserve destroyed status if emergency kill-switch ran)
          if (row.workspace_id) {
            await tx.query(
              `UPDATE app.workspaces SET status = 'ended', ended_at = now() WHERE id = $1 AND status != 'destroyed'`,
              [row.workspace_id],
            );
          }

          // 4. Audit ledger entry
          await appendAuditEvent(tx, {
            orgId: actor.orgId!,
            actorId: actor.userId,
            actorRole: 'candidate',
            action: 'candidate.submission_received',
            entity: `submission:${submissionId}`,
            before: { status: row.assignment_status },
            after: { status: 'submitted', receiptId, autoSubmitted: Boolean(isExpired) },
            ip: meta.ip || '127.0.0.1',
          });

          return {
            success: true,
            submissionId,
            assignmentId: row.assignment_id,
            receiptId,
            submittedAt: new Date().toISOString(),
          };
        },
      );
    } finally {
      client.release();
    }
  }

  /**
   * GET /api/v1/candidate/assessments/:id/timing
   * Authoritative countdown timer state.
   */
  async getTiming(
    idOrAssessmentId: string,
    actor: UserContext,
  ): Promise<AssessmentTimingView> {
    if (!actor.orgId || !actor.userId) {
      throw problem({ title: 'Forbidden', status: 403, detail: 'Candidate credentials required', code: 'FORBIDDEN' });
    }

    const client = await this.pool.connect();
    try {
      return await withUserSession(
        client,
        actor.orgId,
        actor.userId,
        actor.role || 'candidate',
        async (tx) => {
          const row = await this.resolveAssignment(tx, actor.orgId!, actor.userId, idOrAssessmentId);
          const timing = row.timing || {};
          const durationMinutes = timing.durationMinutes || row.manifest?.workspace?.timeoutMinutes || 90;
          const pauseTimerOnDisconnect = Boolean(timing.pauseTimerOnDisconnect ?? false);

          const now = Date.now();
          let remainingMs = durationMinutes * 60 * 1000;
          let isExpired = false;
          let deadlineIso = new Date(now + remainingMs).toISOString();

          if (row.first_connect_at && row.deadline_at) {
            const deadlineTime = new Date(row.deadline_at).getTime();
            remainingMs = Math.max(0, deadlineTime - now);
            isExpired = remainingMs === 0;
            deadlineIso = new Date(row.deadline_at).toISOString();
          }

          return {
            assessmentId: row.assessment_id,
            assignmentId: row.assignment_id,
            serverTimeUtc: new Date().toISOString(),
            deadlineUtc: deadlineIso,
            durationMinutes,
            remainingMs,
            pauseTimerOnDisconnect,
            isExpired,
          };
        },
      );
    } finally {
      client.release();
    }
  }

  /**
   * GET /api/v1/candidate/assessments/:id/draft
   * Retrieves current candidate draft.
   */
  async getDraft(idOrAssessmentId: string, actor: UserContext) {
    if (!actor.orgId || !actor.userId) {
      throw problem({ title: 'Forbidden', status: 403, detail: 'Candidate credentials required', code: 'FORBIDDEN' });
    }

    const client = await this.pool.connect();
    try {
      return await withUserSession(
        client,
        actor.orgId,
        actor.userId,
        actor.role || 'candidate',
        async (tx) => {
          const row = await this.resolveAssignment(tx, actor.orgId!, actor.userId, idOrAssessmentId);
          const res = await tx.query(
            `SELECT assignment_id, repository_url, branch_name, uploaded_artifact, architecture_notes, version, updated_at
             FROM app.drafts
             WHERE assignment_id = $1`,
            [row.assignment_id],
          );

          if (res.rowCount === 0) {
            return {
              assignmentId: row.assignment_id,
              repositoryUrl: '',
              branchName: 'main',
              uploadedArtifact: null,
              architectureNotes: '',
              version: 0,
              updatedAt: new Date().toISOString(),
            };
          }

          const draft = res.rows[0];
          return {
            assignmentId: draft.assignment_id,
            repositoryUrl: draft.repository_url,
            branchName: draft.branch_name,
            uploadedArtifact: draft.uploaded_artifact,
            architectureNotes: draft.architecture_notes,
            version: draft.version,
            updatedAt: new Date(draft.updated_at).toISOString(),
          };
        },
      );
    } finally {
      client.release();
    }
  }

  /**
   * POST /api/v1/candidate/assessments/:id/draft
   * Continuous 30-second autosave persistence (BR-11).
   */
  async saveDraft(
    idOrAssessmentId: string,
    dto: SaveCandidateDraftDto,
    actor: UserContext,
  ) {
    if (!actor.orgId || !actor.userId) {
      throw problem({ title: 'Forbidden', status: 403, detail: 'Candidate credentials required', code: 'FORBIDDEN' });
    }

    const client = await this.pool.connect();
    try {
      return await withUserSession(
        client,
        actor.orgId,
        actor.userId,
        actor.role || 'candidate',
        async (tx) => {
          const row = await this.resolveAssignment(tx, actor.orgId!, actor.userId, idOrAssessmentId);

          // Atomic check on assignment status with row lock to prevent race with final submission and emergency destroy
          const lockRes = await tx.query(
            `SELECT status, submitted_at, write_revoked_at FROM app.assignments WHERE id = $1 AND org_id = $2 AND candidate_id = $3 FOR UPDATE`,
            [row.assignment_id, actor.orgId, actor.userId],
          );

          if (lockRes.rowCount === 0) {
            throw problem({
              title: 'Not Found',
              status: 404,
              detail: 'Assessment assignment not found or access denied',
              code: 'ASSIGNMENT_NOT_FOUND',
            });
          }

          const lockedAssignment = lockRes.rows[0];

          // Reject revoked assignments (BR-22 emergency destroy kill-switch)
          if (
            lockedAssignment.status === 'revoked' ||
            lockedAssignment.write_revoked_at != null ||
            row.assignment_status === 'revoked' ||
            row.write_revoked_at != null
          ) {
            throw problem({
              title: 'Forbidden',
              status: 403,
              detail: 'Assessment access and write privileges have been revoked (BR-22)',
              code: 'ASSIGNMENT_REVOKED',
            });
          }

          if (
            lockedAssignment.status === 'submitted' ||
            lockedAssignment.submitted_at ||
            row.assignment_status === 'submitted' ||
            row.submitted_at
          ) {
            throw problem({
              title: 'Conflict',
              status: 409,
              detail: 'Assessment deliverables have already been submitted. Draft is locked against modifications (BR-20).',
              code: 'DRAFT_LOCKED',
            });
          }

          const res = await tx.query(
            `INSERT INTO app.drafts (
               assignment_id, org_id, candidate_id, repository_url, branch_name,
               uploaded_artifact, architecture_notes, version, updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
             ON CONFLICT (assignment_id) DO UPDATE SET
               repository_url = EXCLUDED.repository_url,
               branch_name = EXCLUDED.branch_name,
               uploaded_artifact = COALESCE(EXCLUDED.uploaded_artifact, app.drafts.uploaded_artifact),
               architecture_notes = EXCLUDED.architecture_notes,
               version = app.drafts.version + 1,
               updated_at = now()
             RETURNING assignment_id, repository_url, branch_name, uploaded_artifact, architecture_notes, version, updated_at`,
            [
              row.assignment_id,
              actor.orgId,
              actor.userId,
              dto.repositoryUrl || '',
              dto.branchName || 'main',
              dto.uploadedArtifact ? JSON.stringify(dto.uploadedArtifact) : null,
              dto.architectureNotes || '',
              dto.version || 1,
            ],
          );

          const saved = res.rows[0];
          return {
            assignmentId: saved.assignment_id,
            repositoryUrl: saved.repository_url,
            branchName: saved.branch_name,
            uploadedArtifact: saved.uploaded_artifact,
            architectureNotes: saved.architecture_notes,
            version: saved.version,
            updatedAt: new Date(saved.updated_at).toISOString(),
          };
        },
      );
    } finally {
      client.release();
    }
  }

  /**
   * POST /api/v1/candidate/artifacts/upload
   * Validates archive integrity, streams to object storage, and updates candidate draft.
   */
  async uploadArtifact(
    request: any,
    actor: UserContext,
    meta: RequestMeta,
  ): Promise<UploadedArtifactMetadata> {
    if (!actor.orgId || !actor.userId) {
      throw problem({ title: 'Forbidden', status: 403, detail: 'Candidate credentials required', code: 'FORBIDDEN' });
    }

    const part = await (request as any).file?.({ limits: { fileSize: 52428800 } });
    if (!part) {
      throw problem({ title: 'Bad Request', status: 400, detail: 'Multipart file payload is required', code: 'FILE_REQUIRED' });
    }

    const originalName = part.filename || 'deliverable.zip';
    const mimeType = part.mimetype || 'application/octet-stream';
    const buffer = await part.toBuffer();

    if (buffer.length > 52428800) {
      throw problem({ title: 'Payload Too Large', status: 413, detail: 'File exceeds maximum 50 MB limit', code: 'FILE_TOO_LARGE' });
    }

    const lowerName = originalName.toLowerCase();
    const validExts = ['.zip', '.tar', '.gz', '.tgz'];
    const hasValidExt = validExts.some((ext) => lowerName.endsWith(ext));
    if (!hasValidExt) {
      throw problem({
        title: 'Unsupported Media Type',
        status: 415,
        detail: 'Unsupported file format. Please upload a .zip, .tar, .tar.gz, or .tgz archive.',
        code: 'UNSUPPORTED_FILE_TYPE',
      });
    }

    // Verify magic bytes: zip, gzip, or tar
    const isZip = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
    const isGzip = buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
    const isTar = buffer.length >= 262 && buffer.toString('utf8', 257, 262) === 'ustar';
    if (!isZip && !isGzip && !isTar && !lowerName.endsWith('.tar')) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'File content does not match supported archive magic bytes (.zip, .tar, .gz, .tgz)',
        code: 'INVALID_ARCHIVE_SIGNATURE',
      });
    }

    const assignmentIdOrAssessmentId =
      (part.fields?.assignmentId as any)?.value ||
      (request.query as any)?.assignmentId ||
      (request.query as any)?.id;

    const artifactId = `art_${crypto.randomUUID()}`;
    const storageKey = `tenants/${actor.orgId}/candidates/${actor.userId}/artifacts/${artifactId}_${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    const client = await this.pool.connect();
    let uploaded = false;
    try {
      if (assignmentIdOrAssessmentId) {
        // Pre-validate assignment status and revocation with atomic lock before performing storage upload (BR-22)
        await withUserSession(client, actor.orgId, actor.userId, actor.role || 'candidate', async (tx) => {
          const row = await this.resolveAssignment(tx, actor.orgId!, actor.userId, assignmentIdOrAssessmentId);
          const lockRes = await tx.query(
            `SELECT status, submitted_at, write_revoked_at FROM app.assignments WHERE id = $1 AND org_id = $2 AND candidate_id = $3 FOR UPDATE`,
            [row.assignment_id, actor.orgId, actor.userId],
          );
          if (lockRes.rowCount === 0) {
            throw problem({
              title: 'Not Found',
              status: 404,
              detail: 'Assessment assignment not found or access denied',
              code: 'ASSIGNMENT_NOT_FOUND',
            });
          }
          const lockedAssignment = lockRes.rows[0];
          if (
            lockedAssignment.status === 'revoked' ||
            lockedAssignment.write_revoked_at != null ||
            row.assignment_status === 'revoked' ||
            row.write_revoked_at != null
          ) {
            throw problem({
              title: 'Forbidden',
              status: 403,
              detail: 'Assessment access and write privileges have been revoked (BR-22)',
              code: 'ASSIGNMENT_REVOKED',
            });
          }
          if (
            lockedAssignment.status === 'submitted' ||
            lockedAssignment.submitted_at ||
            row.assignment_status === 'submitted' ||
            row.submitted_at
          ) {
            throw problem({
              title: 'Conflict',
              status: 409,
              detail: 'Assessment deliverables have already been submitted. Draft is locked against modifications (BR-20).',
              code: 'DRAFT_LOCKED',
            });
          }
        });
      }

      const putResult = await this.storageAdapter.putObject({
        key: storageKey,
        buffer,
        mimeType,
        originalName,
        metadata: {
          orgId: actor.orgId,
          candidateId: actor.userId,
          artifactId,
        },
      });
      uploaded = true;

      const downloadUrl = await this.storageAdapter.getDownloadUrl(storageKey);
      const metadata: UploadedArtifactMetadata = {
        id: artifactId,
        originalName,
        mimeType,
        sizeBytes: buffer.length,
        downloadUrl,
        uploadedAt: putResult.uploadedAt,
      };

      if (assignmentIdOrAssessmentId) {
        await withUserSession(client, actor.orgId, actor.userId, actor.role || 'candidate', async (tx) => {
          const row = await this.resolveAssignment(tx, actor.orgId!, actor.userId, assignmentIdOrAssessmentId);

          // Re-verify atomic lock before persisting draft record (defense against concurrent revocation during upload)
          const lockRes = await tx.query(
            `SELECT status, submitted_at, write_revoked_at FROM app.assignments WHERE id = $1 AND org_id = $2 AND candidate_id = $3 FOR UPDATE`,
            [row.assignment_id, actor.orgId, actor.userId],
          );
          if (lockRes.rowCount === 0) {
            throw problem({
              title: 'Not Found',
              status: 404,
              detail: 'Assessment assignment not found or access denied',
              code: 'ASSIGNMENT_NOT_FOUND',
            });
          }
          const lockedAssignment = lockRes.rows[0];
          if (
            lockedAssignment.status === 'revoked' ||
            lockedAssignment.write_revoked_at != null ||
            row.assignment_status === 'revoked' ||
            row.write_revoked_at != null
          ) {
            throw problem({
              title: 'Forbidden',
              status: 403,
              detail: 'Assessment access and write privileges have been revoked (BR-22)',
              code: 'ASSIGNMENT_REVOKED',
            });
          }
          if (
            lockedAssignment.status === 'submitted' ||
            lockedAssignment.submitted_at ||
            row.assignment_status === 'submitted' ||
            row.submitted_at
          ) {
            throw problem({
              title: 'Conflict',
              status: 409,
              detail: 'Assessment deliverables have already been submitted. Draft is locked against modifications (BR-20).',
              code: 'DRAFT_LOCKED',
            });
          }

          await tx.query(
            `INSERT INTO app.drafts (
               assignment_id, org_id, candidate_id, uploaded_artifact, updated_at
             ) VALUES ($1, $2, $3, $4, now())
             ON CONFLICT (assignment_id) DO UPDATE SET
               uploaded_artifact = EXCLUDED.uploaded_artifact,
               updated_at = now()`,
            [row.assignment_id, actor.orgId, actor.userId, JSON.stringify(metadata)],
          );

          await appendAuditEvent(tx, {
            orgId: actor.orgId!,
            actorId: actor.userId,
            actorRole: 'candidate',
            action: 'candidate.artifact_uploaded',
            entity: `artifact:${artifactId}`,
            before: null,
            after: { artifactId, originalName, sizeBytes: buffer.length, assignmentId: row.assignment_id },
            ip: meta.ip || '127.0.0.1',
          });
        });
      }

      return metadata;
    } catch (err) {
      if (uploaded) {
        await this.storageAdapter.deleteObject(storageKey).catch(() => {});
      }
      throw err;
    } finally {
      client.release();
    }
  }
}
