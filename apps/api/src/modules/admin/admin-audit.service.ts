import crypto from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import {
  type AuditLogQueryDto,
  type PaginatedAuditLogDto,
  type AuditEventDto,
  type AuditVerifyResponseDto,
} from '@hs/contracts';
import { PG_PLATFORM_POOL } from '../database/database.tokens.js';
import { withPlatform } from '../tenancy/with-org.js';
import { redactSensitiveData } from '../../common/audit/audit-log.service.js';

interface RawAuditEventRow {
  id: string | number;
  at: Date;
  actor_id: string | null;
  actor_role: string;
  org_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  before: Record<string, any> | null;
  after: Record<string, any> | null;
  ip: string | null;
  user_agent: string | null;
  request_id: string | null;
  prev_hash: Buffer | null;
  hash: Buffer;
  sql_payload_bytes?: Buffer | null;
  provenance?: 'sql' | 'application' | 'ambiguous' | undefined;
}

/**
 * Known action prefixes emitted by application services using appendAuditEvent().
 */
const KNOWN_APPLICATION_ACTION_PREFIXES = [
  'org.',
  'user.',
  'candidate.',
  'assessment.',
  'assignment.',
  'session.',
  'template.',
  'quote.',
  'lead.',
  'webhook.',
  'retention.',
  'password.',
  'auth.',
  'artifact.',
  'workspace.',
  'entitlements.',
];

/**
 * Evaluates whether a row matches the structural footprint of an invitation acceptance event.
 *
 * CRITICAL CORRECTNESS & PROVENANCE INVARIANT:
 * Matching this structural footprint DOES NOT prove SQL writer provenance.
 * The application writer `appendAuditEvent()` in `audit-writer.ts` accepts arbitrary
 * caller-provided action, entity, and payload values. It can produce an event with
 * this exact structural footprint using compact JavaScript JSON serialization.
 *
 * Therefore, structural matching alone CANNOT establish SQL provenance.
 */
export function matchesInvitationFootprint(row: RawAuditEventRow): boolean {
  if (row.action !== 'invitation.accepted' || row.entity !== 'user') {
    return false;
  }
  if (!row.actor_id || !row.entity_id || String(row.actor_id) !== String(row.entity_id)) {
    return false;
  }
  if (row.actor_role !== 'company_admin' && row.actor_role !== 'candidate') {
    return false;
  }
  if (!row.org_id) {
    return false;
  }

  // Strict check on before payload
  if (
    !row.before ||
    typeof row.before !== 'object' ||
    Array.isArray(row.before) ||
    row.before.status !== 'invited' ||
    row.before.must_reset_password !== true ||
    Object.keys(row.before).length !== 2
  ) {
    return false;
  }

  // Strict check on after payload
  if (
    !row.after ||
    typeof row.after !== 'object' ||
    Array.isArray(row.after) ||
    row.after.status !== 'active' ||
    row.after.must_reset_password !== false ||
    row.after.email_verified !== true ||
    Object.keys(row.after).length !== 3
  ) {
    return false;
  }

  return true;
}

/**
 * Evaluates whether a record's writer provenance as the SQL stored procedure
 * `app.accept_invitation()` has been independently established from trusted metadata.
 *
 * An event CANNOT be classified as SQL-generated based on structural shape alone.
 * Only if provenance has been independently established from trusted persisted information
 * (e.g. `row.provenance === 'sql'`) can it be classified as SQL-generated.
 * Without independent trusted provenance, an invitation event has ambiguous provenance
 * and must be classified as inconclusive.
 */
export function isProvenSqlInvitationRecord(row: RawAuditEventRow): boolean {
  return row.provenance === 'sql';
}

/**
 * Checks whether an action belongs to the sanctioned application writer event catalog.
 */
export function isKnownApplicationAction(action: string): boolean {
  return KNOWN_APPLICATION_ACTION_PREFIXES.some((prefix) => action.startsWith(prefix));
}

/**
 * Recursively inspects a data structure (object, array, nested hierarchy) to determine
 * whether it contains ANY object with multiple keys whose original property definition
 * order in JavaScript memory cannot be recovered from PostgreSQL JSONB.
 *
 * PostgreSQL JSONB normalizes objects by sorting keys by length, then ASCII.
 * Therefore, if any object at any nesting depth in `before` or `after` has 2 or more keys,
 * the original serialized representation is indeterminate unless the original keys happened
 * to match PostgreSQL's sorting.
 *
 * Defensive measures:
 * - Uses a Set to guard against circular references.
 * - Enforces a maximum recursion depth (default 64) to prevent call-stack exhaustion.
 * - Gracefully handles primitives, null, undefined, empty structures, and arrays.
 */
export function hasIndeterminateKeyOrder(
  val: unknown,
  seen: Set<unknown> = new Set(),
  depth = 0,
): boolean {
  if (depth > 64) {
    return true; // Exceeded maximum safe depth - treat as indeterminate for safety
  }

  if (val === null || val === undefined || typeof val !== 'object') {
    return false;
  }

  if (seen.has(val)) {
    return true; // Circular reference detected - treat as indeterminate
  }
  seen.add(val);

  if (Array.isArray(val)) {
    for (const item of val) {
      if (hasIndeterminateKeyOrder(item, seen, depth + 1)) {
        return true;
      }
    }
    return false;
  }

  const keys = Object.keys(val as Record<string, unknown>);
  if (keys.length > 1) {
    return true;
  }

  if (keys.length === 1) {
    const singleKey = keys[0]!;
    return hasIndeterminateKeyOrder((val as Record<string, unknown>)[singleKey], seen, depth + 1);
  }

  return false;
}

@Injectable()
export class AdminAuditService {
  constructor(
    @Inject(PG_PLATFORM_POOL) private readonly pool: Pool,
  ) {}

  /**
   * Global audit log query endpoint (AD-027, BR-31).
   * Cross-tenant query executed as Platform Admin via PG_PLATFORM_POOL + withPlatform.
   * Supports all 8 administrative filters: actor_id, actor_role, org_id, entity, entity_id,
   * action, start_date, end_date, plus free-text search.
   */
  async listAuditEvents(query: AuditLogQueryDto): Promise<PaginatedAuditLogDto> {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(100, Math.max(1, query.page_size || 25));
    const offset = (page - 1) * pageSize;

    const client = await this.pool.connect();
    try {
      return await withPlatform(client, async (tx) => {
        const conditions: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (query.actor_id && query.actor_id.trim()) {
          conditions.push(`actor_id = $${paramIndex++}`);
          values.push(query.actor_id.trim());
        }

        if (query.actor_role && query.actor_role.trim()) {
          conditions.push(`actor_role = $${paramIndex++}`);
          values.push(query.actor_role.trim());
        }

        if (query.org_id && query.org_id.trim()) {
          conditions.push(`org_id = $${paramIndex++}`);
          values.push(query.org_id.trim());
        }

        if (query.entity && query.entity.trim()) {
          conditions.push(`entity ILIKE $${paramIndex++}`);
          values.push(`%${query.entity.trim()}%`);
        }

        if (query.entity_id && query.entity_id.trim()) {
          conditions.push(`entity_id = $${paramIndex++}`);
          values.push(query.entity_id.trim());
        }

        if (query.action && query.action.trim()) {
          conditions.push(`action ILIKE $${paramIndex++}`);
          values.push(`%${query.action.trim()}%`);
        }

        if (query.start_date && query.start_date.trim()) {
          conditions.push(`at >= $${paramIndex++}`);
          values.push(new Date(query.start_date.trim()).toISOString());
        }

        if (query.end_date && query.end_date.trim()) {
          conditions.push(`at <= $${paramIndex++}`);
          values.push(new Date(query.end_date.trim()).toISOString());
        }

        if (query.search && query.search.trim()) {
          const searchPattern = `%${query.search.trim()}%`;
          conditions.push(`(
            action ILIKE $${paramIndex} OR
            entity ILIKE $${paramIndex} OR
            entity_id ILIKE $${paramIndex} OR
            actor_role ILIKE $${paramIndex} OR
            user_agent ILIKE $${paramIndex} OR
            host(ip) ILIKE $${paramIndex}
          )`);
          values.push(searchPattern);
          paramIndex++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // 1. Total count query
        const countSql = `SELECT count(*)::int AS total FROM audit.events ${whereClause}`;
        const countRes = await tx.query<{ total: number }>(countSql, values);
        const total = countRes.rows[0]?.total ?? 0;

        // 2. Paginated rows query
        const queryValues = [...values, pageSize, offset];
        const limitParam = `$${paramIndex++}`;
        const offsetParam = `$${paramIndex++}`;

        const rowsSql = `
          SELECT
            id,
            at,
            actor_id,
            actor_role,
            org_id,
            action,
            entity,
            entity_id,
            before,
            after,
            host(ip) AS ip,
            user_agent,
            request_id,
            encode(prev_hash, 'hex') AS prev_hash,
            encode(hash, 'hex') AS hash
          FROM audit.events
          ${whereClause}
          ORDER BY id DESC
          LIMIT ${limitParam} OFFSET ${offsetParam}
        `;

        const rowsRes = await tx.query(rowsSql, queryValues);

        const items: AuditEventDto[] = rowsRes.rows.map((row) => ({
          id: String(row.id),
          at: row.at instanceof Date ? row.at.toISOString() : new Date(row.at).toISOString(),
          actor_id: row.actor_id ?? null,
          actor_role: row.actor_role,
          org_id: row.org_id ?? null,
          action: row.action,
          entity: row.entity,
          entity_id: row.entity_id ?? null,
          before: row.before ? redactSensitiveData(row.before) : null,
          after: row.after ? redactSensitiveData(row.after) : null,
          ip: row.ip ?? null,
          user_agent: row.user_agent ?? null,
          request_id: row.request_id ?? null,
          prev_hash: row.prev_hash ?? null,
          hash: row.hash,
        }));

        return {
          items,
          total,
          page,
          page_size: pageSize,
          total_pages: Math.ceil(total / pageSize) || 0,
        };
      });
    } finally {
      client.release();
    }
  }

  /**
   * Cryptographic hash-chain verifier (AD-027, BR-31, BR-32).
   * Traverses the entire audit ledger from genesis to head in a REPEATABLE READ snapshot.
   *
   * Verifies sha256(prev_hash || payload) against stored hashes.
   *
   * Four distinct outcomes:
   * - 'valid': Internal hash-chain continuity verified for the examined records.
   * - 'tampered': Definite breach of integrity (broken pointer, invalid genesis, or modified deterministic record).
   * - 'inconclusive': Traversal halted at a record whose exact original bytes cannot be reconstructed
   *   with certainty (e.g. JSONB key reordering, or ambiguous writer provenance).
   * - 'empty': Empty audit ledger (no records).
   */
  async verifyAuditChain(): Promise<AuditVerifyResponseDto> {
    const client = await this.pool.connect();
    try {
      // Consistent snapshot across full traversal
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      await client.query("SELECT set_config('app.is_platform', 'true', true)");

      const sql = `
        SELECT
          id,
          at,
          actor_id,
          actor_role,
          org_id,
          action,
          entity,
          entity_id,
          before,
          after,
          host(ip) AS ip,
          user_agent,
          request_id,
          prev_hash,
          hash,
          CASE
            WHEN action = 'invitation.accepted' AND entity = 'user' THEN
              convert_to(
                jsonb_build_object(
                  'action', 'invitation.accepted',
                  'entity', 'user',
                  'entityId', entity_id::uuid,
                  'actorId', actor_id,
                  'actorRole', actor_role,
                  'orgId', org_id,
                  'before', before,
                  'after', after,
                  'ip', host(ip),
                  'userAgent', user_agent,
                  'requestId', request_id
                )::text,
                'UTF8'
              )
            ELSE NULL
          END AS sql_payload_bytes
        FROM audit.events
        ORDER BY id ASC
      `;

      const result = await client.query<RawAuditEventRow>(sql);
      const rows = result.rows;

      if (rows.length === 0) {
        return {
          status: 'empty',
          valid: true,
          verified_at: new Date().toISOString(),
          records_checked: 0,
          records_verified_before_issue: 0,
          chain_start: null,
          chain_end: null,
          tamper_type: 'empty_chain',
        };
      }

      const firstRow = rows[0];
      const lastRow = rows[rows.length - 1];
      if (!firstRow || !lastRow) {
        return {
          status: 'empty',
          valid: true,
          verified_at: new Date().toISOString(),
          records_checked: 0,
          records_verified_before_issue: 0,
          chain_start: null,
          chain_end: null,
          tamper_type: 'empty_chain',
        };
      }

      let recordsChecked = 0;
      let expectedPrevHash: Buffer = Buffer.alloc(0);
      const firstId = String(firstRow.id);
      const lastId = String(lastRow.id);

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;

        const rowId = String(row.id);
        const rowTimestamp = row.at instanceof Date ? row.at.toISOString() : new Date(row.at).toISOString();

        // 1. Genesis record validation (i === 0)
        if (i === 0) {
          if (row.prev_hash && row.prev_hash.length > 0) {
            return {
              status: 'tampered',
              valid: false,
              verified_at: new Date().toISOString(),
              records_checked: 0,
              records_verified_before_issue: 0,
              chain_start: firstId,
              chain_end: lastId,
              first_invalid_event_id: rowId,
              first_invalid_event_timestamp: rowTimestamp,
              failure_reason: 'Genesis record must have null or empty previous hash (BR-31)',
              tamper_type: 'invalid_genesis',
              expected_previous_hash: null,
              stored_previous_hash: row.prev_hash.toString('hex'),
              expected_hash: null,
              stored_hash: row.hash ? row.hash.toString('hex') : null,
            };
          }
        } else {
          // 2. Preceding hash link continuity check (i > 0)
          const rowPrevHash = row.prev_hash ?? Buffer.alloc(0);
          if (!rowPrevHash.equals(expectedPrevHash)) {
            return {
              status: 'tampered',
              valid: false,
              verified_at: new Date().toISOString(),
              records_checked: recordsChecked,
              records_verified_before_issue: recordsChecked,
              chain_start: firstId,
              chain_end: lastId,
              first_invalid_event_id: rowId,
              first_invalid_event_timestamp: rowTimestamp,
              failure_reason: 'Previous hash mismatch: expected link to previous block hash, but found broken chain pointer',
              tamper_type: 'prev_hash_mismatch',
              expected_previous_hash: expectedPrevHash.toString('hex'),
              stored_previous_hash: row.prev_hash ? row.prev_hash.toString('hex') : null,
              expected_hash: null,
              stored_hash: row.hash ? row.hash.toString('hex') : null,
            };
          }
        }

        // 3. Provenance Determination & Serialization Selection
        // Explicit ambiguous marker overrides
        if (row.provenance === 'ambiguous') {
          return {
            status: 'inconclusive',
            valid: false,
            verified_at: new Date().toISOString(),
            records_checked: recordsChecked,
            records_verified_before_issue: recordsChecked,
            chain_start: firstId,
            chain_end: lastId,
            first_inconclusive_event_id: rowId,
            first_inconclusive_event_timestamp: rowTimestamp,
            inconclusive_reason:
              'Ambiguous writer provenance: record source cannot be cryptographically proven from persisted fields alone',
            failure_reason: 'Ambiguous writer provenance: serialization source unprovable',
            tamper_type: 'unknown_provenance',
            expected_previous_hash: expectedPrevHash.length > 0 ? expectedPrevHash.toString('hex') : null,
            stored_previous_hash: row.prev_hash ? row.prev_hash.toString('hex') : null,
            stored_hash: row.hash ? row.hash.toString('hex') : null,
          };
        }

        const isProvenSql = isProvenSqlInvitationRecord(row);

        if (isProvenSql) {
          // Writer: SQL procedure app.accept_invitation() in 0003_invitations.sql
          // Serialization: PostgreSQL-native jsonb_out UTF-8 bytes
          let payloadBytes = row.sql_payload_bytes;

          if (!payloadBytes) {
            try {
              const pRes = await client.query<{ bytes: Buffer }>(
                `SELECT convert_to(
                  jsonb_build_object(
                    'action', 'invitation.accepted',
                    'entity', 'user',
                    'entityId', $1::uuid,
                    'actorId', $2::uuid,
                    'actorRole', $3::text,
                    'orgId', $4::uuid,
                    'before', $5::jsonb,
                    'after', $6::jsonb,
                    'ip', $7::text,
                    'userAgent', $8::text,
                    'requestId', $9::text
                  )::text,
                  'UTF8'
                ) AS bytes`,
                [
                  row.entity_id,
                  row.actor_id,
                  row.actor_role,
                  row.org_id,
                  row.before ? JSON.stringify(row.before) : null,
                  row.after ? JSON.stringify(row.after) : null,
                  row.ip,
                  row.user_agent,
                  row.request_id,
                ],
              );
              payloadBytes = pRes.rows[0]?.bytes ?? null;
            } catch {
              payloadBytes = null;
            }
          }

          if (!payloadBytes) {
            return {
              status: 'inconclusive',
              valid: false,
              verified_at: new Date().toISOString(),
              records_checked: recordsChecked,
              records_verified_before_issue: recordsChecked,
              chain_start: firstId,
              chain_end: lastId,
              first_inconclusive_event_id: rowId,
              first_inconclusive_event_timestamp: rowTimestamp,
              inconclusive_reason:
                'Unable to reconstruct PostgreSQL JSONB serialization for SQL-generated record',
              failure_reason: 'PostgreSQL serialization reconstruction failed',
              tamper_type: 'unknown_provenance',
              expected_previous_hash: expectedPrevHash.length > 0 ? expectedPrevHash.toString('hex') : null,
              stored_previous_hash: row.prev_hash ? row.prev_hash.toString('hex') : null,
              stored_hash: row.hash ? row.hash.toString('hex') : null,
            };
          }

          const expectedHash = crypto
            .createHash('sha256')
            .update(expectedPrevHash)
            .update(payloadBytes)
            .digest();

          if (!row.hash.equals(expectedHash)) {
            return {
              status: 'tampered',
              valid: false,
              verified_at: new Date().toISOString(),
              records_checked: recordsChecked,
              records_verified_before_issue: recordsChecked,
              chain_start: firstId,
              chain_end: lastId,
              first_invalid_event_id: rowId,
              first_invalid_event_timestamp: rowTimestamp,
              failure_reason: 'Cryptographic hash mismatch on SQL-generated audit block',
              tamper_type: 'hash_mismatch',
              expected_hash: expectedHash.toString('hex'),
              stored_hash: row.hash ? row.hash.toString('hex') : null,
              expected_previous_hash: expectedPrevHash.length > 0 ? expectedPrevHash.toString('hex') : null,
              stored_previous_hash: row.prev_hash ? row.prev_hash.toString('hex') : null,
            };
          }
        } else if (
          (row.action === 'invitation.accepted' || (row.entity === 'user' && row.action.includes('invitation'))) &&
          row.provenance !== 'application'
        ) {
          // Provenance cannot be independently established from persisted database fields alone (BR-31).
          // Structural footprint matching does NOT prove SQL writer provenance because appendAuditEvent()
          // can emit the exact same footprint with compact JavaScript JSON.
          return {
            status: 'inconclusive',
            valid: false,
            verified_at: new Date().toISOString(),
            records_checked: recordsChecked,
            records_verified_before_issue: recordsChecked,
            chain_start: firstId,
            chain_end: lastId,
            first_inconclusive_event_id: rowId,
            first_inconclusive_event_timestamp: rowTimestamp,
            inconclusive_reason:
              'Ambiguous writer provenance: cannot distinguish PostgreSQL SQL writer from Node.js application writer for invitation.accepted event from persisted database fields alone',
            failure_reason:
              'Ambiguous writer provenance: serialization source unprovable without independent trusted provenance',
            tamper_type: 'unknown_provenance',
            expected_previous_hash: expectedPrevHash.length > 0 ? expectedPrevHash.toString('hex') : null,
            stored_previous_hash: row.prev_hash ? row.prev_hash.toString('hex') : null,
            stored_hash: row.hash ? row.hash.toString('hex') : null,
          };
        } else {
          // Check if action is a recognized application event
          if (!isKnownApplicationAction(row.action) && row.provenance !== 'application') {
            return {
              status: 'inconclusive',
              valid: false,
              verified_at: new Date().toISOString(),
              records_checked: recordsChecked,
              records_verified_before_issue: recordsChecked,
              chain_start: firstId,
              chain_end: lastId,
              first_inconclusive_event_id: rowId,
              first_inconclusive_event_timestamp: rowTimestamp,
              inconclusive_reason: `Ambiguous writer provenance: unknown action "${row.action}" lacks recognized writer footprint`,
              failure_reason: 'Unknown event action cannot be attributed to a sanctioned writer',
              tamper_type: 'unknown_provenance',
              expected_previous_hash: expectedPrevHash.length > 0 ? expectedPrevHash.toString('hex') : null,
              stored_previous_hash: row.prev_hash ? row.prev_hash.toString('hex') : null,
              stored_hash: row.hash ? row.hash.toString('hex') : null,
            };
          }

          // Writer: Application writer appendAuditEvent()
          // Check if before or after contains indeterminate key ordering at ANY nesting depth
          if (hasIndeterminateKeyOrder(row.before) || hasIndeterminateKeyOrder(row.after)) {
            return {
              status: 'inconclusive',
              valid: false,
              verified_at: new Date().toISOString(),
              records_checked: recordsChecked,
              records_verified_before_issue: recordsChecked,
              chain_start: firstId,
              chain_end: lastId,
              first_inconclusive_event_id: rowId,
              first_inconclusive_event_timestamp: rowTimestamp,
              inconclusive_reason:
                'Cannot verify cryptographic hash: original JSON property ordering for nested state changes (before/after) cannot be recovered from PostgreSQL JSONB',
              failure_reason:
                'Verification halted: record has indeterminate serialization due to nested JSONB key ordering',
              tamper_type: 'indeterminate_serialization',
              expected_previous_hash: expectedPrevHash.length > 0 ? expectedPrevHash.toString('hex') : null,
              stored_previous_hash: row.prev_hash ? row.prev_hash.toString('hex') : null,
              stored_hash: row.hash ? row.hash.toString('hex') : null,
            };
          }

          // Safe application serialization path: deterministic payload
          const canonical = JSON.stringify({
            actorId: row.actor_id,
            actorRole: row.actor_role,
            orgId: row.org_id,
            action: row.action,
            entity: row.entity,
            entityId: row.entity_id ?? null,
            before: row.before ?? null,
            after: row.after ?? null,
            ip: row.ip ?? null,
            userAgent: row.user_agent ?? null,
            requestId: row.request_id ?? null,
          });

          const expectedHash = crypto
            .createHash('sha256')
            .update(expectedPrevHash)
            .update(canonical)
            .digest();

          if (!row.hash.equals(expectedHash)) {
            return {
              status: 'tampered',
              valid: false,
              verified_at: new Date().toISOString(),
              records_checked: recordsChecked,
              records_verified_before_issue: recordsChecked,
              chain_start: firstId,
              chain_end: lastId,
              first_invalid_event_id: rowId,
              first_invalid_event_timestamp: rowTimestamp,
              failure_reason:
                'Cryptographic hash mismatch: row payload, actor, action, or stored hash has been tampered with',
              tamper_type: 'hash_mismatch',
              expected_hash: expectedHash.toString('hex'),
              stored_hash: row.hash ? row.hash.toString('hex') : null,
              expected_previous_hash: expectedPrevHash.length > 0 ? expectedPrevHash.toString('hex') : null,
              stored_previous_hash: row.prev_hash ? row.prev_hash.toString('hex') : null,
            };
          }
        }

        // Advance chain head pointer
        expectedPrevHash = row.hash;
        recordsChecked++;
      }

      return {
        status: 'valid',
        valid: true,
        verified_at: new Date().toISOString(),
        records_checked: recordsChecked,
        records_verified_before_issue: recordsChecked,
        chain_start: firstId,
        chain_end: lastId,
        tamper_type: 'none',
      };
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  }
}
