import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import type {
  AssessmentDetailDto,
  AssessmentSummaryDto,
  BriefOverrides,
  CreateAssessmentDto,
} from '@hs/contracts';

export interface DbAssessmentRow {
  id: string;
  org_id: string;
  template_version_id: string;
  name: string;
  workspace_mode: 'cloud' | 'chat';
  status: 'draft' | 'dry_run_passed' | 'published' | 'closed' | 'archived';
  brief_overrides: any;
  ai_policy: any;
  timing: any;
  env_refs: any;
  dry_run_passed_at: Date | null;
  release_results_default: boolean;
  created_at: Date;
  updated_at: Date;
  template_slug?: string;
  template_name?: string;
  template_version?: string;
  candidate_count?: number;
}

@Injectable()
export class AssessmentsRepository {
  /**
   * Find target template version ensuring template is explicitly assigned to orgId (BR-02, BR-03).
   */
  async findAssignedTemplateVersion(
    client: PoolClient,
    orgId: string,
    templateIdOrSlug: string,
    explicitVersionId?: string,
  ): Promise<{
    templateId: string;
    templateSlug: string;
    templateVersionId: string;
    version: string;
    manifest: any;
  } | null> {
    let query: string;
    let params: any[];

    if (explicitVersionId) {
      query = `
        SELECT
          t.id AS "templateId",
          t.slug AS "templateSlug",
          tv.id AS "templateVersionId",
          tv.version,
          tv.manifest
        FROM app.templates t
        INNER JOIN app.template_assignments ta
          ON ta.template_id = t.id AND ta.org_id = $1
        INNER JOIN app.template_versions tv
          ON tv.template_id = t.id AND tv.id = $2
        LIMIT 1
      `;
      params = [orgId, explicitVersionId];
    } else {
      query = `
        SELECT
          t.id AS "templateId",
          t.slug AS "templateSlug",
          tv.id AS "templateVersionId",
          tv.version,
          tv.manifest
        FROM app.templates t
        INNER JOIN app.template_assignments ta
          ON ta.template_id = t.id AND ta.org_id = $1
        INNER JOIN app.template_versions tv
          ON tv.template_id = t.id AND tv.status = 'published'
        WHERE (t.id::text = $2 OR t.slug = $2)
        ORDER BY tv.created_at DESC
        LIMIT 1
      `;
      params = [orgId, templateIdOrSlug];
    }

    const res = await client.query(query, params);
    if (res.rowCount === 0) {
      return null;
    }
    return res.rows[0];
  }

  /**
   * Insert a new assessment pinned to a template_version_id (BR-01, BR-03).
   */
  async createAssessment(
    client: PoolClient,
    orgId: string,
    templateVersionId: string,
    dto: CreateAssessmentDto,
  ): Promise<string> {
    const query = `
      INSERT INTO app.assessments (
        org_id,
        template_version_id,
        name,
        workspace_mode,
        brief_overrides,
        ai_policy,
        timing,
        release_results_default
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;
    const res = await client.query(query, [
      orgId,
      templateVersionId,
      dto.name,
      dto.workspaceMode,
      JSON.stringify(dto.briefOverrides ?? {}),
      JSON.stringify(dto.aiPolicy ?? {}),
      JSON.stringify(dto.timing ?? {}),
      dto.releaseResultsDefault ?? false,
    ]);
    return res.rows[0].id;
  }

  /**
   * List assessments for caller organization (BR-01).
   */
  async listByOrg(
    client: PoolClient,
    orgId: string,
  ): Promise<AssessmentSummaryDto[]> {
    const query = `
      SELECT
        a.id,
        a.org_id AS "orgId",
        t.slug AS "templateId",
        a.template_version_id AS "templateVersionId",
        tv.version AS "templateVersion",
        a.name,
        a.workspace_mode AS "workspaceMode",
        a.status,
        a.timing,
        a.dry_run_passed_at AS "dryRunPassedAt",
        a.created_at AS "createdAt",
        a.updated_at AS "updatedAt"
      FROM app.assessments a
      INNER JOIN app.template_versions tv ON tv.id = a.template_version_id
      INNER JOIN app.templates t ON t.id = tv.template_id
      WHERE a.org_id = $1
      ORDER BY a.created_at DESC
    `;
    const res = await client.query(query, [orgId]);

    return res.rows.map((row) => ({
      id: row.id,
      orgId: row.orgId,
      templateId: row.templateId,
      templateVersionId: row.templateVersionId,
      templateVersion: row.templateVersion,
      name: row.name,
      workspaceMode: row.workspaceMode,
      status: row.status,
      timing: row.timing,
      candidateCount: 0,
      dryRunPassedAt: row.dryRunPassedAt ? new Date(row.dryRunPassedAt).toISOString() : null,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    }));
  }

  /**
   * Get single assessment detail scoped strictly to orgId (BR-01).
   */
  async findById(
    client: PoolClient,
    orgId: string,
    assessmentId: string,
  ): Promise<AssessmentDetailDto | null> {
    const query = `
      SELECT
        a.id,
        a.org_id AS "orgId",
        t.slug AS "templateId",
        a.template_version_id AS "templateVersionId",
        tv.version AS "templateVersion",
        tv.manifest,
        a.name,
        a.workspace_mode AS "workspaceMode",
        a.status,
        a.brief_overrides AS "briefOverrides",
        a.ai_policy AS "aiPolicy",
        a.timing,
        a.env_refs AS "envRefs",
        a.dry_run_passed_at AS "dryRunPassedAt",
        a.release_results_default AS "releaseResultsDefault",
        a.created_at AS "createdAt",
        a.updated_at AS "updatedAt"
      FROM app.assessments a
      INNER JOIN app.template_versions tv ON tv.id = a.template_version_id
      INNER JOIN app.templates t ON t.id = tv.template_id
      WHERE a.id = $1 AND a.org_id = $2
      LIMIT 1
    `;
    const res = await client.query(query, [assessmentId, orgId]);
    if (res.rowCount === 0) {
      return null;
    }

    const row = res.rows[0];
    const manifest = row.manifest || {};
    const briefOverrides = row.briefOverrides || {};

    const effectiveBrief = {
      scenario: briefOverrides.scenario || manifest.brief || '',
      instructions: briefOverrides.instructions || manifest.brief || '',
      deliverables:
        briefOverrides.deliverables && briefOverrides.deliverables.length > 0
          ? briefOverrides.deliverables
          : ['Working code adhering to provided requirements and test suite'],
    };

    return {
      id: row.id,
      orgId: row.orgId,
      templateId: row.templateId,
      templateVersionId: row.templateVersionId,
      templateVersion: row.templateVersion,
      name: row.name,
      workspaceMode: row.workspaceMode,
      status: row.status,
      briefOverrides,
      aiPolicy: row.aiPolicy,
      timing: row.timing,
      envRefs: Array.isArray(row.envRefs) ? row.envRefs : [],
      releaseResultsDefault: row.releaseResultsDefault,
      effectiveBrief,
      candidateCount: 0,
      dryRunPassedAt: row.dryRunPassedAt ? new Date(row.dryRunPassedAt).toISOString() : null,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    };
  }

  /**
   * Update candidate instructions and deliverables overrides (Ticket S1-T02-2).
   */
  async updateBriefOverrides(
    client: PoolClient,
    orgId: string,
    assessmentId: string,
    overrides: BriefOverrides,
  ): Promise<boolean> {
    const query = `
      UPDATE app.assessments
      SET brief_overrides = $1, updated_at = now()
      WHERE id = $2 AND org_id = $3
    `;
    const res = await client.query(query, [JSON.stringify(overrides), assessmentId, orgId]);
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Update rubric configuration in brief_overrides (BR-01, BR-18).
   */
  async updateRubric(
    client: PoolClient,
    orgId: string,
    assessmentId: string,
    dimensions: any[],
  ): Promise<boolean> {
    const query = `
      UPDATE app.assessments
      SET brief_overrides = jsonb_set(
        COALESCE(brief_overrides, '{}'::jsonb),
        '{rubric}',
        $1::jsonb
      ),
      updated_at = now()
      WHERE id = $2 AND org_id = $3
    `;
    const res = await client.query(query, [JSON.stringify(dimensions), assessmentId, orgId]);
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Count active assessments for org entitlement limit check (BR-05).
   */
  async countByOrg(client: PoolClient, orgId: string): Promise<number> {
    const query = `
      SELECT COUNT(*)::int AS count
      FROM app.assessments
      WHERE org_id = $1 AND status NOT IN ('archived')
    `;
    const res = await client.query(query, [orgId]);
    return res.rows[0]?.count ?? 0;
  }
}
