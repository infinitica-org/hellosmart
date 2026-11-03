import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import type pg from 'pg';
import { expect } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { UserContext } from '../../../src/common/types/user-context.js';
import { hashPassword } from '../../../src/modules/auth/password.js';
import { SessionService } from '../../../src/modules/session/session.service.js';
import { STORAGE_PORT } from '../../../src/common/storage/storage.tokens.js';
import type { StoragePort } from '../../../src/common/storage/storage.types.js';

export interface TestUserEntity {
  id: string;
  email: string;
  role: 'platform_admin' | 'company_admin' | 'candidate';
  orgId: string | null;
  status: string;
  rawPassword: string;
  userContext: UserContext;
  sessionToken: string;
  sessionId: string;
}

export interface SecurityTestContext {
  nonce: string;
  orgA: { id: string; slug: string; name: string };
  orgB: { id: string; slug: string; name: string };
  orgC_suspended: { id: string; slug: string; name: string };

  companyAdminA: TestUserEntity;
  candidateA: TestUserEntity;
  suspendedUserA: TestUserEntity;
  deletedUserA: TestUserEntity;

  companyAdminB: TestUserEntity;
  candidateB: TestUserEntity;

  companyAdminC: TestUserEntity; // active user in suspended org
  platformAdmin: TestUserEntity;

  templateA: { id: string; slug: string; versionId: string };
  templateB: { id: string; slug: string; versionId: string };

  assessmentA: { id: string; name: string };
  assessmentB: { id: string; name: string };

  storageAssignmentIdA: string;
  storageAssignmentIdB: string;
  storageObjectIdA: string;
  storageObjectIdB: string;
  storageKeyA: string;
  storageKeyB: string;

  trackedOrgIds: string[];
  trackedUserIds: string[];
  trackedTemplateIds: string[];
  trackedVersionIds: string[];
  trackedAssessmentIds: string[];
  allTenantBIdentifiers: string[];
}

export async function setupSecurityTestData(
  app: NestFastifyApplication,
  adminPool: pg.Pool,
): Promise<SecurityTestContext> {
  const nonce = crypto.randomBytes(4).toString('hex');
  const sessionService = app.get(SessionService);
  const storagePort = app.get<StoragePort>(STORAGE_PORT);

  const client = await adminPool.connect();
  try {
    // 1. Create Organizations
    const orgARes = await client.query(
      `INSERT INTO app.organizations (name, slug, status, created_by)
       VALUES ($1, $2, 'paid_active', '00000000-0000-4000-8000-000000000001')
       RETURNING id`,
      [`Sec Org Alpha ${nonce}`, `sec-alpha-${nonce}`],
    );
    const orgAId = orgARes.rows[0].id;

    const orgBRes = await client.query(
      `INSERT INTO app.organizations (name, slug, status, created_by)
       VALUES ($1, $2, 'paid_active', '00000000-0000-4000-8000-000000000001')
       RETURNING id`,
      [`Sec Org Beta ${nonce}`, `sec-beta-${nonce}`],
    );
    const orgBId = orgBRes.rows[0].id;

    const orgCRes = await client.query(
      `INSERT INTO app.organizations (name, slug, status, created_by)
       VALUES ($1, $2, 'suspended', '00000000-0000-4000-8000-000000000001')
       RETURNING id`,
      [`Sec Org Suspended ${nonce}`, `sec-susp-${nonce}`],
    );
    const orgCId = orgCRes.rows[0].id;

    // 2. Create Entitlements
    await client.query(
      `INSERT INTO app.entitlements (org_id, max_templates, max_candidates)
       VALUES ($1, 10, 50), ($2, 10, 50), ($3, 10, 50)`,
      [orgAId, orgBId, orgCId],
    );

    // 3. User Seed Helper
    async function createUser(
      orgId: string | null,
      emailPrefix: string,
      role: 'platform_admin' | 'company_admin' | 'candidate',
      status: 'active' | 'suspended' | 'deleted' = 'active',
    ): Promise<TestUserEntity> {
      const email = `${emailPrefix}.${nonce}@example.test`;
      const rawPassword = crypto.randomBytes(16).toString('hex') + 'Aa1!';
      const pwdHash = await hashPassword(rawPassword);

      const userRes = await client.query(
        `INSERT INTO app.users (org_id, email, name, role, status, must_reset_password, password_hash)
         VALUES ($1, $2, $3, $4, $5, false, $6)
         RETURNING id`,
        [orgId, email, `User ${emailPrefix} ${nonce}`, role, status, pwdHash],
      );
      const userId = userRes.rows[0].id;

      await client.query(
        `INSERT INTO app.password_history (user_id, password_hash)
         VALUES ($1, $2)`,
        [userId, pwdHash],
      );

      const userContext: UserContext = {
        userId,
        email,
        role,
        orgId,
      };

      const session = await sessionService.createSession(userContext);

      return {
        id: userId,
        email,
        role,
        orgId,
        status,
        rawPassword,
        userContext,
        sessionToken: session.rawToken,
        sessionId: session.sessionId,
      };
    }

    const companyAdminA = await createUser(orgAId, 'admin.a', 'company_admin', 'active');
    const candidateA = await createUser(orgAId, 'candidate.a', 'candidate', 'active');
    const suspendedUserA = await createUser(orgAId, 'suspended.a', 'company_admin', 'suspended');
    const deletedUserA = await createUser(orgAId, 'deleted.a', 'company_admin', 'deleted');

    const companyAdminB = await createUser(orgBId, 'admin.b', 'company_admin', 'active');
    const candidateB = await createUser(orgBId, 'candidate.b', 'candidate', 'active');

    const companyAdminC = await createUser(orgCId, 'admin.c', 'company_admin', 'active');
    const platformAdmin = await createUser(null, 'superadmin.sec', 'platform_admin', 'active');

    // 4. Seed Templates and Draft Versions (BR-02, BR-03)
    const tARes = await client.query(
      `INSERT INTO app.templates (slug, name, category, difficulty, workspace_mode, description)
       VALUES ($1, $2, 'Engineering', 'Intermediate', 'cloud', 'Test Template Alpha')
       RETURNING id`,
      [`sec-tpl-a-${nonce}`, `Sec Template Alpha ${nonce}`],
    );
    const templateAId = tARes.rows[0].id;

    const tBRes = await client.query(
      `INSERT INTO app.templates (slug, name, category, difficulty, workspace_mode, description)
       VALUES ($1, $2, 'Design', 'Beginner', 'cloud', 'Test Template Beta')
       RETURNING id`,
      [`sec-tpl-b-${nonce}`, `Sec Template Beta ${nonce}`],
    );
    const templateBId = tBRes.rows[0].id;

    const vARes = await client.query(
      `INSERT INTO app.template_versions (template_id, version, status, manifest)
       VALUES ($1, '1.0.0', 'draft', '{"title": "Sec Version A"}'::jsonb)
       RETURNING id`,
      [templateAId],
    );
    const versionAId = vARes.rows[0].id;

    const vBRes = await client.query(
      `INSERT INTO app.template_versions (template_id, version, status, manifest)
       VALUES ($1, '1.0.0', 'draft', '{"title": "Sec Version B"}'::jsonb)
       RETURNING id`,
      [templateBId],
    );
    const versionBId = vBRes.rows[0].id;

    // 5. Template Assignments (Org A to Template A, Org B to Template B)
    await client.query(
      `INSERT INTO app.template_assignments (template_id, org_id)
       VALUES ($1, $2), ($3, $4)`,
      [templateAId, orgAId, templateBId, orgBId],
    );

    // 6. Assessments
    const aARes = await client.query(
      `INSERT INTO app.assessments (org_id, template_version_id, name, workspace_mode, status)
       VALUES ($1, $2, $3, 'cloud', 'draft')
       RETURNING id`,
      [orgAId, versionAId, `Assessment Alpha ${nonce}`],
    );
    const assessmentAId = aARes.rows[0].id;

    const aBRes = await client.query(
      `INSERT INTO app.assessments (org_id, template_version_id, name, workspace_mode, status)
       VALUES ($1, $2, $3, 'cloud', 'draft')
       RETURNING id`,
      [orgBId, versionBId, `Assessment Beta ${nonce}`],
    );
    const assessmentBId = aBRes.rows[0].id;

    // 7. Seed Storage Objects
    const storageAssignmentIdA = crypto.randomUUID();
    const storageAssignmentIdB = crypto.randomUUID();
    const storageObjectIdA = crypto.randomUUID();
    const storageObjectIdB = crypto.randomUUID();

    const storageKeyA = `storage/${orgAId}/submissions/${storageAssignmentIdA}/${storageObjectIdA}-deliverable.zip`;
    const storageKeyB = `storage/${orgBId}/submissions/${storageAssignmentIdB}/${storageObjectIdB}-deliverable.zip`;

    if (storagePort) {
      await storagePort.put(
        storageKeyA,
        Readable.from(Buffer.from('alpha-confidential-submission-payload')),
        { filename: 'deliverable.zip', contentType: 'application/zip' },
      );
      await storagePort.put(
        storageKeyB,
        Readable.from(Buffer.from('beta-confidential-submission-payload')),
        { filename: 'deliverable.zip', contentType: 'application/zip' },
      );
    }

    const orgA = { id: orgAId, slug: `sec-alpha-${nonce}`, name: `Sec Org Alpha ${nonce}` };
    const orgB = { id: orgBId, slug: `sec-beta-${nonce}`, name: `Sec Org Beta ${nonce}` };
    const orgC_suspended = {
      id: orgCId,
      slug: `sec-susp-${nonce}`,
      name: `Sec Org Suspended ${nonce}`,
    };

    const trackedOrgIds = [orgAId, orgBId, orgCId];
    const trackedUserIds = [
      companyAdminA.id,
      candidateA.id,
      suspendedUserA.id,
      deletedUserA.id,
      companyAdminB.id,
      candidateB.id,
      companyAdminC.id,
      platformAdmin.id,
    ];
    const trackedTemplateIds = [templateAId, templateBId];
    const trackedVersionIds = [versionAId, versionBId];
    const trackedAssessmentIds = [assessmentAId, assessmentBId];

    const allTenantBIdentifiers = [
      orgB.id,
      orgB.slug,
      orgB.name,
      companyAdminB.id,
      companyAdminB.email,
      candidateB.id,
      candidateB.email,
      templateBId,
      `sec-tpl-b-${nonce}`,
      versionBId,
      assessmentBId,
      `Assessment Beta ${nonce}`,
      storageAssignmentIdB,
      storageObjectIdB,
    ];

    return {
      nonce,
      orgA,
      orgB,
      orgC_suspended,
      companyAdminA,
      candidateA,
      suspendedUserA,
      deletedUserA,
      companyAdminB,
      candidateB,
      companyAdminC,
      platformAdmin,
      templateA: { id: templateAId, slug: `sec-tpl-a-${nonce}`, versionId: versionAId },
      templateB: { id: templateBId, slug: `sec-tpl-b-${nonce}`, versionId: versionBId },
      assessmentA: { id: assessmentAId, name: `Assessment Alpha ${nonce}` },
      assessmentB: { id: assessmentBId, name: `Assessment Beta ${nonce}` },
      storageAssignmentIdA,
      storageAssignmentIdB,
      storageObjectIdA,
      storageObjectIdB,
      storageKeyA,
      storageKeyB,
      trackedOrgIds,
      trackedUserIds,
      trackedTemplateIds,
      trackedVersionIds,
      trackedAssessmentIds,
      allTenantBIdentifiers,
    };
  } finally {
    client.release();
  }
}

export async function teardownSecurityTestData(
  ctx: SecurityTestContext,
  adminPool: pg.Pool,
): Promise<void> {
  const client = await adminPool.connect();
  try {
    await client.query('BEGIN');

    // 1. Delete Assessments
    if (ctx.trackedOrgIds.length > 0) {
      await client.query('DELETE FROM app.assessments WHERE org_id = ANY($1::uuid[])', [
        ctx.trackedOrgIds,
      ]);
    }

    // 2. Delete Template Assignments
    if (ctx.trackedOrgIds.length > 0) {
      await client.query('DELETE FROM app.template_assignments WHERE org_id = ANY($1::uuid[])', [
        ctx.trackedOrgIds,
      ]);
    }

    // 3. Delete Template Versions and Templates (use replica mode for safety)
    await client.query('SET LOCAL session_replication_role = replica');
    if (ctx.trackedVersionIds.length > 0) {
      await client.query('DELETE FROM app.template_versions WHERE id = ANY($1::uuid[])', [
        ctx.trackedVersionIds,
      ]);
    }
    if (ctx.trackedTemplateIds.length > 0) {
      await client.query('DELETE FROM app.templates WHERE id = ANY($1::uuid[])', [
        ctx.trackedTemplateIds,
      ]);
    }
    await client.query('SET LOCAL session_replication_role = origin');

    // 4. Delete MFA backup codes and Password History
    if (ctx.trackedUserIds.length > 0) {
      await client.query('DELETE FROM app.mfa_backup_codes WHERE user_id = ANY($1::uuid[])', [
        ctx.trackedUserIds,
      ]);
      await client.query('DELETE FROM app.password_history WHERE user_id = ANY($1::uuid[])', [
        ctx.trackedUserIds,
      ]);
    }

    // 5. Delete Invitations
    if (ctx.trackedOrgIds.length > 0) {
      await client.query('DELETE FROM app.invitations WHERE org_id = ANY($1::uuid[])', [
        ctx.trackedOrgIds,
      ]);
    }

    // 6. Delete Users
    if (ctx.trackedUserIds.length > 0) {
      await client.query('DELETE FROM app.users WHERE id = ANY($1::uuid[])', [ctx.trackedUserIds]);
    }

    // 7. Delete Entitlements
    if (ctx.trackedOrgIds.length > 0) {
      await client.query('DELETE FROM app.entitlements WHERE org_id = ANY($1::uuid[])', [
        ctx.trackedOrgIds,
      ]);
    }

    // 8. Delete Organizations
    if (ctx.trackedOrgIds.length > 0) {
      await client.query('DELETE FROM app.organizations WHERE id = ANY($1::uuid[])', [
        ctx.trackedOrgIds,
      ]);
    }

    await client.query('COMMIT');

    // Post-cleanup assertions: verify 0 rows remain across all affected tables
    const tablesWithOrg = [
      'app.assessments',
      'app.template_assignments',
      'app.invitations',
      'app.entitlements',
      'app.organizations',
    ];
    for (const table of tablesWithOrg) {
      const col = table === 'app.organizations' ? 'id' : 'org_id';
      const checkRes = await client.query(
        `SELECT COUNT(*)::int AS cnt FROM ${table} WHERE ${col} = ANY($1::uuid[])`,
        [ctx.trackedOrgIds],
      );
      expect(checkRes.rows[0].cnt).toBe(0);
    }

    const checkTemplates = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM app.templates WHERE id = ANY($1::uuid[])`,
      [ctx.trackedTemplateIds],
    );
    expect(checkTemplates.rows[0].cnt).toBe(0);

    const checkVersions = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM app.template_versions WHERE id = ANY($1::uuid[])`,
      [ctx.trackedVersionIds],
    );
    expect(checkVersions.rows[0].cnt).toBe(0);

    const checkUsers = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM app.users WHERE id = ANY($1::uuid[])`,
      [ctx.trackedUserIds],
    );
    expect(checkUsers.rows[0].cnt).toBe(0);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw new Error(
      `teardownSecurityTestData failed for orgs [${ctx.trackedOrgIds.join(', ')}]: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  } finally {
    client.release();
  }
}
