import crypto from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { redactSensitiveData } from '../../common/audit/audit-log.service.js';
import type { AuditRecordInput } from './audit.types.js';

function asInet(ip: string | null | undefined): string | null {
  if (!ip) {
    return null;
  }
  const trimmed = ip.trim();
  if (!trimmed) {
    return null;
  }
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(trimmed) || trimmed.includes(':')) {
    return trimmed;
  }
  return null;
}

function canonicalPayload(input: AuditRecordInput): string {
  return JSON.stringify({
    actorId: input.actorId,
    actorRole: input.actorRole,
    orgId: input.orgId,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
    requestId: input.requestId ?? null,
  });
}

/** BR-31 append-only audit with hash chain (T-037). Must run in same DB transaction as the mutation. */
export async function appendAuditEvent(
  client: PoolClient | Pool,
  input: AuditRecordInput,
): Promise<void> {
  const prev = await client.query<{ hash: Buffer }>(
    'SELECT audit.latest_event_hash() AS hash',
  );
  const prevHash: Buffer = prev.rows[0]?.hash ?? Buffer.alloc(0);
  const sanitized: AuditRecordInput = {
    ...input,
    before: input.before === undefined ? undefined : redactSensitiveData(input.before),
    after: input.after === undefined ? undefined : redactSensitiveData(input.after),
  };
  const payload = canonicalPayload(sanitized);
  const hash = crypto.createHash('sha256').update(prevHash).update(payload).digest();

  await client.query(
    `INSERT INTO audit.events (
      actor_id, actor_role, org_id, action, entity, entity_id,
      before, after, ip, user_agent, request_id, prev_hash, hash
    ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::inet,$10,$11,$12,$13)`,
    [
      sanitized.actorId,
      sanitized.actorRole,
      sanitized.orgId,
      sanitized.action,
      sanitized.entity,
      sanitized.entityId ?? null,
      sanitized.before === undefined ? null : JSON.stringify(sanitized.before),
      sanitized.after === undefined ? null : JSON.stringify(sanitized.after),
      asInet(sanitized.ip),
      sanitized.userAgent ?? null,
      sanitized.requestId ?? null,
      prevHash.length > 0 ? prevHash : null,
      hash,
    ],
  );
}
