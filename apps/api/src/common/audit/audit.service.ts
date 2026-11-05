import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { redactSensitiveData } from './audit-log.service.js';
import { appendAuditEvent } from '../../modules/audit/audit-writer.js';
import type { AuditRecordInput } from '../../modules/audit/audit.types.js';

export interface AuditRecordRequest {
  actorId: string | null;
  actorRole: string;
  orgId: string | null;
  action: string;
  entity: string;
  entityId?: string | null | undefined;
  before?: unknown;
  after?: unknown;
  ip?: string | null | undefined;
  userAgent?: string | null | undefined;
  requestId?: string | null | undefined;
}

/**
 * BR-31 append-only audit ledger.
 * Callers pass the active transaction client so the audit row commits or rolls back with the mutation.
 * Passwords, tokens, secrets, and raw billing instrument fields are stripped before insert.
 */
@Injectable()
export class AuditService {
  async record(client: PoolClient, entry: AuditRecordRequest): Promise<void> {
    const input: AuditRecordInput = {
      actorId: entry.actorId,
      actorRole: entry.actorRole,
      orgId: entry.orgId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? undefined,
      before: entry.before === undefined ? undefined : redactSensitiveData(entry.before),
      after: entry.after === undefined ? undefined : redactSensitiveData(entry.after),
      ip: entry.ip,
      userAgent: entry.userAgent,
      requestId: entry.requestId,
    };
    await appendAuditEvent(client, input);
  }
}
