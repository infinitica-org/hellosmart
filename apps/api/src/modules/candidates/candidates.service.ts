import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import type {
  CreateCandidateDto,
  CandidateDto,
  CandidateAssignmentDto,
  BulkCandidateUploadResult,
  BulkCandidateRowError,
  BulkCandidateCreatedSample,
  CompanyMetricsDto,
} from '@hs/contracts';
import { MailService } from '../../common/services/mail.service.js';
import { problem } from '../../common/errors/app-http.exception.js';
import type { UserContext } from '../../common/types/user-context.js';
import type { RequestMeta } from '../auth/auth.service.js';
import { appendAuditEvent } from '../audit/audit-writer.js';
import { PG_POOL } from '../database/database.tokens.js';
import { withOrg } from '../tenancy/with-org.js';
import { parseCsvStream } from './csv-stream-parser.js';

@Injectable()
export class CandidatesService {
  private readonly logger = new Logger(CandidatesService.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(MailService) private readonly mailService: MailService,
  ) {}

  async create(
    dto: CreateCandidateDto,
    actor: UserContext,
    meta: RequestMeta,
  ): Promise<CandidateDto | CandidateAssignmentDto> {
    const orgId = actor.orgId;
    if (!orgId) {
      throw problem({
        title: 'Forbidden',
        status: 403,
        detail: 'User does not belong to an organization',
        code: 'TENANT_REQUIRED',
      });
    }

    const candidateEmail = dto.email.trim().toLowerCase();
    const candidateName = dto.name.trim();

    // Mode A: S1-T05-1 Assessment Assignment Invitation
    if (dto.assessment_id) {
      return this.createAssessmentAssignment(
        dto.assessment_id,
        candidateName,
        candidateEmail,
        orgId,
        actor,
        meta,
      );
    }

    // Mode B: Legacy General Candidate Account Onboarding
    return this.createGeneralCandidate(
      candidateName,
      candidateEmail,
      orgId,
      actor,
      meta,
    );
  }

  /**
   * S1-T05-1: Assigns a candidate to an assessment with a single-use 7-day cryptographic invite token.
   * Reuses existing candidate user in the same org, creates an assignment in app.assignments,
   * stores sha256(rawToken), and dispatches an assessment invitation email.
   */
  private async createAssessmentAssignment(
    assessmentId: string,
    candidateName: string,
    candidateEmail: string,
    orgId: string,
    actor: UserContext,
    meta: RequestMeta,
  ): Promise<CandidateAssignmentDto> {
    // Generate cryptographically secure 32-byte token and SHA-256 hash
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest();
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + 7 * 24 * 60 * 60 * 1000); // strictly 7 days from issuance

    const client = await this.pool.connect();
    let assignmentResult: {
      id: string;
      candidateId: string;
      assessmentId: string;
      name: string;
      email: string;
      status: any;
      invitedAt: string;
      expiresAt: string;
      createdAt: string;
    };
    let orgName = 'HelloSmart Organization';
    let assessmentName = 'Assessment';

    try {
      assignmentResult = await withOrg(client, orgId, async (tx) => {
        // 1. Verify assessment exists and belongs to the authenticated organization under tenant RLS (BR-01)
        const assessmentRes = await tx.query<{ id: string; name: string; org_id: string; status: string }>(
          `SELECT id, name, org_id, status FROM app.assessments WHERE id = $1 AND org_id = $2`,
          [assessmentId, orgId],
        );
        const assessment = assessmentRes.rows[0];
        if (!assessment) {
          throw problem({
            title: 'Not Found',
            status: 404,
            detail: 'Assessment not found in your organization',
            code: 'ASSESSMENT_NOT_FOUND',
          });
        }

        // 2. Lifecycle check: Only published assessments are eligible to accept candidate assignments
        if (assessment.status !== 'published') {
          throw problem({
            title: 'Unprocessable Entity',
            status: 422,
            detail: `Assessment is in '${assessment.status}' status and cannot accept candidate assignments. Only published assessments can receive candidate invitations.`,
            code: 'ASSESSMENT_NOT_PUBLISHED',
          });
        }
        assessmentName = assessment.name;

        // Fetch organization name
        const orgRes = await tx.query<{ name: string }>(
          `SELECT name FROM app.organizations WHERE id = $1`,
          [orgId],
        );
        if (orgRes.rows[0]) {
          orgName = orgRes.rows[0].name;
        }

        // 1. Organization Entitlement Serialization Lock (Lock Hierarchy Step 1, BR-05, BR-06)
        const entRes = await tx.query<{
          max_candidates: number;
          pending_invite_multiplier: string | number;
        }>(
          `SELECT max_candidates, pending_invite_multiplier
           FROM app.entitlements
           WHERE org_id = $1
           FOR UPDATE`,
          [orgId],
        );
        if (entRes.rowCount === 0) {
          throw problem({
            title: 'Forbidden',
            status: 403,
            detail: 'Organization entitlements record not found',
            code: 'ENTITLEMENTS_NOT_FOUND',
          });
        }
        const maxCandidates = Number(entRes.rows[0]!.max_candidates);
        const pendingInviteMultiplier = Number(entRes.rows[0]!.pending_invite_multiplier);

        // 2. Candidate user resolution and lock (Lock Hierarchy Step 2)
        const existingUserRes = await tx.query<{
          id: string;
          name: string;
          email: string;
          status: string;
          counted_against_cap_at: Date | null;
          created_at: Date;
        }>(
          `SELECT id, name, email, status, counted_against_cap_at, created_at
           FROM app.users
           WHERE org_id = $1 AND email = $2 AND status != 'deleted' AND deleted_at IS NULL
           FOR UPDATE`,
          [orgId, candidateEmail],
        );

        const isAlreadyCounted = Boolean(existingUserRes.rows[0]?.counted_against_cap_at);

        // 3. Quota validation (BR-06)
        if (!isAlreadyCounted) {
          // Check candidate cap against launched candidates
          const launchedRes = await tx.query<{ count: string }>(
            `SELECT COUNT(*)::int AS count
             FROM app.users
             WHERE org_id = $1
               AND role = 'candidate'
               AND deleted_at IS NULL
               AND status != 'deleted'
               AND counted_against_cap_at IS NOT NULL`,
            [orgId],
          );
          const launchedCount = Number.parseInt(launchedRes.rows[0]?.count || '0', 10);
          if (launchedCount >= maxCandidates) {
            throw problem({
              title: 'Forbidden',
              status: 403,
              detail: 'Organization has reached its candidate cap limit',
              code: 'CANDIDATE_CAP_EXCEEDED',
            });
          }

          // Check pending invite multiplier cap (Model A: assessment-assignment level)
          const pendingRes = await tx.query<{ count: string }>(
            `SELECT COUNT(*)::int AS count
             FROM app.assignments a
             INNER JOIN app.users u ON u.id = a.candidate_id AND u.org_id = a.org_id
             WHERE a.org_id = $1
               AND a.status IN ('invited', 'window_not_open', 'ready')
               AND a.first_connect_at IS NULL
               AND (a.invite_expires_at IS NULL OR a.invite_expires_at > now())
               AND u.deleted_at IS NULL
               AND u.status != 'deleted'
               AND u.counted_against_cap_at IS NULL
               AND a.status != 'revoked'`,
            [orgId],
          );
          const pendingCount = Number.parseInt(pendingRes.rows[0]?.count || '0', 10);
          const pendingLimit = Math.floor(maxCandidates * pendingInviteMultiplier);

          if (pendingCount + 1 > pendingLimit) {
            throw problem({
              title: 'Forbidden',
              status: 403,
              detail: `Organization has reached its pending invitation limit (${pendingCount}/${pendingLimit})`,
              code: 'PENDING_INVITE_CAP_EXCEEDED',
            });
          }
        }

        let candidateId: string;
        let candidateUser: { id: string; name: string; email: string };

        if (existingUserRes.rows[0]) {
          candidateUser = existingUserRes.rows[0];
          candidateId = candidateUser.id;
        } else {
          candidateId = crypto.randomUUID();
          const insertUserRes = await tx.query<{
            id: string;
            name: string;
            email: string;
            status: string;
            created_at: Date;
          }>(
            `INSERT INTO app.users (
               id, org_id, email, email_verified_at, name, role, password_hash, status, must_reset_password, counted_against_cap_at
             ) VALUES ($1, $2, $3, NULL, $4, 'candidate', NULL, 'invited', true, NULL)
             RETURNING id, name, email, status, created_at`,
            [candidateId, orgId, candidateEmail, candidateName],
          );
          candidateUser = insertUserRes.rows[0]!;
        }

        // Check duplicate assignment: same candidate cannot be assigned to the same assessment twice
        const existingAssignmentRes = await tx.query<{ id: string }>(
          `SELECT id FROM app.assignments WHERE org_id = $1 AND assessment_id = $2 AND candidate_id = $3`,
          [orgId, assessmentId, candidateId],
        );
        if (existingAssignmentRes.rowCount && existingAssignmentRes.rowCount > 0) {
          throw problem({
            title: 'Conflict',
            status: 409,
            detail: 'Candidate is already assigned to this assessment',
            code: 'CANDIDATE_ALREADY_ASSIGNED',
          });
        }

        // Insert assessment assignment with explicit issuance timestamp and 7-day token hash
        const assignmentRes = await tx.query<{
          id: string;
          status: string;
          invited_at: Date;
          created_at: Date;
        }>(
          `INSERT INTO app.assignments (
             id, org_id, assessment_id, candidate_id, status, invite_token_hash, invite_issued_at, invite_expires_at, invited_at
           ) VALUES (gen_random_uuid(), $1, $2, $3, 'invited', $4, $5, $6, now())
           RETURNING id, status, invited_at, created_at`,
          [orgId, assessmentId, candidateId, tokenHash, issuedAt, expiresAt],
        );
        const createdAssignment = assignmentRes.rows[0]!;

        // Append tamper-evident audit record (BR-31)
        await appendAuditEvent(tx, {
          actorId: actor.userId,
          actorRole: actor.role,
          orgId,
          action: 'candidate.assigned',
          entity: 'assignment',
          entityId: createdAssignment.id,
          after: {
            candidateId,
            assessmentId,
            email: candidateEmail,
          },
          ip: meta.ip ?? null,
          userAgent: meta.userAgent ?? null,
          requestId: meta.requestId ?? null,
        });

        return {
          id: createdAssignment.id,
          candidateId,
          assessmentId,
          name: candidateUser.name,
          email: candidateUser.email,
          status: createdAssignment.status,
          invitedAt: createdAssignment.invited_at.toISOString(),
          expiresAt: expiresAt.toISOString(),
          createdAt: createdAssignment.created_at.toISOString(),
        };
      });
    } catch (err: any) {
      // Handle PostgreSQL 23505 unique_violation specifically for assignments_org_assessment_candidate_uq
      const isDuplicateAssignment =
        err?.constraint === 'assignments_org_assessment_candidate_uq' ||
        (err?.code === '23505' && err?.message?.includes('assignments_org_assessment_candidate_uq'));

      if (isDuplicateAssignment) {
        throw problem({
          title: 'Conflict',
          status: 409,
          detail: 'Candidate is already assigned to this assessment',
          code: 'CANDIDATE_ALREADY_ASSIGNED',
        });
      }
      throw err;
    } finally {
      client.release();
    }

    // 4. Post-commit assessment invitation email delivery
    let deliveryStatus: 'sent' | 'failed' = 'sent';
    try {
      await this.mailService.sendAssessmentInvitationEmail({
        to: candidateEmail,
        token: rawToken,
        orgName,
        orgId,
        assessmentId,
        assessmentName,
      });
    } catch {
      this.logger.warn(`Failed to deliver assessment invitation email to ${candidateEmail}`);
      deliveryStatus = 'failed';
    }

    return {
      ...assignmentResult,
      deliveryStatus,
    };
  }

  /**
   * Legacy general candidate creation in app.users and account invitation in app.invitations (72h).
   */
  private async createGeneralCandidate(
    candidateName: string,
    candidateEmail: string,
    orgId: string,
    actor: UserContext,
    meta: RequestMeta,
  ): Promise<CandidateDto> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest();
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const client = await this.pool.connect();
    let candidate: CandidateDto;
    let orgName = 'HelloSmart Organization';

    try {
      candidate = await withOrg(client, orgId, async (tx) => {
        // 1. Organization Entitlement Serialization Lock (Lock Hierarchy Step 1, BR-05, BR-06)
        const entRes = await tx.query<{
          max_candidates: number;
        }>(
          `SELECT max_candidates
           FROM app.entitlements
           WHERE org_id = $1
           FOR UPDATE`,
          [orgId],
        );
        if (entRes.rowCount === 0) {
          throw problem({
            title: 'Forbidden',
            status: 403,
            detail: 'Organization entitlements record not found',
            code: 'ENTITLEMENTS_NOT_FOUND',
          });
        }
        const maxCandidates = Number(entRes.rows[0]!.max_candidates);

        // 2. Check candidate cap (BR-06)
        const launchedRes = await tx.query<{ count: string }>(
          `SELECT COUNT(*)::int AS count
           FROM app.users
           WHERE org_id = $1
             AND role = 'candidate'
             AND deleted_at IS NULL
             AND status != 'deleted'
             AND counted_against_cap_at IS NOT NULL`,
          [orgId],
        );
        const launchedCount = Number.parseInt(launchedRes.rows[0]?.count || '0', 10);
        if (launchedCount >= maxCandidates) {
          throw problem({
            title: 'Forbidden',
            status: 403,
            detail: 'Organization has reached its candidate cap limit',
            code: 'CANDIDATE_CAP_EXCEEDED',
          });
        }

        const existing = await tx.query(
          `SELECT id FROM app.users WHERE org_id = $1 AND email = $2 AND status != 'deleted' AND deleted_at IS NULL FOR UPDATE`,
          [orgId, candidateEmail],
        );
        if (existing.rowCount && existing.rowCount > 0) {
          throw problem({
            title: 'Conflict',
            status: 409,
            detail: 'Candidate with this email already exists in your organization',
            code: 'CANDIDATE_ALREADY_EXISTS',
          });
        }

        const orgRes = await tx.query<{ name: string }>(
          `SELECT name FROM app.organizations WHERE id = $1`,
          [orgId],
        );
        if (orgRes.rows[0]) {
          orgName = orgRes.rows[0].name;
        }

        const candidateId = crypto.randomUUID();
        const userRes = await tx.query<{ id: string; name: string; email: string; status: 'invited'; created_at: Date }>(
          `INSERT INTO app.users (
             id, org_id, email, email_verified_at, name, role, password_hash, status, must_reset_password, counted_against_cap_at
           ) VALUES ($1, $2, $3, NULL, $4, 'candidate', NULL, 'invited', true, NULL)
           RETURNING id, name, email, status, created_at`,
          [candidateId, orgId, candidateEmail, candidateName],
        );

        const createdUser = userRes.rows[0]!;

        await tx.query(
          `INSERT INTO app.invitations (
             id, org_id, user_id, email, role, token_hash, expires_at
           ) VALUES (gen_random_uuid(), $1, $2, $3, 'candidate', $4, $5)`,
          [orgId, candidateId, candidateEmail, tokenHash, expiresAt],
        );

        await appendAuditEvent(tx, {
          actorId: actor.userId,
          actorRole: actor.role,
          orgId,
          action: 'candidate.invited',
          entity: 'candidate',
          entityId: candidateId,
          after: {
            name: candidateName,
            email: candidateEmail,
            role: 'candidate',
          },
          ip: meta.ip ?? null,
          userAgent: meta.userAgent ?? null,
          requestId: meta.requestId ?? null,
        });

        return {
          id: createdUser.id,
          name: createdUser.name,
          email: createdUser.email,
          status: createdUser.status,
          countedAgainstCapAt: null,
          createdAt: createdUser.created_at.toISOString(),
        };
      });
    } finally {
      client.release();
    }

    await this.mailService.sendInvitationEmail({
      to: candidateEmail,
      token: rawToken,
      role: 'candidate',
      orgName,
      orgId,
    });

    return candidate;
  }

  async list(actor: UserContext): Promise<CandidateDto[]> {
    const orgId = actor.orgId;
    if (!orgId) {
      throw problem({
        title: 'Forbidden',
        status: 403,
        detail: 'User does not belong to an organization',
        code: 'TENANT_REQUIRED',
      });
    }

    const client = await this.pool.connect();
    try {
      return await withOrg(client, orgId, async (tx) => {
        const res = await tx.query<{
          id: string;
          name: string;
          email: string;
          status: 'invited' | 'active' | 'deleted';
          counted_against_cap_at: Date | null;
          created_at: Date;
        }>(
          `SELECT id, name, email, status, counted_against_cap_at, created_at
           FROM app.users
           WHERE org_id = $1 AND role = 'candidate' AND status != 'deleted'
           ORDER BY created_at DESC`,
          [orgId],
        );

        return res.rows.map((row) => ({
          id: row.id,
          name: row.name,
          email: row.email,
          status: row.status,
          countedAgainstCapAt: row.counted_against_cap_at
            ? row.counted_against_cap_at.toISOString()
            : null,
          createdAt: row.created_at.toISOString(),
        }));
      });
    } finally {
      client.release();
    }
  }

  async findAll(
    filters: { search?: string | undefined; status?: string | undefined; page?: number | undefined; limit?: number | undefined },
    actor: UserContext,
  ): Promise<{ items: CandidateDto[]; total: number; page: number; limit: number; totalPages: number }> {
    const orgId = actor.orgId;
    if (!orgId) {
      throw problem({
        title: 'Forbidden',
        status: 403,
        detail: 'User does not belong to an organization',
        code: 'TENANT_REQUIRED',
      });
    }

    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filters.limit) || 10));
    const offset = (page - 1) * limit;

    const client = await this.pool.connect();
    try {
      return await withOrg(client, orgId, async (tx) => {
        const conditions: string[] = ["org_id = $1", "role = 'candidate'", "status != 'deleted'"];
        const values: unknown[] = [orgId];
        let paramIdx = 2;

        if (filters.search && filters.search.trim()) {
          const sanitizedSearch = filters.search.trim().replace(/[%_\\]/g, '\\$&');
          conditions.push(`(name ILIKE $${paramIdx} ESCAPE '\\' OR email ILIKE $${paramIdx} ESCAPE '\\')`);
          values.push(`%${sanitizedSearch}%`);
          paramIdx++;
        }

        if (filters.status && filters.status.trim() !== '' && filters.status.trim().toLowerCase() !== 'all') {
          conditions.push(`status = $${paramIdx}`);
          values.push(filters.status.trim().toLowerCase());
          paramIdx++;
        }

        const whereClause = conditions.join(' AND ');

        const countRes = await tx.query<{ count: string }>(
          `SELECT count(*)::text as count FROM app.users WHERE ${whereClause}`,
          values,
        );
        const total = Number.parseInt(countRes.rows[0]?.count || '0', 10);

        const summaryRes = await tx.query<{
          total_count: string;
          invited_count: string;
          active_count: string;
        }>(
          `SELECT
             count(*)::text as total_count,
             count(*) FILTER (WHERE status = 'invited' OR status = 'suspended')::text as invited_count,
             count(*) FILTER (WHERE status = 'active')::text as active_count
           FROM app.users
           WHERE org_id = $1 AND role = 'candidate' AND status != 'deleted'`,
          [orgId],
        );

        const dataRes = await tx.query<{
          id: string;
          name: string;
          email: string;
          status: 'invited' | 'active' | 'suspended' | 'deleted';
          counted_against_cap_at: Date | null;
          created_at: Date;
        }>(
          `SELECT id, name, email, status, counted_against_cap_at, created_at
           FROM app.users
           WHERE ${whereClause}
           ORDER BY created_at DESC, id DESC
           LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
          [...values, limit, offset],
        );

        const items: CandidateDto[] = dataRes.rows.map((row) => ({
          id: row.id,
          name: row.name,
          email: row.email,
          status: row.status === 'suspended' ? 'invited' : (row.status as 'invited' | 'active' | 'deleted'),
          countedAgainstCapAt: row.counted_against_cap_at ? row.counted_against_cap_at.toISOString() : null,
          createdAt: row.created_at.toISOString(),
        }));

        return {
          items,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
          metrics: {
            total: Number.parseInt(summaryRes.rows[0]?.total_count || '0', 10),
            invited: Number.parseInt(summaryRes.rows[0]?.invited_count || '0', 10),
            active: Number.parseInt(summaryRes.rows[0]?.active_count || '0', 10),
          },
        };
      });
    } finally {
      client.release();
    }
  }

  async bulkCreate(
    payload: { candidates: CreateCandidateDto[] },
    actor: UserContext,
    meta: RequestMeta,
  ): Promise<{
    created: CandidateDto[];
    errors: { row: number; rowNumber: number; name: string; email: string; reason: string }[];
  }> {
    const created: CandidateDto[] = [];
    const errors: { row: number; rowNumber: number; name: string; email: string; reason: string }[] = [];

    for (let i = 0; i < payload.candidates.length; i++) {
      const candidateDto = payload.candidates[i]!;
      try {
        const res = await this.create(candidateDto, actor, meta);
        created.push(res as CandidateDto);
      } catch (err: any) {
        errors.push({
          row: i + 1,
          rowNumber: i + 1,
          name: candidateDto.name,
          email: candidateDto.email,
          reason: err?.detail || err?.message || 'Failed to import candidate',
        });
      }
    }

    return { created, errors };
  }

  /**
   * S1-T05-2: Streaming Bulk Candidate CSV parser & error validation pipeline.
   *
   * Features:
   * - Incremental processing over a Node.js Readable stream.
   * - O(U) memory footprint where U is unique emails tracked in seenEmailsInUpload (bounded by 1MB upload limit).
   * - Respects stream backpressure via sequential async iteration.
   * - Enforces UTF-8 BOM stripping, CRLF normalization, whitespace trimming, and 4KB max row size.
   * - Deterministic in-file duplicate detection (reports DUPLICATE_EMAIL_IN_FILE for repeated emails).
   * - Row-level validation errors (missing name/email, invalid email format, field length).
   * - Partial success: Valid rows are persisted and committed independently; invalid rows do not abort the pipeline.
   * - Reuses S1-T05-1 candidate creation, cryptographic token generation, and post-commit email delivery.
   * - Bounded response: Returns aggregate counts, up to 100 error samples (with errorsTruncated flag), and up to 50 created samples.
   */
  async processBulkCsvStream(
    input: Readable | Buffer | string,
    defaultAssessmentId: string | undefined,
    actor: UserContext,
    meta: RequestMeta,
  ): Promise<BulkCandidateUploadResult> {
    const orgId = actor.orgId;
    if (!orgId) {
      throw problem({
        title: 'Forbidden',
        status: 403,
        detail: 'User does not belong to an organization',
        code: 'TENANT_REQUIRED',
      });
    }

    // Verify default assessment lifecycle if provided
    if (defaultAssessmentId) {
      const client = await this.pool.connect();
      try {
        await withOrg(client, orgId, async (tx) => {
          const assessmentRes = await tx.query<{ id: string; name: string; org_id: string; status: string }>(
            `SELECT id, name, org_id, status FROM app.assessments WHERE id = $1 AND org_id = $2`,
            [defaultAssessmentId, orgId],
          );
          const assessment = assessmentRes.rows[0];
          if (!assessment) {
            throw problem({
              title: 'Not Found',
              status: 404,
              detail: 'Assessment not found in your organization',
              code: 'ASSESSMENT_NOT_FOUND',
            });
          }
          if (assessment.status !== 'published') {
            throw problem({
              title: 'Unprocessable Entity',
              status: 422,
              detail: `Assessment is in '${assessment.status}' status and cannot accept candidate assignments. Only published assessments can receive candidate invitations.`,
              code: 'ASSESSMENT_NOT_PUBLISHED',
            });
          }
        });
      } finally {
        client.release();
      }
    }

    const stream =
      input && typeof (input as any).pipe === 'function'
        ? (input as Readable)
        : Readable.from(Buffer.isBuffer(input) || typeof input === 'string' ? input : '');

    const MAX_ERROR_SAMPLE = 100;
    const MAX_CREATED_SAMPLE = 50;

    let totalRows = 0;
    let processedRows = 0;
    let successfulRows = 0;
    let failedRows = 0;
    let errorsTruncated = false;

    const errors: BulkCandidateRowError[] = [];
    const createdSample: BulkCandidateCreatedSample[] = [];
    const seenEmailsInUpload = new Set<string>();

    for await (const row of parseCsvStream(stream)) {
      totalRows++;
      processedRows++;

      // 1. Syntactic / structural parsing error on this row
      if (row.error) {
        failedRows++;
        if (errors.length < MAX_ERROR_SAMPLE) {
          errors.push({
            rowNumber: row.rowNumber,
            field: row.error.field,
            code: row.error.code,
            message: row.error.message,
          });
        } else {
          errorsTruncated = true;
        }
        continue;
      }

      const email = row.email!;
      const name = row.name!;
      const targetAssessmentId = row.assessmentId || defaultAssessmentId;

      // 2. In-file duplicate detection (O(1) lookup per row, bounded by 1MB upload limit)
      if (seenEmailsInUpload.has(email)) {
        failedRows++;
        if (errors.length < MAX_ERROR_SAMPLE) {
          errors.push({
            rowNumber: row.rowNumber,
            field: 'email',
            code: 'DUPLICATE_EMAIL_IN_FILE',
            message: `Row ${row.rowNumber}: Email '${email}' appears multiple times in the uploaded CSV file`,
          });
        } else {
          errorsTruncated = true;
        }
        continue;
      }
      seenEmailsInUpload.add(email);

      // 3. Process candidate & assignment persistence using S1-T05-1 logic
      try {
        const result = await this.create(
          {
            name,
            email,
            assessment_id: targetAssessmentId,
          },
          actor,
          meta,
        );

        successfulRows++;
        if (createdSample.length < MAX_CREATED_SAMPLE) {
          const isAssignment = 'candidateId' in result;
          createdSample.push({
            rowNumber: row.rowNumber,
            candidateId: isAssignment ? (result as CandidateAssignmentDto).candidateId : result.id,
            name: result.name,
            email: result.email,
            assignmentId: isAssignment ? result.id : undefined,
            status: result.status,
            deliveryStatus: (result as any).deliveryStatus ?? 'sent',
          });
        }
      } catch (err: any) {
        failedRows++;
        const errCode =
          err?.response?.code ||
          err?.code ||
          (err?.status === 409 ? 'CANDIDATE_ALREADY_ASSIGNED' : 'ROW_PROCESSING_FAILED');
        const errDetail =
          err?.response?.detail || err?.message || 'Failed to process candidate row';

        if (errors.length < MAX_ERROR_SAMPLE) {
          errors.push({
            rowNumber: row.rowNumber,
            field: 'email',
            code: errCode,
            message: `Row ${row.rowNumber}: ${errDetail}`,
          });
        } else {
          errorsTruncated = true;
        }
      }
    }

    return {
      totalRows,
      processedRows,
      successfulRows,
      failedRows,
      errorsTruncated,
      errors,
      createdSample,
    };
  }

  async update(
    candidateId: string,
    dto: { name?: string | undefined; email?: string | undefined },
    actor: UserContext,
    meta: RequestMeta,
  ): Promise<CandidateDto> {
    const orgId = actor.orgId;
    if (!orgId) {
      throw problem({
        title: 'Forbidden',
        status: 403,
        detail: 'User does not belong to an organization',
        code: 'TENANT_REQUIRED',
      });
    }

    const client = await this.pool.connect();
    try {
      return await withOrg(client, orgId, async (tx) => {
        const findRes = await tx.query<{
          id: string;
          name: string;
          email: string;
          status: 'invited' | 'active' | 'suspended';
          created_at: Date;
        }>(
          `SELECT id, name, email, status, created_at FROM app.users WHERE id = $1 AND org_id = $2 AND role = 'candidate'`,
          [candidateId, orgId],
        );

        if (findRes.rowCount === 0) {
          throw problem({
            title: 'Not Found',
            status: 404,
            detail: 'Candidate not found in your organization',
            code: 'CANDIDATE_NOT_FOUND',
          });
        }

        const candidate = findRes.rows[0]!;

        if (dto.email && dto.email.trim().toLowerCase() !== candidate.email && candidate.status === 'active') {
          throw problem({
            title: 'Conflict',
            status: 409,
            detail: 'Cannot change email of an active candidate with an existing session account',
            code: 'EMAIL_CHANGE_FORBIDDEN',
          });
        }

        const newName = dto.name?.trim() || candidate.name;
        const newEmail = dto.email?.trim().toLowerCase() || candidate.email;

        const updateRes = await tx.query<{
          id: string;
          name: string;
          email: string;
          status: 'invited' | 'active' | 'suspended';
          counted_against_cap_at: Date | null;
          created_at: Date;
        }>(
          `UPDATE app.users SET name = $1, email = $2 WHERE id = $3 AND org_id = $4 RETURNING id, name, email, status, counted_against_cap_at, created_at`,
          [newName, newEmail, candidateId, orgId],
        );

        const updated = updateRes.rows[0]!;

        await appendAuditEvent(tx, {
          actorId: actor.userId,
          actorRole: actor.role,
          orgId,
          action: 'candidate.updated',
          entity: 'candidate',
          entityId: candidateId,
          before: { name: candidate.name, email: candidate.email },
          after: { name: updated.name, email: updated.email },
          ip: meta.ip ?? null,
          userAgent: meta.userAgent ?? null,
          requestId: meta.requestId ?? null,
        });

        return {
          id: updated.id,
          name: updated.name,
          email: updated.email,
          status: updated.status === 'suspended' ? 'invited' : (updated.status as 'invited' | 'active' | 'deleted'),
          countedAgainstCapAt: updated.counted_against_cap_at ? updated.counted_against_cap_at.toISOString() : null,
          createdAt: updated.created_at.toISOString(),
        };
      });
    } finally {
      client.release();
    }
  }

  async delete(
    candidateId: string,
    actor: UserContext,
    meta: RequestMeta,
  ): Promise<{ success: boolean; message: string }> {
    const orgId = actor.orgId;
    if (!orgId) {
      throw problem({
        title: 'Forbidden',
        status: 403,
        detail: 'User does not belong to an organization',
        code: 'TENANT_REQUIRED',
      });
    }

    const client = await this.pool.connect();
    try {
      return await withOrg(client, orgId, async (tx) => {
        const findRes = await tx.query<{ id: string; email: string }>(
          `SELECT id, email FROM app.users WHERE id = $1 AND org_id = $2 AND role = 'candidate' AND status != 'deleted'`,
          [candidateId, orgId],
        );

        if (findRes.rowCount === 0) {
          throw problem({
            title: 'Not Found',
            status: 404,
            detail: 'Candidate not found',
            code: 'CANDIDATE_NOT_FOUND',
          });
        }

        await tx.query(
          `UPDATE app.users SET status = 'deleted', deleted_at = now() WHERE id = $1 AND org_id = $2`,
          [candidateId, orgId],
        );

        await tx.query(
          `DELETE FROM app.invitations WHERE user_id = $1 AND org_id = $2`,
          [candidateId, orgId],
        );

        await appendAuditEvent(tx, {
          actorId: actor.userId,
          actorRole: actor.role,
          orgId,
          action: 'candidate.deleted',
          entity: 'candidate',
          entityId: candidateId,
          after: { status: 'deleted' },
          ip: meta.ip ?? null,
          userAgent: meta.userAgent ?? null,
          requestId: meta.requestId ?? null,
        });

        return { success: true, message: 'Candidate soft-deleted successfully' };
      });
    } finally {
      client.release();
    }
  }

  async resendInvite(
    candidateId: string,
    assignmentId: string | undefined,
    actor: UserContext,
    meta: RequestMeta = {},
  ): Promise<{ success: boolean; deliveryStatus: 'sent' | 'failed'; processedAt: string }> {
    const orgId = actor.orgId;
    if (!orgId) {
      throw problem({
        title: 'Forbidden',
        status: 403,
        detail: 'User does not belong to an organization',
        code: 'TENANT_REQUIRED',
      });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest();
    const issuedAt = new Date();
    // Invariant: 0014_assignments.sql requires invite_expires_at <= invite_issued_at + interval '7 days'
    const expiresAt = new Date(issuedAt.getTime() + 7 * 24 * 60 * 60 * 1000);

    const client = await this.pool.connect();
    let candidateEmail = '';
    let orgName = 'HelloSmart Organization';
    let assessmentDispatch: { assessmentId: string; assessmentName: string } | null = null;

    try {
      await withOrg(client, orgId, async (tx) => {
        // 1. Validate candidate user existence, role, status and tenant ownership (BR-01)
        const userRes = await tx.query<{ id: string; email: string; name: string; status: string; must_reset_password: boolean }>(
          `SELECT id, email, name, status, must_reset_password FROM app.users WHERE id = $1 AND org_id = $2 AND role = 'candidate' AND status != 'deleted'`,
          [candidateId, orgId],
        );

        if (userRes.rowCount === 0) {
          throw problem({
            title: 'Not Found',
            status: 404,
            detail: 'Candidate not found in your organization',
            code: 'CANDIDATE_NOT_FOUND',
          });
        }

        const candidateUser = userRes.rows[0]!;
        candidateEmail = candidateUser.email;

        const orgRes = await tx.query<{ name: string }>(
          `SELECT name FROM app.organizations WHERE id = $1`,
          [orgId],
        );
        if (orgRes.rows[0]) {
          orgName = orgRes.rows[0].name;
        }

        // 2. Query candidate's assessment assignment(s) for eligibility (BR-08, BR-12, 0012)
        let assignment: {
          id: string;
          assessment_id: string;
          status: string;
          first_connect_at: Date | null;
          assessment_name: string;
        };

        if (assignmentId) {
          // Explicit assignment lookup scoped by tenant and assignment ID (BR-01, 0012)
          const assignmentRes = await tx.query<{
            id: string;
            assessment_id: string;
            candidate_id: string;
            status: string;
            first_connect_at: Date | null;
            assessment_name: string;
          }>(
            `SELECT a.id, a.assessment_id, a.candidate_id, a.status, a.first_connect_at, asm.name as assessment_name
             FROM app.assignments a
             JOIN app.assessments asm ON asm.id = a.assessment_id AND asm.org_id = a.org_id
             WHERE a.id = $1 AND a.org_id = $2`,
            [assignmentId, orgId],
          );

          if (!assignmentRes.rowCount || assignmentRes.rowCount === 0) {
            throw problem({
              title: 'Not Found',
              status: 404,
              detail: 'Assessment assignment not found in your organization',
              code: 'ASSIGNMENT_NOT_FOUND',
            });
          }

          const found = assignmentRes.rows[0]!;
          if (found.candidate_id !== candidateId) {
            throw problem({
              title: 'Not Found',
              status: 404,
              detail: 'Assessment assignment not found for the specified candidate',
              code: 'ASSIGNMENT_NOT_FOUND',
            });
          }

          assignment = found;
        } else {
          // Backward compatibility: Query all candidate's assessment assignments (BR-01, BR-08, BR-12)
          const assignmentRes = await tx.query<{
            id: string;
            assessment_id: string;
            status: string;
            first_connect_at: Date | null;
            assessment_name: string;
          }>(
            `SELECT a.id, a.assessment_id, a.status, a.first_connect_at, asm.name as assessment_name
             FROM app.assignments a
             JOIN app.assessments asm ON asm.id = a.assessment_id AND asm.org_id = a.org_id
             WHERE a.candidate_id = $1 AND a.org_id = $2
             ORDER BY a.created_at DESC`,
            [candidateId, orgId],
          );

          if (!assignmentRes.rowCount || assignmentRes.rowCount === 0) {
            throw problem({
              title: 'Not Found',
              status: 404,
              detail: 'No assessment assignment found for this candidate in your organization',
              code: 'ASSIGNMENT_NOT_FOUND',
            });
          }

          if (assignmentRes.rowCount > 1) {
            throw problem({
              title: 'Conflict',
              status: 409,
              detail: 'Candidate has multiple assessment assignments. Please specify assignment_id.',
              code: 'AMBIGUOUS_ASSIGNMENT',
            });
          }

          assignment = assignmentRes.rows[0]!;
        }

        // Eligibility check: Pre-connect / unstarted states only (BR-08, BR-12, S1-T05-4)
        const eligibleStatuses = ['invited', 'window_not_open', 'ready', 'expired'];
        if (assignment.first_connect_at !== null || !eligibleStatuses.includes(assignment.status)) {
          throw problem({
            title: 'Conflict',
            status: 409,
            detail: `Cannot resend invitation for assessment in '${assignment.status}' status. Candidate has already started or submitted the assessment.`,
            code: 'ASSIGNMENT_ALREADY_CONNECTED',
          });
        }

        // Atomically rotate assignment invite token and reset used_at (0014_assignments.sql invariant)
        await tx.query(
          `UPDATE app.assignments
           SET invite_token_hash = $1,
               invite_issued_at = $2,
               invite_expires_at = $3,
               invite_used_at = NULL,
               status = CASE WHEN status = 'expired' THEN 'invited' ELSE status END
           WHERE id = $4 AND org_id = $5`,
          [tokenHash, issuedAt, expiresAt, assignment.id, orgId],
        );

        assessmentDispatch = {
          assessmentId: assignment.assessment_id,
          assessmentName: assignment.assessment_name,
        };

        // Append tamper-evident audit record (BR-31)
        await appendAuditEvent(tx, {
          actorId: actor.userId,
          actorRole: actor.role,
          orgId,
          action: 'candidate.invite_resent',
          entity: 'assignment',
          entityId: assignment.id,
          after: {
            candidateId,
            assignmentId: assignment.id,
            assessmentId: assignment.assessment_id,
            inviteIssuedAt: issuedAt.toISOString(),
            inviteExpiresAt: expiresAt.toISOString(),
          },
          ip: meta.ip ?? null,
          userAgent: meta.userAgent ?? null,
          requestId: meta.requestId ?? null,
        });
      });
    } finally {
      client.release();
    }

    // 3. Post-commit asynchronous email dispatch
    let deliveryStatus: 'sent' | 'failed' = 'sent';
    const dispatch = assessmentDispatch as { assessmentId: string; assessmentName: string } | null;
    if (dispatch) {
      try {
        await this.mailService.sendAssessmentInvitationEmail({
          to: candidateEmail,
          token: rawToken,
          orgName,
          orgId,
          assessmentId: dispatch.assessmentId,
          assessmentName: dispatch.assessmentName,
        });
      } catch (err) {
        deliveryStatus = 'failed';
        // Invariant: Email failure preserves committed database state
        this.logger.error(
          `Failed to send assessment invitation email for candidate ${candidateId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return {
      success: true,
      deliveryStatus,
      processedAt: issuedAt.toISOString(),
    };
  }

  /**
   * BR-06: Records a candidate's first workspace launch against the organization's candidate cap.
   *
   * Preconditions:
   * - The caller owns the database transaction (`tx: PoolClient`).
   * - Enforces the exact lock hierarchy:
   *   1. Organization entitlement row (`app.entitlements` FOR UPDATE).
   *   2. Candidate user row (`app.users` FOR UPDATE).
   *   3. Audit event insert (`audit.events`).
   * - If candidate is already counted, returns `{ newlyCounted: false, countedAt }` idempotently.
   * - If candidate is uncounted, calculates current launched candidate count against `max_candidates`.
   *   If at or exceeding cap, throws 403 `CANDIDATE_CAP_EXCEEDED`.
   * - If under cap, sets `counted_against_cap_at = now()` and emits append-only `candidate.cap_counted` audit event.
   */
  async recordCandidateFirstLaunch(
    tx: PoolClient,
    orgId: string,
    candidateUserId: string,
  ): Promise<{ newlyCounted: boolean; countedAt: Date }> {
    // 1. Organization Entitlement Serialization Lock (Lock Hierarchy Step 1, BR-05, BR-06)
    const entRes = await tx.query<{ max_candidates: number }>(
      `SELECT max_candidates
       FROM app.entitlements
       WHERE org_id = $1
       FOR UPDATE`,
      [orgId],
    );
    if (entRes.rowCount === 0) {
      throw problem({
        title: 'Forbidden',
        status: 403,
        detail: 'Organization entitlements record not found',
        code: 'ENTITLEMENTS_NOT_FOUND',
      });
    }
    const maxCandidates = Number(entRes.rows[0]!.max_candidates);

    // 2. Candidate user resolution and lock (Lock Hierarchy Step 2)
    const userRes = await tx.query<{
      id: string;
      role: string;
      status: string;
      deleted_at: Date | null;
      counted_against_cap_at: Date | null;
    }>(
      `SELECT id, role, status, deleted_at, counted_against_cap_at
       FROM app.users
       WHERE id = $1 AND org_id = $2
       FOR UPDATE`,
      [candidateUserId, orgId],
    );

    if (userRes.rowCount === 0) {
      throw problem({
        title: 'Not Found',
        status: 404,
        detail: 'Candidate not found in your organization',
        code: 'CANDIDATE_NOT_FOUND',
      });
    }

    const candidate = userRes.rows[0]!;
    if (candidate.role !== 'candidate' || candidate.status === 'deleted' || candidate.deleted_at !== null) {
      throw problem({
        title: 'Not Found',
        status: 404,
        detail: 'Candidate not found in your organization',
        code: 'CANDIDATE_NOT_FOUND',
      });
    }

    // Idempotent return if already counted
    if (candidate.counted_against_cap_at) {
      return {
        newlyCounted: false,
        countedAt: new Date(candidate.counted_against_cap_at),
      };
    }

    // 3. Count currently launched candidates against candidate cap
    const launchedRes = await tx.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count
       FROM app.users
       WHERE org_id = $1
         AND role = 'candidate'
         AND deleted_at IS NULL
         AND status != 'deleted'
         AND counted_against_cap_at IS NOT NULL`,
      [orgId],
    );
    const launchedCount = Number.parseInt(launchedRes.rows[0]?.count || '0', 10);

    if (launchedCount >= maxCandidates) {
      throw problem({
        title: 'Forbidden',
        status: 403,
        detail: 'Organization has reached its candidate cap limit',
        code: 'CANDIDATE_CAP_EXCEEDED',
      });
    }

    // 4. Atomically set counted_against_cap_at
    const updateRes = await tx.query<{ counted_against_cap_at: Date }>(
      `UPDATE app.users
       SET counted_against_cap_at = now()
       WHERE id = $1 AND org_id = $2
       RETURNING counted_against_cap_at`,
      [candidateUserId, orgId],
    );
    const countedAt = updateRes.rows[0]!.counted_against_cap_at;

    // 5. Append-only audit event (Lock Hierarchy Step 4, BR-31)
    await appendAuditEvent(tx, {
      actorId: candidateUserId,
      actorRole: 'candidate',
      orgId,
      action: 'candidate.cap_counted',
      entity: 'candidate',
      entityId: candidateUserId,
      after: {
        countedAgainstCapAt: countedAt.toISOString(),
      },
      ip: null,
      userAgent: null,
      requestId: null,
    });

    return {
      newlyCounted: true,
      countedAt,
    };
  }

  async getMetrics(actor: UserContext): Promise<CompanyMetricsDto> {
    const orgId = actor.orgId;
    if (!orgId) {
      throw problem({
        title: 'Forbidden',
        status: 403,
        detail: 'User does not belong to an organization',
        code: 'TENANT_REQUIRED',
      });
    }

    const client = await this.pool.connect();
    try {
      return await withOrg(client, orgId, async (tx) => {
        const candidateCountsRes = await tx.query<{ total: number; active: number }>(
          `SELECT
             count(*)::int AS total,
             count(*) FILTER (WHERE status = 'active')::int AS active
           FROM app.users
           WHERE org_id = $1 AND role = 'candidate' AND status != 'deleted'`,
          [orgId],
        );

        const invitedCandidates = Number(candidateCountsRes.rows[0]?.total ?? 0);
        const activeCandidates = Number(candidateCountsRes.rows[0]?.active ?? 0);

        const submissionsRes = await tx.query<{ count: string | number }>(
          `SELECT count(*)::int AS count
           FROM audit.events
           WHERE org_id = $1 AND action = 'assignment.submitted'`,
          [orgId],
        );
        const submissionsToReview = Number(submissionsRes.rows[0]?.count ?? 0);

        const entitlementsRes = await tx.query<{
          max_candidates: number;
          max_templates: number;
        }>(
          `SELECT max_candidates, max_templates
           FROM app.entitlements
           WHERE org_id = $1`,
          [orgId],
        );
        const maxCandidates = entitlementsRes.rows[0]?.max_candidates ?? 25;
        const remainingQuota = Math.max(0, maxCandidates - invitedCandidates);

        return {
          configuredAssessments: 1,
          invitedCandidates,
          activeCandidates,
          submissionsToReview,
          maxCandidates,
          remainingQuota,
        };
      });
    } finally {
      client.release();
    }
  }
}
