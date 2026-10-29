import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import type pg from 'pg';
import { DatabaseService } from '../database/database.service.js';
import { TenantContextService } from '../database/tenant-context.service.js';

export interface AuditLogEntry {
  actorId?: string | null | undefined;
  actorRole: string;
  orgId?: string | null | undefined;
  action: string;
  entity: string;
  entityId?: string | null | undefined;
  before?: Record<string, any> | null | undefined;
  after?: Record<string, any> | null | undefined;
  ip?: string | null | undefined;
  userAgent?: string | null | undefined;
  requestId?: string | null | undefined;
}

export interface AuditLogRecord extends AuditLogEntry {
  id: string | number;
  at: Date;
  prevHash: string | null;
  hash: string;
}

/**
 * Regex matching sensitive fields that MUST be stripped/redacted from audit records (BR-31).
 */
export const SENSITIVE_KEY_REGEX =
  /password|passwd|secret|token|totp|otp|mfa|credential|cvv|authorization|cookie|hs_session|((^|[_.-])(api_?key|private_?key|secret_?key|key|code)([_.-]|$))|^(apiKey|code|mfaCode)$/i;

/**
 * Redacts sensitive fields (passwords, tokens, TOTP codes, keys, secrets) recursively.
 */
export function redactSensitiveData<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }
  if (typeof data !== 'object') {
    if (typeof data === 'string') {
      // Check for Bearer token or JWT structure in values
      if (/^bearer\s+[a-zA-Z0-9_\-\.]+/i.test(data) || /^eyJ[a-zA-Z0-9_\-]+\.eyJ/i.test(data)) {
        return '[REDACTED]' as unknown as T;
      }
    }
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item)) as unknown as T;
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEY_REGEX.test(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = redactSensitiveData(value);
    } else if (
      typeof value === 'string' &&
      (/^bearer\s+[a-zA-Z0-9_\-\.]+/i.test(value) || /^eyJ[a-zA-Z0-9_\-]+\.eyJ/i.test(value))
    ) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized as T;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);
  private tableName = 'app.audit_logs';
  private readonly inMemoryRecords: AuditLogRecord[] = [];
  private lastHash: string | null = null;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  /**
   * Sets the database table or view name (default: app.audit_logs).
   */
  setTableName(name: string): void {
    this.tableName = name;
  }

  getTableName(): string {
    return this.tableName;
  }

  /**
   * Writes an append-only, tamper-evident audit log entry.
   * Ensures sensitive payloads are redacted and the record is written in the current transaction.
   */
  async log(entry: AuditLogEntry, clientOverride?: pg.PoolClient | any): Promise<AuditLogRecord> {
    const redactedBefore = entry.before ? redactSensitiveData(entry.before) : null;
    const redactedAfter = entry.after ? redactSensitiveData(entry.after) : null;

    // Use explicit client, or client from current tenant transaction context, or pool
    const activeClient =
      clientOverride ||
      this.tenantContextService.getCurrentClient() ||
      this.databaseService.getPool();

    const timestamp = new Date();
    const prevHash = this.lastHash;
    const hash = this.computeHash(prevHash, {
      actorId: entry.actorId,
      actorRole: entry.actorRole,
      orgId: entry.orgId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      before: redactedBefore,
      after: redactedAfter,
      at: timestamp.toISOString(),
    });
    this.lastHash = hash;

    const record: AuditLogRecord = {
      ...entry,
      id: Date.now().toString(),
      at: timestamp,
      before: redactedBefore,
      after: redactedAfter,
      prevHash,
      hash,
    };

    if (activeClient) {
      try {
        const queryText = `
          INSERT INTO ${this.tableName} (
            actor_id, actor_role, org_id, action, entity, entity_id,
            before, after, ip, user_agent, request_id, prev_hash, hash
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING id, at
        `;
        const values = [
          entry.actorId || null,
          entry.actorRole,
          entry.orgId || null,
          entry.action,
          entry.entity,
          entry.entityId || null,
          redactedBefore ? JSON.stringify(redactedBefore) : null,
          redactedAfter ? JSON.stringify(redactedAfter) : null,
          entry.ip || null,
          entry.userAgent || null,
          entry.requestId || null,
          prevHash ? Buffer.from(prevHash, 'hex') : null,
          Buffer.from(hash, 'hex'),
        ];

        const result = await activeClient.query(queryText, values);
        if (result?.rows?.[0]) {
          record.id = result.rows[0].id;
          record.at = result.rows[0].at;
        }
      } catch (err: any) {
        this.logger.error(`Failed to write audit log to database: ${err.message}`);
        // If inside an explicit transaction, propagating the error ensures atomicity
        if (this.tenantContextService.getContext()?.inTransaction) {
          throw err;
        }
      }
    }

    this.inMemoryRecords.push(record);
    return record;
  }

  /**
   * Helper: Record authentication attempts (success or failure).
   */
  async logAuthAttempt(
    params: {
      userId?: string | null;
      email: string;
      role?: string;
      orgId?: string | null;
      success: boolean;
      ip?: string | null;
      userAgent?: string | null;
      reason?: string;
      metadata?: Record<string, any>;
    },
    clientOverride?: pg.PoolClient | any,
  ): Promise<AuditLogRecord> {
    return this.log(
      {
        actorId: params.userId || null,
        actorRole: params.role || 'anonymous',
        orgId: params.orgId || null,
        action: params.success ? 'auth.login.success' : 'auth.login.failure',
        entity: 'auth',
        entityId: params.userId || params.email,
        after: {
          email: params.email,
          success: params.success,
          reason: params.reason,
          ...params.metadata,
        },
        ip: params.ip,
        userAgent: params.userAgent,
      },
      clientOverride,
    );
  }

  /**
   * Helper: Record organization creation events.
   */
  async logOrgCreated(
    params: {
      actorId: string;
      actorRole: string;
      orgId: string;
      orgName: string;
      slug: string;
      ip?: string | null;
      userAgent?: string | null;
    },
    clientOverride?: pg.PoolClient | any,
  ): Promise<AuditLogRecord> {
    return this.log(
      {
        actorId: params.actorId,
        actorRole: params.actorRole,
        orgId: params.orgId,
        action: 'org.created',
        entity: 'organization',
        entityId: params.orgId,
        after: {
          id: params.orgId,
          name: params.orgName,
          slug: params.slug,
        },
        ip: params.ip,
        userAgent: params.userAgent,
      },
      clientOverride,
    );
  }

  /**
   * Helper: Record status change events (user suspension, org suspension, trial expiration, etc.).
   */
  async logStatusChange(
    params: {
      actorId: string;
      actorRole: string;
      orgId?: string | null;
      entity: 'user' | 'organization' | string;
      entityId: string;
      beforeStatus: string;
      afterStatus: string;
      ip?: string | null;
      userAgent?: string | null;
      reason?: string;
    },
    clientOverride?: pg.PoolClient | any,
  ): Promise<AuditLogRecord> {
    return this.log(
      {
        actorId: params.actorId,
        actorRole: params.actorRole,
        orgId: params.orgId || null,
        action: `${params.entity}.status_changed`,
        entity: params.entity,
        entityId: params.entityId,
        before: { status: params.beforeStatus },
        after: { status: params.afterStatus, reason: params.reason },
        ip: params.ip,
        userAgent: params.userAgent,
      },
      clientOverride,
    );
  }

  /**
   * Returns records captured in memory (useful for tests or diagnostics).
   */
  getInMemoryRecords(): AuditLogRecord[] {
    return [...this.inMemoryRecords];
  }

  /**
   * Clears in-memory records.
   */
  clearInMemoryRecords(): void {
    this.inMemoryRecords.length = 0;
    this.lastHash = null;
  }

  private computeHash(prevHash: string | null, payload: any): string {
    const serialized = JSON.stringify(payload);
    const hasher = createHash('sha256');
    if (prevHash) {
      hasher.update(prevHash);
    }
    hasher.update(serialized);
    return hasher.digest('hex');
  }
}
