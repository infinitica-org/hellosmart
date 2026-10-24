import crypto from 'node:crypto';
import type pg from 'pg';
import { isSeedEmail } from './keys.ts';
import { verifyPassword } from './hasher.ts';
import type { Outcome } from './reporter.ts';

export interface UpsertOptions {
  client: pg.PoolClient;
  table: string; // e.g. 'app.organizations', 'app.users'
  keyFields: Record<string, any>; // Natural key fields used for lookup
  values: Record<string, any>; // Full payload
  dryRun: boolean;
  plainPassword?: string; // If checking password hash
}

function stableStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object' || obj instanceof Date) {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(stableStringify).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

export async function upsertRecord(opts: UpsertOptions): Promise<Outcome> {
  const { client, table, keyFields, values, dryRun, plainPassword } = opts;

  // Build WHERE clause for natural key lookup
  const keyNames = Object.keys(keyFields);
  const keyParams: any[] = [];
  const whereClauses: string[] = [];

  for (let i = 0; i < keyNames.length; i++) {
    const k = keyNames[i]!;
    const val = keyFields[k];
    if (val === null || val === undefined) {
      whereClauses.push(`${k} IS NULL`);
    } else {
      keyParams.push(val);
      whereClauses.push(`${k} = $${keyParams.length}`);
    }
  }

  const selectSql = `SELECT * FROM ${table} WHERE ${whereClauses.join(' AND ')} LIMIT 1;`;
  const existingRes = await client.query(selectSql, keyParams);
  const existing = existingRes.rows[0];

  // 1. Collision check on non-seed accounts
  if (existing) {
    if (table === 'app.users' && existing.email) {
      if (!isSeedEmail(existing.email)) {
        throw new Error(
          `COLLISION GUARD: Account with email '${existing.email}' already exists as a non-seed account. Overwrite refused.`,
        );
      }
      if (values['id'] && existing.id && existing.id !== values['id']) {
        throw new Error(
          `COLLISION GUARD: Account with email '${existing.email}' already exists with non-seed ID '${existing.id}'. Overwrite refused.`,
        );
      }
    }
    if (table === 'app.organizations' && existing.slug) {
      if (!existing.slug.startsWith('aster') && !existing.slug.startsWith('brindle')) {
        throw new Error(
          `COLLISION GUARD: Organization with slug '${existing.slug}' already exists as a non-seed organization. Overwrite refused.`,
        );
      }
      if (values['id'] && existing.id && existing.id !== values['id']) {
        throw new Error(
          `COLLISION GUARD: Organization with slug '${existing.slug}' already exists with non-seed ID '${existing.id}'. Overwrite refused.`,
        );
      }
    }
  }

  // 2. Insert if record does not exist
  if (!existing) {
    if (dryRun) {
      return 'created';
    }

    const colNames = Object.keys(values);
    const colValues = Object.values(values);
    const placeholders = colValues.map((_, i) => `$${i + 1}`).join(', ');

    const insertSql = `
      INSERT INTO ${table} (${colNames.join(', ')})
      VALUES (${placeholders})
      RETURNING *;
    `;
    const insertRes = await client.query(insertSql, colValues);
    const createdRow = insertRes.rows[0];

    // Optional: write audit entry ONLY on creation (never on reruns)
    if (table !== 'audit.events') {
      await writeCreateAuditEvent(client, table, createdRow);
    }

    return 'created';
  }

  // 3. Record exists: compare fields to detect real changes and prevent updated_at churn
  const fieldsToUpdate: Record<string, any> = {};
  for (const [col, targetVal] of Object.entries(values)) {
    // Skip id, created_at, updated_at from triggering updates
    if (col === 'id' || col === 'created_at' || col === 'updated_at') {
      continue;
    }

    const existingVal = existing[col];

    // Password comparison
    if (col === 'password_hash' && plainPassword && existingVal) {
      const matches = await verifyPassword(existingVal, plainPassword);
      if (matches) {
        continue; // Password is valid, no change
      }
    }

    // Numeric / Decimal comparison (Postgres returns numeric/decimal as string, e.g. '2.00')
    if (
      typeof targetVal === 'number' &&
      typeof existingVal === 'string' &&
      !isNaN(Number(existingVal))
    ) {
      if (Number(existingVal) === targetVal) {
        continue;
      }
    }

    // JSONB / Object comparison
    if (typeof targetVal === 'object' && targetVal !== null && !(targetVal instanceof Date)) {
      const existingJson = stableStringify(existingVal ?? {});
      const targetJson = stableStringify(targetVal);
      if (existingJson !== targetJson) {
        fieldsToUpdate[col] = targetVal;
      }
      continue;
    }

    // Date / Timestamp comparison
    if (targetVal instanceof Date) {
      const existingDate = existingVal ? new Date(existingVal) : null;
      if (!existingDate || existingDate.getTime() !== targetVal.getTime()) {
        fieldsToUpdate[col] = targetVal;
      }
      continue;
    }

    // Primitive comparison
    if (existingVal !== targetVal) {
      fieldsToUpdate[col] = targetVal;
    }
  }

  // If no fields changed, report unchanged
  if (Object.keys(fieldsToUpdate).length === 0) {
    return 'unchanged';
  }

  // 4. Update modified fields
  if (dryRun) {
    return 'updated';
  }

  const updateColNames = Object.keys(fieldsToUpdate);
  const updateValues: any[] = [];
  const setClauses: string[] = [];

  for (let i = 0; i < updateColNames.length; i++) {
    const col = updateColNames[i]!;
    updateValues.push(fieldsToUpdate[col]);
    setClauses.push(`${col} = $${updateValues.length}`);
  }

  // If updated_at column exists in table, update it
  if ('updated_at' in existing) {
    setClauses.push(`updated_at = now()`);
  }

  // Append key params for WHERE clause
  const offset = updateValues.length;
  const updateWhereClauses: string[] = [];
  for (let i = 0; i < keyNames.length; i++) {
    const k = keyNames[i]!;
    const val = keyFields[k];
    if (val === null || val === undefined) {
      updateWhereClauses.push(`${k} IS NULL`);
    } else {
      updateValues.push(val);
      updateWhereClauses.push(`${k} = $${offset + updateWhereClauses.length + 1}`);
    }
  }

  const updateSql = `
    UPDATE ${table}
    SET ${setClauses.join(', ')}
    WHERE ${updateWhereClauses.join(' AND ')}
    RETURNING *;
  `;
  await client.query(updateSql, updateValues);

  return 'updated';
}

/**
 * Appends an audit event to audit.events ONLY on creation.
 * Never touches or mutates existing audit records.
 */
async function writeCreateAuditEvent(
  client: pg.PoolClient,
  table: string,
  row: any,
): Promise<void> {
  try {
    const prevRes = await client.query('SELECT hash FROM audit.events ORDER BY id DESC LIMIT 1;');
    const prevHash = prevRes.rows[0]?.hash ?? Buffer.alloc(32, 0);

    const payload = JSON.stringify({ action: 'seed.create', table, id: row?.id });
    const hasher = crypto.createHash('sha256');
    hasher.update(prevHash);
    hasher.update(Buffer.from(payload, 'utf8'));
    const hash = hasher.digest();

    const safeRow = { ...row };
    if ('password_hash' in safeRow) {
      safeRow.password_hash = '[REDACTED]';
    }

    await client.query(
      `INSERT INTO audit.events (actor_role, action, entity, entity_id, after, prev_hash, hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7);`,
      [
        'platform_admin',
        'seed.create',
        table,
        row?.id ? String(row.id) : null,
        JSON.stringify(safeRow),
        prevHash,
        hash,
      ],
    );
  } catch {
    // If audit.events table does not exist or trigger issues, do not block the seed
  }
}
