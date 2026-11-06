import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import {
  type CreatePlatformAiKeyDto,
  type UpdatePlatformAiKeyDto,
  type PlatformAiKeyDto,
  type CreateCreditAllocationDto,
  type AdjustCreditAllocationDto,
  type CreditAllocationDto,
  type PlatformAiVaultStatsDto,
  PlatformAiKeyDtoSchema,
  CreditAllocationDtoSchema,
  PlatformAiVaultStatsDtoSchema,
} from '@hs/contracts';
import { CryptoService } from '../../common/services/crypto.service.js';
import { PG_PLATFORM_POOL } from '../database/database.tokens.js';
import { problem } from '../../common/errors/app-http.exception.js';
import type { UserContext } from '../../common/types/user-context.js';
import type { RequestMeta } from '../auth/auth.service.js';
import { appendAuditEvent } from '../audit/audit-writer.js';
import { withPlatform } from '../tenancy/with-org.js';

export function formatMaskedKey(provider: string, last4: string): string {
  if (provider === 'anthropic') {
    return `sk-ant-...${last4}`;
  }
  if (provider === 'gemini') {
    return `AIza...${last4}`;
  }
  if (provider === 'deepseek') {
    return `sk-ds-...${last4}`;
  }
  return `sk-...${last4}`;
}

@Injectable()
export class AdminAiKeysService {
  constructor(
    @Inject(PG_PLATFORM_POOL) private readonly pool: Pool,
    @Inject(CryptoService) private readonly crypto: CryptoService,
  ) {}

  // ==========================================
  // 1. Platform AI Keys Vault Management
  // ==========================================

  async listKeys(): Promise<PlatformAiKeyDto[]> {
    const client = await this.pool.connect();
    try {
      return await withPlatform(client, async (tx) => {

        const sql = `
          SELECT
            k.id,
            k.provider,
            k.name,
            k.key_last4,
            k.status,
            k.is_active,
            k.description,
            k.last_tested_at,
            k.created_at,
            k.updated_at,
            COALESCE(SUM(a.allocated_amount_cents), 0)::int AS total_allocated_cents,
            COUNT(a.id) FILTER (WHERE a.status = 'active')::int AS active_allocations_count
          FROM app.platform_ai_keys k
          LEFT JOIN app.platform_credit_allocations a ON a.platform_key_id = k.id
          GROUP BY k.id
          ORDER BY k.created_at DESC;
        `;

        const res = await tx.query(sql);
        return res.rows.map((row) =>
          PlatformAiKeyDtoSchema.parse({
            id: row.id,
            provider: row.provider,
            name: row.name,
            maskedKey: formatMaskedKey(row.provider, row.key_last4),
            keyLast4: row.key_last4,
            status: row.status,
            isActive: Boolean(row.is_active),
            description: row.description || null,
            totalAllocatedCents: Number(row.total_allocated_cents || 0),
            activeAllocationsCount: Number(row.active_allocations_count || 0),
            lastTestedAt: row.last_tested_at ? new Date(row.last_tested_at).toISOString() : null,
            createdAt: new Date(row.created_at).toISOString(),
            updatedAt: new Date(row.updated_at).toISOString(),
          }),
        );
      });
    } finally {
      client.release();
    }
  }

  async getKeyById(id: string): Promise<PlatformAiKeyDto> {
    const client = await this.pool.connect();
    try {
      return await withPlatform(client, async (tx) => {

        const sql = `
          SELECT
            k.id,
            k.provider,
            k.name,
            k.key_last4,
            k.status,
            k.is_active,
            k.description,
            k.last_tested_at,
            k.created_at,
            k.updated_at,
            COALESCE(SUM(a.allocated_amount_cents), 0)::int AS total_allocated_cents,
            COUNT(a.id) FILTER (WHERE a.status = 'active')::int AS active_allocations_count
          FROM app.platform_ai_keys k
          LEFT JOIN app.platform_credit_allocations a ON a.platform_key_id = k.id
          WHERE k.id = $1
          GROUP BY k.id;
        `;

        const res = await tx.query(sql, [id]);
        const row = res.rows[0];
        if (!row) {
          throw problem({
            title: 'Not Found',
            status: 404,
            detail: `Platform AI Key with id "${id}" was not found in vault`,
            code: 'AI_KEY_NOT_FOUND',
          });
        }

        return PlatformAiKeyDtoSchema.parse({
          id: row.id,
          provider: row.provider,
          name: row.name,
          maskedKey: formatMaskedKey(row.provider, row.key_last4),
          keyLast4: row.key_last4,
          status: row.status,
          isActive: Boolean(row.is_active),
          description: row.description || null,
          totalAllocatedCents: Number(row.total_allocated_cents || 0),
          activeAllocationsCount: Number(row.active_allocations_count || 0),
          lastTestedAt: row.last_tested_at ? new Date(row.last_tested_at).toISOString() : null,
          createdAt: new Date(row.created_at).toISOString(),
          updatedAt: new Date(row.updated_at).toISOString(),
        });
      });
    } finally {
      client.release();
    }
  }

  async createKey(
    dto: CreatePlatformAiKeyDto,
    actor: UserContext,
    meta: RequestMeta,
  ): Promise<PlatformAiKeyDto> {
    const client = await this.pool.connect();
    try {
      return await withPlatform(client, async (tx) => {

        const cleanKey = dto.apiKey.trim();
        const last4 = cleanKey.slice(-4);
        const encryptedEnvelope = this.crypto.encrypt(cleanKey);

        const insertSql = `
          INSERT INTO app.platform_ai_keys (
            provider,
            name,
            encrypted_key,
            key_last4,
            status,
            is_active,
            description,
            created_by
          ) VALUES ($1, $2, $3, $4, 'active', true, $5, $6)
          RETURNING id, provider, name, key_last4, status, is_active, description, created_at, updated_at;
        `;

        const res = await tx.query(insertSql, [
          dto.provider,
          dto.name.trim(),
          encryptedEnvelope,
          last4,
          dto.description?.trim() || null,
          actor.userId,
        ]);
        const row = res.rows[0];

        // Audit log (never log secret or ciphertext)
        await appendAuditEvent(tx, {
          actorId: actor.userId,
          actorRole: actor.role,
          orgId: null,
          action: 'ai_key.created',
          entity: 'platform_ai_key',
          entityId: row.id,
          after: {
            id: row.id,
            provider: row.provider,
            name: row.name,
            keyLast4: row.key_last4,
            maskedKey: formatMaskedKey(row.provider, row.key_last4),
            status: row.status,
          },
          ip: meta.ip,
          userAgent: meta.userAgent,
          requestId: meta.requestId,
        });

        return PlatformAiKeyDtoSchema.parse({
          id: row.id,
          provider: row.provider,
          name: row.name,
          maskedKey: formatMaskedKey(row.provider, row.key_last4),
          keyLast4: row.key_last4,
          status: row.status,
          isActive: Boolean(row.is_active),
          description: row.description || null,
          totalAllocatedCents: 0,
          activeAllocationsCount: 0,
          lastTestedAt: null,
          createdAt: new Date(row.created_at).toISOString(),
          updatedAt: new Date(row.updated_at).toISOString(),
        });
      });
    } finally {
      client.release();
    }
  }

  async updateKey(
    id: string,
    dto: UpdatePlatformAiKeyDto,
    actor: UserContext,
    meta: RequestMeta,
  ): Promise<PlatformAiKeyDto> {
    const client = await this.pool.connect();
    try {
      return await withPlatform(client, async (tx) => {

        const existingRes = await tx.query(
          `SELECT id, provider, name, key_last4, status, is_active, description, created_at, updated_at FROM app.platform_ai_keys WHERE id = $1 FOR UPDATE;`,
          [id],
        );
        const existing = existingRes.rows[0];
        if (!existing) {
          throw problem({
            title: 'Not Found',
            status: 404,
            detail: `Platform AI Key with id "${id}" was not found`,
            code: 'AI_KEY_NOT_FOUND',
          });
        }

        const isRotation = Boolean(dto.apiKey && dto.apiKey.trim().length >= 8);
        const newKeyLast4 = isRotation ? dto.apiKey!.trim().slice(-4) : existing.key_last4;
        const newEncrypted = isRotation ? this.crypto.encrypt(dto.apiKey!.trim()) : null;
        const newName = dto.name !== undefined ? dto.name.trim() : existing.name;
        const newStatus = dto.status !== undefined ? dto.status : existing.status;
        const newIsActive = newStatus === 'active';
        const newDesc = dto.description !== undefined ? dto.description.trim() : existing.description;

        const updateSql = `
          UPDATE app.platform_ai_keys
          SET
            name = $1,
            status = $2,
            is_active = $3,
            description = $4,
            key_last4 = $5,
            encrypted_key = COALESCE($6, encrypted_key),
            updated_at = clock_timestamp()
          WHERE id = $7
          RETURNING id, provider, name, key_last4, status, is_active, description, created_at, updated_at;
        `;

        const updateRes = await tx.query(updateSql, [
          newName,
          newStatus,
          newIsActive,
          newDesc,
          newKeyLast4,
          newEncrypted,
          id,
        ]);
        const row = updateRes.rows[0];

        // Audit log
        await appendAuditEvent(tx, {
          actorId: actor.userId,
          actorRole: actor.role,
          orgId: null,
          action: isRotation ? 'ai_key.rotated' : 'ai_key.updated',
          entity: 'platform_ai_key',
          entityId: id,
          before: {
            name: existing.name,
            status: existing.status,
            keyLast4: existing.key_last4,
          },
          after: {
            name: row.name,
            status: row.status,
            keyLast4: row.key_last4,
            isRotation,
          },
          ip: meta.ip,
          userAgent: meta.userAgent,
          requestId: meta.requestId,
        });

        return PlatformAiKeyDtoSchema.parse({
          id: row.id,
          provider: row.provider,
          name: row.name,
          maskedKey: formatMaskedKey(row.provider, row.key_last4),
          keyLast4: row.key_last4,
          status: row.status,
          isActive: Boolean(row.is_active),
          description: row.description || null,
          totalAllocatedCents: 0,
          activeAllocationsCount: 0,
          createdAt: new Date(row.created_at).toISOString(),
          updatedAt: new Date(row.updated_at).toISOString(),
        });
      });
    } finally {
      client.release();
    }
  }

  /**
   * Revokes a platform AI key safely (AD-023, BR-16).
   * Note on F-06: Revoking a platform key sets status to 'revoked' and is_active to false,
   * which prevents creating *new* allocations against this key (KEY_NOT_ACTIVE check).
   * Existing tenant allocations are preserved intact to maintain historical accounting ledger
   * integrity and audit trails. Live workspace execution via the AI proxy will be blocked
   * because the underlying key is inactive.
   */
  async deleteKey(
    id: string,
    actor: UserContext,
    meta: RequestMeta,
  ): Promise<{ success: boolean; id: string; status: string }> {
    const client = await this.pool.connect();
    try {
      return await withPlatform(client, async (tx) => {

        const checkRes = await tx.query(
          `SELECT id, name, key_last4, status FROM app.platform_ai_keys WHERE id = $1 FOR UPDATE;`,
          [id],
        );
        const existing = checkRes.rows[0];
        if (!existing) {
          throw problem({
            title: 'Not Found',
            status: 404,
            detail: `Platform AI Key with id "${id}" was not found`,
            code: 'AI_KEY_NOT_FOUND',
          });
        }

        // Revoke key safely
        await tx.query(
          `UPDATE app.platform_ai_keys SET status = 'revoked', is_active = false, updated_at = clock_timestamp() WHERE id = $1;`,
          [id],
        );

        // Audit log
        await appendAuditEvent(tx, {
          actorId: actor.userId,
          actorRole: actor.role,
          orgId: null,
          action: 'ai_key.revoked',
          entity: 'platform_ai_key',
          entityId: id,
          before: { status: existing.status },
          after: { status: 'revoked', isActive: false },
          ip: meta.ip,
          userAgent: meta.userAgent,
          requestId: meta.requestId,
        });

        return { success: true, id, status: 'revoked' };
      });
    } finally {
      client.release();
    }
  }

  async testKey(id: string): Promise<{ success: boolean; message: string; provider: string; last4: string }> {
    const client = await this.pool.connect();
    try {
      return await withPlatform(client, async (tx) => {

        const res = await tx.query(
          `SELECT id, provider, key_last4, encrypted_key FROM app.platform_ai_keys WHERE id = $1;`,
          [id],
        );
        const row = res.rows[0];
        if (!row) {
          throw problem({
            title: 'Not Found',
            status: 404,
            detail: `Platform AI Key with id "${id}" was not found`,
            code: 'AI_KEY_NOT_FOUND',
          });
        }

        // Verify cryptographic authentication and envelope integrity
        const decrypted = this.crypto.decrypt(row.encrypted_key);
        if (!decrypted || decrypted.slice(-4) !== row.key_last4) {
          throw problem({
            title: 'Integrity Check Failed',
            status: 422,
            detail: 'Stored key failed cryptographic authentication tag verification.',
            code: 'KEY_AUTH_FAILED',
          });
        }

        await tx.query(
          `UPDATE app.platform_ai_keys SET last_tested_at = clock_timestamp() WHERE id = $1;`,
          [id],
        );

        return {
          success: true,
          message: 'Cryptographic envelope and decryption verified successfully.',
          provider: row.provider,
          last4: row.key_last4,
        };
      });
    } finally {
      client.release();
    }
  }

  // ==========================================
  // 2. Tenant Credit Allocation Management
  // ==========================================

  async listAllocations(filters?: {
    orgId?: string | undefined;
    platformKeyId?: string | undefined;
    status?: string | undefined;
  }): Promise<CreditAllocationDto[]> {
    const client = await this.pool.connect();
    try {
      return await withPlatform(client, async (tx) => {

        const conditions: string[] = [];
        const params: any[] = [];

        if (filters?.orgId) {
          params.push(filters.orgId);
          conditions.push(`a.org_id = $${params.length}`);
        }
        if (filters?.platformKeyId) {
          params.push(filters.platformKeyId);
          conditions.push(`a.platform_key_id = $${params.length}`);
        }
        if (filters?.status) {
          params.push(filters.status);
          conditions.push(`a.status = $${params.length}`);
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const sql = `
          SELECT
            a.id,
            a.org_id,
            o.name AS org_name,
            a.platform_key_id,
            k.name AS platform_key_name,
            k.provider,
            k.key_last4,
            a.allocated_amount_cents,
            a.used_amount_cents,
            a.balance_cents,
            a.markup_percentage,
            a.token_cap,
            a.spend_cap_cents,
            a.status,
            a.notes,
            a.expires_at,
            a.created_at,
            a.updated_at
          FROM app.platform_credit_allocations a
          JOIN app.organizations o ON o.id = a.org_id
          JOIN app.platform_ai_keys k ON k.id = a.platform_key_id
          ${whereClause}
          ORDER BY a.created_at DESC;
        `;

        const res = await tx.query(sql, params);
        return res.rows.map((row) =>
          CreditAllocationDtoSchema.parse({
            id: row.id,
            orgId: row.org_id,
            orgName: row.org_name,
            platformKeyId: row.platform_key_id,
            platformKeyName: row.platform_key_name,
            provider: row.provider,
            maskedKey: formatMaskedKey(row.provider, row.key_last4),
            allocatedAmountCents: Number(row.allocated_amount_cents),
            usedAmountCents: Number(row.used_amount_cents),
            balanceCents: Number(row.balance_cents),
            markupPercentage: Number(row.markup_percentage),
            tokenCap: row.token_cap ? Number(row.token_cap) : null,
            spendCapCents: row.spend_cap_cents ? Number(row.spend_cap_cents) : null,
            status: row.status,
            notes: row.notes || null,
            expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
            createdAt: new Date(row.created_at).toISOString(),
            updatedAt: new Date(row.updated_at).toISOString(),
          }),
        );
      });
    } finally {
      client.release();
    }
  }

  async getAllocationById(id: string): Promise<CreditAllocationDto> {
    const client = await this.pool.connect();
    try {
      return await withPlatform(client, async (tx) => {

        const sql = `
          SELECT
            a.id,
            a.org_id,
            o.name AS org_name,
            a.platform_key_id,
            k.name AS platform_key_name,
            k.provider,
            k.key_last4,
            a.allocated_amount_cents,
            a.used_amount_cents,
            a.balance_cents,
            a.markup_percentage,
            a.token_cap,
            a.spend_cap_cents,
            a.status,
            a.notes,
            a.expires_at,
            a.created_at,
            a.updated_at
          FROM app.platform_credit_allocations a
          JOIN app.organizations o ON o.id = a.org_id
          JOIN app.platform_ai_keys k ON k.id = a.platform_key_id
          WHERE a.id = $1;
        `;

        const res = await tx.query(sql, [id]);
        const row = res.rows[0];
        if (!row) {
          throw problem({
            title: 'Not Found',
            status: 404,
            detail: `Credit allocation with id "${id}" was not found`,
            code: 'ALLOCATION_NOT_FOUND',
          });
        }

        return CreditAllocationDtoSchema.parse({
          id: row.id,
          orgId: row.org_id,
          orgName: row.org_name,
          platformKeyId: row.platform_key_id,
          platformKeyName: row.platform_key_name,
          provider: row.provider,
          maskedKey: formatMaskedKey(row.provider, row.key_last4),
          allocatedAmountCents: Number(row.allocated_amount_cents),
          usedAmountCents: Number(row.used_amount_cents),
          balanceCents: Number(row.balance_cents),
          markupPercentage: Number(row.markup_percentage),
          tokenCap: row.token_cap ? Number(row.token_cap) : null,
          spendCapCents: row.spend_cap_cents ? Number(row.spend_cap_cents) : null,
          status: row.status,
          notes: row.notes || null,
          expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
          createdAt: new Date(row.created_at).toISOString(),
          updatedAt: new Date(row.updated_at).toISOString(),
        });
      });
    } finally {
      client.release();
    }
  }

  async createAllocation(
    dto: CreateCreditAllocationDto,
    actor: UserContext,
    meta: RequestMeta,
  ): Promise<CreditAllocationDto> {
    const client = await this.pool.connect();
    try {
      return await withPlatform(client, async (tx) => {

        // 1. Verify organization exists
        const orgRes = await tx.query(`SELECT id, name FROM app.organizations WHERE id = $1;`, [dto.orgId]);
        const org = orgRes.rows[0];
        if (!org) {
          throw problem({
            title: 'Not Found',
            status: 404,
            detail: `Tenant Organization "${dto.orgId}" not found`,
            code: 'ORG_NOT_FOUND',
          });
        }

        // 2. Verify platform key exists and is active
        const keyRes = await tx.query(
          `SELECT id, name, provider, key_last4, status, is_active FROM app.platform_ai_keys WHERE id = $1 FOR SHARE;`,
          [dto.platformKeyId],
        );
        const key = keyRes.rows[0];
        if (!key) {
          throw problem({
            title: 'Not Found',
            status: 404,
            detail: `Platform AI Key "${dto.platformKeyId}" not found`,
            code: 'AI_KEY_NOT_FOUND',
          });
        }
        if (key.status !== 'active' || !key.is_active) {
          throw problem({
            title: 'Unprocessable Entity',
            status: 422,
            detail: `Platform AI Key "${key.name}" is not active (status: ${key.status})`,
            code: 'KEY_NOT_ACTIVE',
          });
        }

        const initialBalance = dto.allocatedAmountCents;
        const insertSql = `
          INSERT INTO app.platform_credit_allocations (
            org_id,
            platform_key_id,
            allocated_amount_cents,
            used_amount_cents,
            balance_cents,
            markup_percentage,
            token_cap,
            spend_cap_cents,
            status,
            notes,
            expires_at,
            created_by
          ) VALUES ($1, $2, $3, 0, $4, $5, $6, $7, 'active', $8, $9, $10)
          RETURNING id, org_id, platform_key_id, allocated_amount_cents, used_amount_cents, balance_cents,
                    markup_percentage, token_cap, spend_cap_cents, status, notes, expires_at, created_at, updated_at;
        `;

        const res = await tx.query(insertSql, [
          dto.orgId,
          dto.platformKeyId,
          dto.allocatedAmountCents,
          initialBalance,
          dto.markupPercentage ?? 15.0,
          dto.tokenCap ?? null,
          dto.spendCapCents ?? null,
          dto.notes?.trim() || null,
          dto.expiresAt ? new Date(dto.expiresAt) : null,
          actor.userId,
        ]);
        const row = res.rows[0];

        // Audit log
        await appendAuditEvent(tx, {
          actorId: actor.userId,
          actorRole: actor.role,
          orgId: dto.orgId,
          action: 'ai_allocation.created',
          entity: 'platform_credit_allocation',
          entityId: row.id,
          after: {
            id: row.id,
            orgId: dto.orgId,
            orgName: org.name,
            platformKeyId: dto.platformKeyId,
            allocatedAmountCents: dto.allocatedAmountCents,
            balanceCents: initialBalance,
            markupPercentage: dto.markupPercentage ?? 15.0,
          },
          ip: meta.ip,
          userAgent: meta.userAgent,
          requestId: meta.requestId,
        });

        return CreditAllocationDtoSchema.parse({
          id: row.id,
          orgId: row.org_id,
          orgName: org.name,
          platformKeyId: row.platform_key_id,
          platformKeyName: key.name,
          provider: key.provider,
          maskedKey: formatMaskedKey(key.provider, key.key_last4),
          allocatedAmountCents: Number(row.allocated_amount_cents),
          usedAmountCents: Number(row.used_amount_cents),
          balanceCents: Number(row.balance_cents),
          markupPercentage: Number(row.markup_percentage),
          tokenCap: row.token_cap ? Number(row.token_cap) : null,
          spendCapCents: row.spend_cap_cents ? Number(row.spend_cap_cents) : null,
          status: row.status,
          notes: row.notes || null,
          expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
          createdAt: new Date(row.created_at).toISOString(),
          updatedAt: new Date(row.updated_at).toISOString(),
        });
      });
    } finally {
      client.release();
    }
  }

  async adjustAllocation(
    id: string,
    dto: AdjustCreditAllocationDto,
    actor: UserContext,
    meta: RequestMeta,
  ): Promise<CreditAllocationDto> {
    const client = await this.pool.connect();
    try {
      return await withPlatform(client, async (tx) => {

        // Transactional row lock on allocation
        const selSql = `
          SELECT
            a.id,
            a.org_id,
            o.name AS org_name,
            a.platform_key_id,
            k.name AS platform_key_name,
            k.provider,
            k.key_last4,
            a.allocated_amount_cents,
            a.used_amount_cents,
            a.balance_cents,
            a.markup_percentage,
            a.token_cap,
            a.spend_cap_cents,
            a.status,
            a.notes,
            a.expires_at,
            a.created_at,
            a.updated_at
          FROM app.platform_credit_allocations a
          JOIN app.organizations o ON o.id = a.org_id
          JOIN app.platform_ai_keys k ON k.id = a.platform_key_id
          WHERE a.id = $1
          FOR UPDATE OF a;
        `;

        const res = await tx.query(selSql, [id]);
        const existing = res.rows[0];
        if (!existing) {
          throw problem({
            title: 'Not Found',
            status: 404,
            detail: `Credit allocation with id "${id}" was not found`,
            code: 'ALLOCATION_NOT_FOUND',
          });
        }

        const newAllocated = Number(existing.allocated_amount_cents) + dto.adjustmentAmountCents;
        const newBalance = newAllocated - Number(existing.used_amount_cents);

        // Invariant: Balance cannot be negative
        if (newBalance < 0) {
          throw problem({
            title: 'Unprocessable Entity',
            status: 422,
            detail: `Credit adjustment of ${dto.adjustmentAmountCents} cents would cause negative balance (${newBalance} cents). Minimum allowed adjustment is -${existing.balance_cents} cents.`,
            code: 'INSUFFICIENT_CREDIT_BALANCE',
          });
        }

        let newStatus = existing.status;
        if (newBalance === 0 && existing.status === 'active') {
          newStatus = 'exhausted';
        } else if (newBalance > 0 && existing.status === 'exhausted') {
          newStatus = 'active';
        }

        const newMarkup = dto.markupPercentage !== undefined ? dto.markupPercentage : existing.markup_percentage;
        const newExpires = dto.expiresAt !== undefined ? (dto.expiresAt ? new Date(dto.expiresAt) : null) : existing.expires_at;

        const updateSql = `
          UPDATE app.platform_credit_allocations
          SET
            allocated_amount_cents = $1,
            balance_cents = $2,
            markup_percentage = $3,
            expires_at = $4,
            status = $5,
            updated_at = clock_timestamp()
          WHERE id = $6
          RETURNING id, org_id, platform_key_id, allocated_amount_cents, used_amount_cents, balance_cents,
                    markup_percentage, token_cap, spend_cap_cents, status, notes, expires_at, created_at, updated_at;
        `;

        const updateRes = await tx.query(updateSql, [
          newAllocated,
          newBalance,
          newMarkup,
          newExpires,
          newStatus,
          id,
        ]);
        const row = updateRes.rows[0];

        // Audit log
        await appendAuditEvent(tx, {
          actorId: actor.userId,
          actorRole: actor.role,
          orgId: existing.org_id,
          action: 'ai_allocation.adjusted',
          entity: 'platform_credit_allocation',
          entityId: id,
          before: {
            allocatedAmountCents: Number(existing.allocated_amount_cents),
            balanceCents: Number(existing.balance_cents),
            status: existing.status,
          },
          after: {
            allocatedAmountCents: newAllocated,
            balanceCents: newBalance,
            deltaCents: dto.adjustmentAmountCents,
            reason: dto.reason,
            status: newStatus,
          },
          ip: meta.ip,
          userAgent: meta.userAgent,
          requestId: meta.requestId,
        });

        return CreditAllocationDtoSchema.parse({
          id: row.id,
          orgId: row.org_id,
          orgName: existing.org_name,
          platformKeyId: row.platform_key_id,
          platformKeyName: existing.platform_key_name,
          provider: existing.provider,
          maskedKey: formatMaskedKey(existing.provider, existing.key_last4),
          allocatedAmountCents: Number(row.allocated_amount_cents),
          usedAmountCents: Number(row.used_amount_cents),
          balanceCents: Number(row.balance_cents),
          markupPercentage: Number(row.markup_percentage),
          tokenCap: row.token_cap ? Number(row.token_cap) : null,
          spendCapCents: row.spend_cap_cents ? Number(row.spend_cap_cents) : null,
          status: row.status,
          notes: row.notes || null,
          expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
          createdAt: new Date(row.created_at).toISOString(),
          updatedAt: new Date(row.updated_at).toISOString(),
        });
      });
    } finally {
      client.release();
    }
  }

  async revokeAllocation(
    id: string,
    actor: UserContext,
    meta: RequestMeta,
    reason?: string,
  ): Promise<CreditAllocationDto> {
    const client = await this.pool.connect();
    try {
      return await withPlatform(client, async (tx) => {

        const selRes = await tx.query(
          `SELECT
            a.id, a.org_id, o.name AS org_name, a.platform_key_id, k.name AS platform_key_name,
            k.provider, k.key_last4, a.allocated_amount_cents, a.used_amount_cents, a.balance_cents,
            a.markup_percentage, a.token_cap, a.spend_cap_cents, a.status, a.notes, a.expires_at,
            a.created_at, a.updated_at
          FROM app.platform_credit_allocations a
          JOIN app.organizations o ON o.id = a.org_id
          JOIN app.platform_ai_keys k ON k.id = a.platform_key_id
          WHERE a.id = $1
          FOR UPDATE OF a;`,
          [id],
        );
        const existing = selRes.rows[0];
        if (!existing) {
          throw problem({
            title: 'Not Found',
            status: 404,
            detail: `Credit allocation with id "${id}" was not found`,
            code: 'ALLOCATION_NOT_FOUND',
          });
        }

        await tx.query(
          `UPDATE app.platform_credit_allocations SET status = 'revoked', updated_at = clock_timestamp() WHERE id = $1;`,
          [id],
        );

        // Audit log
        await appendAuditEvent(tx, {
          actorId: actor.userId,
          actorRole: actor.role,
          orgId: existing.org_id,
          action: 'ai_allocation.revoked',
          entity: 'platform_credit_allocation',
          entityId: id,
          before: { status: existing.status, balanceCents: Number(existing.balance_cents) },
          after: {
            status: 'revoked',
            remainingBalanceCents: Number(existing.balance_cents),
            reason: reason || null,
          },
          ip: meta.ip,
          userAgent: meta.userAgent,
          requestId: meta.requestId,
        });

        return CreditAllocationDtoSchema.parse({
          id: existing.id,
          orgId: existing.org_id,
          orgName: existing.org_name,
          platformKeyId: existing.platform_key_id,
          platformKeyName: existing.platform_key_name,
          provider: existing.provider,
          maskedKey: formatMaskedKey(existing.provider, existing.key_last4),
          allocatedAmountCents: Number(existing.allocated_amount_cents),
          usedAmountCents: Number(existing.used_amount_cents),
          balanceCents: Number(existing.balance_cents),
          markupPercentage: Number(existing.markup_percentage),
          tokenCap: existing.token_cap ? Number(existing.token_cap) : null,
          spendCapCents: existing.spend_cap_cents ? Number(existing.spend_cap_cents) : null,
          status: 'revoked',
          notes: existing.notes || null,
          expiresAt: existing.expires_at ? new Date(existing.expires_at).toISOString() : null,
          createdAt: new Date(existing.created_at).toISOString(),
          updatedAt: new Date().toISOString(),
        });
      });
    } finally {
      client.release();
    }
  }

  async getVaultStats(): Promise<PlatformAiVaultStatsDto> {
    const client = await this.pool.connect();
    try {
      return await withPlatform(client, async (tx) => {

        const keysRes = await tx.query(`
          SELECT
            COUNT(*)::int AS total_keys,
            COUNT(*) FILTER (WHERE status = 'active')::int AS active_keys
          FROM app.platform_ai_keys;
        `);
        const allocRes = await tx.query(`
          SELECT
            COUNT(*)::int AS total_allocations,
            COALESCE(SUM(allocated_amount_cents), 0)::int AS total_allocated_cents,
            COALESCE(SUM(used_amount_cents), 0)::int AS total_used_cents,
            COALESCE(SUM(balance_cents), 0)::int AS total_remaining_balance_cents
          FROM app.platform_credit_allocations
          WHERE status != 'revoked';
        `);

        const kRow = keysRes.rows[0] || {};
        const aRow = allocRes.rows[0] || {};

        return PlatformAiVaultStatsDtoSchema.parse({
          totalKeys: Number(kRow.total_keys || 0),
          activeKeys: Number(kRow.active_keys || 0),
          totalAllocations: Number(aRow.total_allocations || 0),
          totalAllocatedCents: Number(aRow.total_allocated_cents || 0),
          totalUsedCents: Number(aRow.total_used_cents || 0),
          totalRemainingBalanceCents: Number(aRow.total_remaining_balance_cents || 0),
        });
      });
    } finally {
      client.release();
    }
  }
}
