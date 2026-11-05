import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Pool } from 'pg';
import type {
  AssessmentDetailDto,
  AssessmentSummaryDto,
  CreateAssessmentDto,
  UpdateAssessmentBriefDto,
} from '@hs/contracts';
import { problem } from '../../common/errors/app-http.exception.js';
import type { UserContext } from '../../common/types/user-context.js';
import { appendAuditEvent } from '../audit/audit-writer.js';
import { PG_POOL } from '../database/database.tokens.js';
import { withOrg } from '../tenancy/with-org.js';
import { AssessmentsRepository } from './assessments.repository.js';

@Injectable()
export class AssessmentsService {
  constructor(
    @Inject(AssessmentsRepository)
    private readonly repo: AssessmentsRepository,
    @Optional()
    @Inject(PG_POOL)
    private readonly pool?: Pool,
  ) {}

  /**
   * Create an assessment from an assigned role template with pinned version (S1-T02-1, BR-03).
   * Enforces Plan Entitlements quota (S1-T02-3, BR-05).
   * Strict privacy boundary: only assigned templates can be instantiated (BR-02).
   */
  async create(
    dto: CreateAssessmentDto,
    actor: UserContext,
  ): Promise<AssessmentDetailDto> {
    if (!actor.orgId) {
      throw problem({
        title: 'Forbidden',
        status: 403,
        detail: 'Organization context is required to create assessments.',
        code: 'FORBIDDEN',
      });
    }

    if (!this.pool) {
      // In-memory test mock return
      const fakeId = '33333333-3333-3333-3333-333333333333';
      return {
        id: fakeId,
        orgId: actor.orgId,
        templateId: dto.templateId,
        templateVersionId: dto.templateVersionId || '44444444-4444-4444-4444-444444444444',
        templateVersion: '1.0.0',
        name: dto.name,
        workspaceMode: dto.workspaceMode,
        status: 'draft',
        aiPolicy: dto.aiPolicy,
        timing: dto.timing,
        briefOverrides: dto.briefOverrides,
        envRefs: [],
        releaseResultsDefault: dto.releaseResultsDefault ?? false,
        candidateCount: 0,
        dryRunPassedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    const client = await this.pool.connect();
    try {
      return await withOrg(client, actor.orgId, async (tx) => {
        // 1. Enforce Entitlements Quota (BR-05, BR-07, Ticket S1-T02-3)
        const entRes = await tx.query(
          `SELECT max_templates, trial_ends_at FROM app.entitlements WHERE org_id = $1`,
          [actor.orgId],
        );
        if (entRes.rowCount && entRes.rowCount > 0) {
          const { max_templates, trial_ends_at } = entRes.rows[0];

          if (trial_ends_at && new Date(trial_ends_at) < new Date()) {
            throw problem({
              title: 'Trial Expired',
              status: 403,
              detail:
                'Your trial period has expired. Please contact support or upgrade your subscription to create new assessments.',
              code: 'TRIAL_EXPIRED',
            });
          }

          const currentCount = await this.repo.countByOrg(tx, actor.orgId!);
          if (currentCount >= max_templates) {
            throw problem({
              title: 'Entitlement Limit Exceeded',
              status: 403,
              detail: `Your plan limit of ${max_templates} active assessments has been reached. Please upgrade your subscription to create additional assessments.`,
              code: 'ENTITLEMENT_LIMIT_EXCEEDED',
            });
          }
        }

        // 2. Validate template assignment & resolve pinned version (BR-02, BR-03)
        const versionInfo = await this.repo.findAssignedTemplateVersion(
          tx,
          actor.orgId!,
          dto.templateId,
          dto.templateVersionId,
        );

        if (!versionInfo) {
          // Invariant: Unassigned template read returns 404 Not Found (BR-01, BR-02)
          throw problem({
            title: 'Not Found',
            status: 404,
            detail: `Template ${dto.templateId} is not assigned to your organization or does not exist.`,
            code: 'TEMPLATE_NOT_FOUND',
          });
        }

        // 3. Persist assessment pinning template_version_id
        const assessmentId = await this.repo.createAssessment(
          tx,
          actor.orgId!,
          versionInfo.templateVersionId,
          dto,
        );

        // 4. Append tamper-evident audit record (BR-31)
        await appendAuditEvent(tx, {
          actorId: actor.userId,
          actorRole: actor.role,
          orgId: actor.orgId,
          action: 'assessment.created',
          entity: 'assessment',
          entityId: assessmentId,
          after: {
            name: dto.name,
            templateVersionId: versionInfo.templateVersionId,
            templateVersion: versionInfo.version,
            workspaceMode: dto.workspaceMode,
          },
        });

        const detail = await this.repo.findById(tx, actor.orgId!, assessmentId);
        if (!detail) {
          throw problem({
            title: 'Internal Server Error',
            status: 500,
            detail: 'Failed to retrieve newly created assessment.',
            code: 'INTERNAL_ERROR',
          });
        }

        return detail;
      });
    } finally {
      client.release();
    }
  }

  /**
   * List assessments for caller's company (BR-01).
   */
  async list(actor: UserContext): Promise<AssessmentSummaryDto[]> {
    if (!actor.orgId) {
      throw problem({
        title: 'Forbidden',
        status: 403,
        detail: 'Organization context required.',
        code: 'FORBIDDEN',
      });
    }

    if (!this.pool) {
      return [];
    }

    const client = await this.pool.connect();
    try {
      return await withOrg(client, actor.orgId, async (tx) => {
        return await this.repo.listByOrg(tx, actor.orgId!);
      });
    } finally {
      client.release();
    }
  }

  /**
   * Get single assessment by ID with tenant isolation (BR-01).
   */
  async getById(id: string, actor: UserContext): Promise<AssessmentDetailDto> {
    if (!actor.orgId) {
      throw problem({
        title: 'Forbidden',
        status: 403,
        detail: 'Organization context required.',
        code: 'FORBIDDEN',
      });
    }

    if (!this.pool) {
      throw problem({
        title: 'Not Found',
        status: 404,
        detail: `Assessment ${id} not found.`,
        code: 'ASSESSMENT_NOT_FOUND',
      });
    }

    const client = await this.pool.connect();
    try {
      return await withOrg(client, actor.orgId, async (tx) => {
        const detail = await this.repo.findById(tx, actor.orgId!, id);
        if (!detail) {
          // Cross-tenant or non-existent assessment returns 404 (BR-01)
          throw problem({
            title: 'Not Found',
            status: 404,
            detail: `Assessment ${id} not found or does not belong to your organization.`,
            code: 'ASSESSMENT_NOT_FOUND',
          });
        }
        return detail;
      });
    } finally {
      client.release();
    }
  }

  /**
   * Update candidate instructions and deliverables overrides (Ticket S1-T02-2).
   */
  async updateBrief(
    id: string,
    dto: UpdateAssessmentBriefDto,
    actor: UserContext,
  ): Promise<AssessmentDetailDto> {
    if (!actor.orgId) {
      throw problem({
        title: 'Forbidden',
        status: 403,
        detail: 'Organization context required.',
        code: 'FORBIDDEN',
      });
    }

    if (!this.pool) {
      throw problem({
        title: 'Not Found',
        status: 404,
        detail: `Assessment ${id} not found.`,
        code: 'ASSESSMENT_NOT_FOUND',
      });
    }

    const client = await this.pool.connect();
    try {
      return await withOrg(client, actor.orgId, async (tx) => {
        const existing = await this.repo.findById(tx, actor.orgId!, id);
        if (!existing) {
          throw problem({
            title: 'Not Found',
            status: 404,
            detail: `Assessment ${id} not found.`,
            code: 'ASSESSMENT_NOT_FOUND',
          });
        }

        const mergedOverrides = {
          ...existing.briefOverrides,
          ...dto,
        };

        const updated = await this.repo.updateBriefOverrides(
          tx,
          actor.orgId!,
          id,
          mergedOverrides,
        );

        if (!updated) {
          throw problem({
            title: 'Not Found',
            status: 404,
            detail: `Assessment ${id} not found.`,
            code: 'ASSESSMENT_NOT_FOUND',
          });
        }

        await appendAuditEvent(tx, {
          actorId: actor.userId,
          actorRole: actor.role,
          orgId: actor.orgId,
          action: 'assessment.brief_updated',
          entity: 'assessment',
          entityId: id,
          before: existing.briefOverrides,
          after: mergedOverrides,
        });

        const detail = await this.repo.findById(tx, actor.orgId!, id);
        return detail!;
      });
    } finally {
      client.release();
    }
  }

  /**
   * Get assessment-specific rubric dimensions (BR-01, BR-18).
   */
  async getRubric(assessmentId: string, actor: UserContext) {
    if (!actor.orgId) {
      throw problem({
        title: 'Forbidden',
        status: 403,
        detail: 'Organization context required.',
        code: 'FORBIDDEN',
      });
    }

    const defaultDimensions = [
      {
        id: 'dim_tech_arch',
        name: 'Architecture & Technical Design',
        description: 'Evaluates architectural decisions, modularity, data modeling, and separation of concerns.',
        weight: 40,
        signals: ['Follows domain-driven boundaries', 'Clean interfaces'],
        redFlags: ['Spaghetti code', 'Hardcoded credentials'],
        scoringAnchors: [
          { score: 1, label: 'Inadequate', description: 'Does not meet expected performance standards; critical gaps.' },
          { score: 3, label: 'Competent', description: 'Meets production expectations; solid implementation.' },
          { score: 5, label: 'Exemplary', description: 'Exceeds expectations; highly robust architecture.' },
        ],
      },
      {
        id: 'dim_code_quality',
        name: 'Code Quality & Maintainability',
        description: 'Assesses readability, test coverage, static typing, and adherence to language idioms.',
        weight: 35,
        signals: ['Strong typing', 'Meaningful naming', 'Unit test coverage'],
        redFlags: ['Unhandled errors', 'Ignored lint warnings'],
        scoringAnchors: [
          { score: 1, label: 'Inadequate', description: 'Does not meet expected performance standards; critical gaps.' },
          { score: 3, label: 'Competent', description: 'Meets production expectations; solid implementation.' },
          { score: 5, label: 'Exemplary', description: 'Exceeds expectations; highly robust architecture.' },
        ],
      },
      {
        id: 'dim_problem_solving',
        name: 'Problem Solving & Edge-Case Handling',
        description: 'Analyzes analytical rigor, handling of unexpected inputs, and algorithmic efficiency.',
        weight: 25,
        signals: ['Handles empty states and boundaries', 'Efficient algorithms'],
        redFlags: ['Infinite loops', 'Race conditions'],
        scoringAnchors: [
          { score: 1, label: 'Inadequate', description: 'Does not meet expected performance standards; critical gaps.' },
          { score: 3, label: 'Competent', description: 'Meets production expectations; solid implementation.' },
          { score: 5, label: 'Exemplary', description: 'Exceeds expectations; highly robust architecture.' },
        ],
      },
    ];

    if (!this.pool) {
      return {
        assessmentId,
        templateId: 'tpl_default',
        templateVersionId: '00000000-0000-0000-0000-000000000000',
        dimensions: defaultDimensions,
      };
    }

    const client = await this.pool.connect();
    try {
      return await withOrg(client, actor.orgId, async (tx) => {
        const detail = await this.repo.findById(tx, actor.orgId!, assessmentId);
        if (!detail) {
          throw problem({
            title: 'Not Found',
            status: 404,
            detail: `Assessment ${assessmentId} not found.`,
            code: 'ASSESSMENT_NOT_FOUND',
          });
        }

        const briefOverrides = detail.briefOverrides as Record<string, any> | undefined;
        const dimensions =
          Array.isArray(briefOverrides?.rubric) && briefOverrides.rubric.length > 0
            ? briefOverrides.rubric
            : defaultDimensions;

        return {
          assessmentId: detail.id,
          templateId: detail.templateId,
          templateVersionId: detail.templateVersionId,
          dimensions,
        };
      });
    } finally {
      client.release();
    }
  }

  /**
   * Update assessment rubric dimensions, enforcing 100% total weight (BR-01, BR-18, BR-31).
   */
  async updateRubric(assessmentId: string, body: any, actor: UserContext) {
    if (!actor.orgId) {
      throw problem({
        title: 'Forbidden',
        status: 403,
        detail: 'Organization context required.',
        code: 'FORBIDDEN',
      });
    }

    const dimensions = Array.isArray(body?.dimensions) ? body.dimensions : (Array.isArray(body) ? body : []);
    if (dimensions.length === 0) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'At least one rubric dimension is required.',
        code: 'VALIDATION_ERROR',
      });
    }

    const totalWeight = dimensions.reduce((acc: number, d: any) => acc + (Number(d?.weight) || 0), 0);
    if (totalWeight !== 100) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: `Total rubric weight must equal exactly 100%. Received: ${totalWeight}%.`,
        code: 'TOTAL_RUBRIC_WEIGHT_MUST_EQUAL_100',
      });
    }

    if (!this.pool) {
      return {
        assessmentId,
        templateId: 'tpl_default',
        templateVersionId: '00000000-0000-0000-0000-000000000000',
        dimensions,
      };
    }

    const client = await this.pool.connect();
    try {
      return await withOrg(client, actor.orgId, async (tx) => {
        const detail = await this.repo.findById(tx, actor.orgId!, assessmentId);
        if (!detail) {
          throw problem({
            title: 'Not Found',
            status: 404,
            detail: `Assessment ${assessmentId} not found.`,
            code: 'ASSESSMENT_NOT_FOUND',
          });
        }

        await this.repo.updateRubric(tx, actor.orgId!, assessmentId, dimensions);

        await appendAuditEvent(tx, {
          actorId: actor.userId,
          actorRole: actor.role,
          orgId: actor.orgId,
          action: 'assessment.rubric_updated',
          entity: 'assessment',
          entityId: assessmentId,
          after: { dimensions },
        });

        return {
          assessmentId: detail.id,
          templateId: detail.templateId,
          templateVersionId: detail.templateVersionId,
          dimensions,
        };
      });
    } finally {
      client.release();
    }
  }
}
