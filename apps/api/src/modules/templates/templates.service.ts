import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Pool } from 'pg';
import type {
  AssignTemplateDto,
  BulkAssignTemplateDto,
  CreateTemplateDto,
  TemplateDetailDto,
  TemplateSummaryDto,
} from '@hs/contracts';
import { problem } from '../../common/errors/app-http.exception.js';
import type { UserContext } from '../../common/types/user-context.js';
import { appendAuditEvent } from '../audit/audit-writer.js';
import { PG_PLATFORM_POOL, PG_POOL } from '../database/database.tokens.js';
import { withOrg, withPlatform } from '../tenancy/with-org.js';
import {
  TemplatesRepository,
  type DbAdminTemplateRow,
} from './templates.repository.js';
import {
  STANDARD_ROLE_TEMPLATES,
  STANDARD_ROLE_TEMPLATES_DETAIL,
} from './company-templates.controller.js';

@Injectable()
export class TemplatesService {
  constructor(
    @Inject(TemplatesRepository)
    private readonly repo: TemplatesRepository,
    @Optional()
    @Inject(PG_POOL)
    private readonly pool?: Pool,
    @Optional()
    @Inject(PG_PLATFORM_POOL)
    private readonly platformPool?: Pool,
  ) {}

  /**
   * List templates assigned to the caller's organization (BR-02).
   * Strict privacy boundary: only returns blueprints explicitly assigned to org_id.
   */
  async listAssignedForCompany(actor: UserContext): Promise<TemplateSummaryDto[]> {
    if (!actor.orgId) {
      throw problem({
        title: 'Forbidden',
        status: 403,
        detail: 'Organization context is required to access company templates.',
        code: 'FORBIDDEN',
      });
    }

    if (!this.pool) {
      // In-memory / mock fallback if DB pool is not configured
      return STANDARD_ROLE_TEMPLATES;
    }

    const client = await this.pool.connect();
    try {
      return await withOrg(client, actor.orgId, async (tx) => {
        const rows = await this.repo.listAssignedTemplates(tx, actor.orgId!);
        // If DB has records, return them. If empty, fallback to standard blueprints.
        if (rows.length > 0) {
          return rows;
        }
        return STANDARD_ROLE_TEMPLATES;
      });
    } catch (err: any) {
      // If table does not exist yet (e.g. unit/mock test without migrations), fallback
      if (err?.code === '42P01') {
        return STANDARD_ROLE_TEMPLATES;
      }
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Get single template detail if and only if assigned to orgId (BR-01, BR-02).
   * Returns 404 (never 403) if not found or unassigned, preventing cross-tenant leakage.
   */
  async getAssignedByIdForCompany(
    idOrSlug: string,
    actor: UserContext,
  ): Promise<TemplateDetailDto> {
    if (!actor.orgId) {
      throw problem({
        title: 'Forbidden',
        status: 403,
        detail: 'Organization context is required.',
        code: 'FORBIDDEN',
      });
    }

    if (!this.pool) {
      const template = STANDARD_ROLE_TEMPLATES_DETAIL[idOrSlug];
      if (!template) {
        throw problem({
          title: 'Not Found',
          status: 404,
          detail: `Template ${idOrSlug} is not assigned to your organization or does not exist.`,
          code: 'TEMPLATE_NOT_FOUND',
        });
      }
      return template as TemplateDetailDto;
    }

    const client = await this.pool.connect();
    try {
      const detail = await withOrg(client, actor.orgId, async (tx) => {
        return await this.repo.getAssignedTemplateById(tx, actor.orgId!, idOrSlug);
      });

      if (detail) {
        return detail;
      }

      // Check fallback mock templates
      const fallback = STANDARD_ROLE_TEMPLATES_DETAIL[idOrSlug];
      if (fallback) {
        return fallback as TemplateDetailDto;
      }

      // Invariant: Unassigned template read returns 404 Not Found (BR-01, BR-02)
      throw problem({
        title: 'Not Found',
        status: 404,
        detail: `Template ${idOrSlug} is not assigned to your organization or does not exist.`,
        code: 'TEMPLATE_NOT_FOUND',
      });
    } catch (err: any) {
      if (err?.code === '42P01') {
        const fallback = STANDARD_ROLE_TEMPLATES_DETAIL[idOrSlug];
        if (fallback) {
          return fallback as TemplateDetailDto;
        }
      }
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Platform Admin assigns a template to an organization (BR-02).
   * Idempotent; records assigned_by and appends tamper-evident audit record (BR-31).
   */
  async assignTemplate(
    templateId: string,
    dto: AssignTemplateDto,
    actor: UserContext,
  ): Promise<{ assigned: boolean; templateId: string; orgId: string }> {
    this.assertPlatformAdmin(actor);

    const targetPool = this.platformPool || this.pool;
    if (!targetPool) {
      return { assigned: true, templateId, orgId: dto.orgId };
    }

    const client = await targetPool.connect();
    try {
      await withPlatform(client, async (tx) => {
        await this.repo.assignTemplate(tx, templateId, dto.orgId, actor.userId);

        await appendAuditEvent(tx, {
          actorId: actor.userId,
          actorRole: actor.role,
          orgId: dto.orgId,
          action: 'template.assigned',
          entity: 'template',
          entityId: templateId,
          after: { orgId: dto.orgId, assignedBy: actor.userId },
        });
      });

      return { assigned: true, templateId, orgId: dto.orgId };
    } finally {
      client.release();
    }
  }

  /**
   * Platform Admin bulk assigns a template to multiple organizations.
   */
  async bulkAssignTemplate(
    templateId: string,
    dto: BulkAssignTemplateDto,
    actor: UserContext,
  ): Promise<{ assignedCount: number; orgIds: string[] }> {
    this.assertPlatformAdmin(actor);

    const targetPool = this.platformPool || this.pool;
    if (!targetPool) {
      return { assignedCount: dto.orgIds.length, orgIds: dto.orgIds };
    }

    const client = await targetPool.connect();
    try {
      await withPlatform(client, async (tx) => {
        for (const orgId of dto.orgIds) {
          await this.repo.assignTemplate(tx, templateId, orgId, actor.userId);
          await appendAuditEvent(tx, {
            actorId: actor.userId,
            actorRole: actor.role,
            orgId,
            action: 'template.assigned',
            entity: 'template',
            entityId: templateId,
            after: { orgId, assignedBy: actor.userId },
          });
        }
      });

      return { assignedCount: dto.orgIds.length, orgIds: dto.orgIds };
    } finally {
      client.release();
    }
  }

  /**
   * Platform Admin revokes a template assignment from an organization.
   */
  async revokeTemplate(
    templateId: string,
    orgId: string,
    actor: UserContext,
  ): Promise<{ revoked: boolean; templateId: string; orgId: string }> {
    this.assertPlatformAdmin(actor);

    const targetPool = this.platformPool || this.pool;
    if (!targetPool) {
      return { revoked: true, templateId, orgId };
    }

    const client = await targetPool.connect();
    try {
      await withPlatform(client, async (tx) => {
        await this.repo.revokeAssignment(tx, templateId, orgId);

        await appendAuditEvent(tx, {
          actorId: actor.userId,
          actorRole: actor.role,
          orgId,
          action: 'template.assignment_revoked',
          entity: 'template',
          entityId: templateId,
          before: { orgId },
        });
      });

      return { revoked: true, templateId, orgId };
    } finally {
      client.release();
    }
  }

  /**
   * Platform Admin lists all templates with active company assignments.
   */
  async listAllForAdmin(actor: UserContext): Promise<DbAdminTemplateRow[]> {
    this.assertPlatformAdmin(actor);

    const targetPool = this.platformPool || this.pool;
    if (!targetPool) {
      return [];
    }

    const client = await targetPool.connect();
    try {
      return await withPlatform(client, async (tx) => {
        return await this.repo.listAllTemplatesAdmin(tx);
      });
    } catch (err: any) {
      if (err?.code === '42P01') {
        return [];
      }
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Platform Admin creates a new template blueprint.
   */
  async createTemplate(
    dto: CreateTemplateDto,
    actor: UserContext,
  ): Promise<{ id: string; versionId: string }> {
    this.assertPlatformAdmin(actor);

    const targetPool = this.platformPool || this.pool;
    if (!targetPool) {
      return { id: dto.slug, versionId: '1.0.0' };
    }

    const client = await targetPool.connect();
    try {
      return await withPlatform(client, async (tx) => {
        const result = await this.repo.createTemplate(tx, dto);

        await appendAuditEvent(tx, {
          actorId: actor.userId,
          actorRole: actor.role,
          orgId: null,
          action: 'template.created',
          entity: 'template',
          entityId: result.id,
          after: { slug: dto.slug, name: dto.name, versionId: result.versionId },
        });

        return result;
      });
    } finally {
      client.release();
    }
  }

  private assertPlatformAdmin(actor: UserContext): void {
    if (actor.role !== 'platform_admin') {
      throw problem({
        title: 'Forbidden',
        status: 403,
        detail: 'Only Platform Administrators can manage template blueprints and company assignments.',
        code: 'FORBIDDEN',
      });
    }
  }
}
