import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import type {
  CreateTemplateDto,
  TemplateDetailDto,
  TemplateSummaryDto,
} from '@hs/contracts';

export interface DbTemplateRow {
  id: string;
  slug: string;
  name: string;
  category: string;
  difficulty: string;
  workspace_mode: 'cloud' | 'chat';
  description: string;
  tags: string[];
  created_at: Date;
  updated_at: Date;
}

export interface DbTemplateVersionRow {
  id: string;
  template_id: string;
  version: string;
  status: 'draft' | 'tested' | 'published';
  manifest: any;
  created_at: Date;
  published_at: Date | null;
}

export interface DbAdminTemplateRow {
  id: string;
  slug: string;
  name: string;
  category: string;
  difficulty: string;
  workspaceMode: 'cloud' | 'chat';
  description: string;
  tags: string[];
  assignedOrgsCount: number;
  versionsCount: number;
  latestVersion: string | null;
  createdAt: Date;
}

@Injectable()
export class TemplatesRepository {
  /**
   * List templates assigned to the given organization (BR-02).
   */
  async listAssignedTemplates(
    client: PoolClient,
    orgId: string,
  ): Promise<TemplateSummaryDto[]> {
    const query = `
      SELECT
        t.id,
        t.slug,
        t.name,
        t.category,
        t.difficulty,
        t.workspace_mode AS "workspaceMode",
        t.description,
        t.tags,
        tv.id AS "templateVersionId",
        tv.version AS "versionId",
        tv.status,
        tv.manifest
      FROM app.templates t
      INNER JOIN app.template_assignments ta
        ON ta.template_id = t.id AND ta.org_id = $1
      LEFT JOIN app.template_versions tv
        ON tv.template_id = t.id AND tv.status = 'published'
      ORDER BY t.name ASC
    `;
    const res = await client.query(query, [orgId]);

    return res.rows.map((row) => {
      const manifest = row.manifest || {};
      const durationMinutes =
        manifest.timing_default?.duration_minutes ??
        (row.workspaceMode === 'chat' ? 45 : 90);

      return {
        id: row.slug || row.id,
        versionId: row.versionId || '1.0.0',
        name: row.name,
        category: row.category,
        difficulty: row.difficulty,
        durationMinutes,
        workspaceMode: row.workspaceMode,
        description: row.description,
        tags: Array.isArray(row.tags) ? row.tags : [],
        status: (row.status as any) || 'published',
        isAssigned: true,
      };
    });
  }

  /**
   * Get single template detail if and only if assigned to orgId (BR-01, BR-02).
   * Returns null if not found or not assigned.
   */
  async getAssignedTemplateById(
    client: PoolClient,
    orgId: string,
    idOrSlug: string,
  ): Promise<TemplateDetailDto | null> {
    const query = `
      SELECT
        t.id,
        t.slug,
        t.name,
        t.category,
        t.difficulty,
        t.workspace_mode AS "workspaceMode",
        t.description,
        t.tags,
        t.created_at AS "createdAt",
        t.updated_at AS "updatedAt",
        tv.id AS "templateVersionId",
        tv.version AS "versionId",
        tv.status,
        tv.manifest
      FROM app.templates t
      INNER JOIN app.template_assignments ta
        ON ta.template_id = t.id AND ta.org_id = $1
      LEFT JOIN app.template_versions tv
        ON tv.template_id = t.id AND tv.status = 'published'
      WHERE (t.id::text = $2 OR t.slug = $2)
      LIMIT 1
    `;
    const res = await client.query(query, [orgId, idOrSlug]);
    if (res.rowCount === 0) {
      return null;
    }

    const row = res.rows[0];
    const manifest = row.manifest || {};
    const durationMinutes =
      manifest.timing_default?.duration_minutes ??
      (row.workspaceMode === 'chat' ? 45 : 90);

    const rubricPreview = Array.isArray(manifest.reviewers)
      ? manifest.reviewers.map((rev: string, idx: number) => ({
          dimension: rev,
          weight: Math.round(100 / manifest.reviewers.length),
          description: `Evaluates candidate performance on ${rev}`,
        }))
      : [];

    return {
      id: row.slug || row.id,
      versionId: row.versionId || '1.0.0',
      name: row.name,
      category: row.category,
      difficulty: row.difficulty,
      durationMinutes,
      workspaceMode: row.workspaceMode,
      description: row.description,
      tags: Array.isArray(row.tags) ? row.tags : [],
      status: row.status || 'published',
      isAssigned: true,
      manifest,
      candidateBrief: manifest.brief || row.description,
      scenario: manifest.brief || row.description,
      rubricPreview,
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : undefined,
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : undefined,
    };
  }

  /**
   * Assign a template to an organization (Platform Admin only, BR-02).
   */
  async assignTemplate(
    client: PoolClient,
    templateIdOrSlug: string,
    orgId: string,
    assignedBy?: string,
  ): Promise<{ assigned: boolean; templateId: string; orgId: string }> {
    // Resolve template id
    const tplQuery = `SELECT id FROM app.templates WHERE id::text = $1 OR slug = $1 LIMIT 1`;
    const tplRes = await client.query(tplQuery, [templateIdOrSlug]);
    if (tplRes.rowCount === 0) {
      return { assigned: false, templateId: templateIdOrSlug, orgId };
    }
    const realTemplateId = tplRes.rows[0].id;

    const assignQuery = `
      INSERT INTO app.template_assignments (template_id, org_id, assigned_at)
      VALUES ($1, $2, now())
      ON CONFLICT (template_id, org_id) DO NOTHING
      RETURNING template_id
    `;
    await client.query(assignQuery, [realTemplateId, orgId]);
    return { assigned: true, templateId: realTemplateId, orgId };
  }

  /**
   * Revoke template assignment from an organization (Platform Admin only).
   */
  async revokeAssignment(
    client: PoolClient,
    templateIdOrSlug: string,
    orgId: string,
  ): Promise<boolean> {
    const query = `
      DELETE FROM app.template_assignments
      WHERE (template_id::text = $1 OR template_id IN (SELECT id FROM app.templates WHERE slug = $1))
        AND org_id = $2
    `;
    const res = await client.query(query, [templateIdOrSlug, orgId]);
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Platform Admin: List all templates across the platform with assignment counts.
   */
  async listAllTemplatesAdmin(client: PoolClient): Promise<DbAdminTemplateRow[]> {
    const query = `
      SELECT
        t.id,
        t.slug,
        t.name,
        t.category,
        t.difficulty,
        t.workspace_mode AS "workspaceMode",
        t.description,
        t.tags,
        COUNT(DISTINCT ta.org_id)::int AS "assignedOrgsCount",
        COUNT(DISTINCT tv.id)::int AS "versionsCount",
        MAX(tv.version) AS "latestVersion",
        t.created_at AS "createdAt"
      FROM app.templates t
      LEFT JOIN app.template_assignments ta ON ta.template_id = t.id
      LEFT JOIN app.template_versions tv ON tv.template_id = t.id
      GROUP BY t.id
      ORDER BY t.name ASC
    `;
    const res = await client.query(query);
    return res.rows;
  }

  /**
   * Create template and initial version (Platform Admin only).
   */
  async createTemplate(
    client: PoolClient,
    dto: CreateTemplateDto,
  ): Promise<{ id: string; versionId: string; slug: string }> {
    const insertTpl = `
      INSERT INTO app.templates (slug, name, category, difficulty, workspace_mode, description, tags)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, slug
    `;
    const tplRes = await client.query(insertTpl, [
      dto.slug,
      dto.name,
      dto.category,
      dto.difficulty,
      dto.workspaceMode,
      dto.description,
      dto.tags,
    ]);
    const templateId = tplRes.rows[0].id;

    const version = dto.initialManifest.version || '1.0.0';
    const insertVersion = `
      INSERT INTO app.template_versions (template_id, version, status, manifest, published_at)
      VALUES ($1, $2, 'published', $3, now())
      RETURNING id
    `;
    const verRes = await client.query(insertVersion, [
      templateId,
      version,
      JSON.stringify(dto.initialManifest),
    ]);

    return {
      id: templateId,
      versionId: verRes.rows[0].id,
      slug: tplRes.rows[0].slug,
    };
  }

  /**
   * Clone a template version (Platform Admin only, BR-03).
   */
  async cloneTemplateVersion(
    client: PoolClient,
    templateIdOrSlug: string,
    newVersion: string,
  ): Promise<{ id: string; templateId: string; version: string; status: string } | null> {
    const query = `
      SELECT t.id, tv.version, tv.manifest
      FROM app.templates t
      INNER JOIN app.template_versions tv ON tv.template_id = t.id
      WHERE (t.id::text = $1 OR t.slug = $1)
      ORDER BY tv.created_at DESC
      LIMIT 1
    `;
    const res = await client.query(query, [templateIdOrSlug]);
    if (res.rowCount === 0) {
      return null;
    }

    const { id: templateId, manifest } = res.rows[0];
    const clonedManifest = { ...manifest, version: newVersion };

    const insertQuery = `
      INSERT INTO app.template_versions (template_id, version, status, manifest)
      VALUES ($1, $2, 'draft', $3)
      RETURNING id, template_id AS "templateId", version, status
    `;
    const cloneRes = await client.query(insertQuery, [
      templateId,
      newVersion,
      JSON.stringify(clonedManifest),
    ]);
    return cloneRes.rows[0];
  }

  /**
   * Get latest version string for a template.
   */
  async getLatestVersion(
    client: PoolClient,
    templateIdOrSlug: string,
  ): Promise<string | null> {
    const query = `
      SELECT tv.version
      FROM app.templates t
      INNER JOIN app.template_versions tv ON tv.template_id = t.id
      WHERE (t.id::text = $1 OR t.slug = $1)
      ORDER BY tv.created_at DESC
      LIMIT 1
    `;
    const res = await client.query(query, [templateIdOrSlug]);
    return res.rows[0]?.version ?? null;
  }

  /**
   * Publish a draft version (Platform Admin only, BR-03).
   */
  async publishTemplateVersion(
    client: PoolClient,
    templateIdOrSlug: string,
    versionOrId: string,
  ): Promise<boolean> {
    const query = `
      UPDATE app.template_versions
      SET status = 'published', published_at = now()
      WHERE (template_id::text = $1 OR template_id IN (SELECT id FROM app.templates WHERE slug = $1))
        AND (version = $2 OR id::text = $2)
    `;
    const res = await client.query(query, [templateIdOrSlug, versionOrId]);
    return (res.rowCount ?? 0) > 0;
  }
}
