import { describe, expect, it } from 'vitest';
import { appendAuditEvent } from '../../src/modules/audit/audit-writer.js';
import { redactSensitiveData } from '../../src/common/audit/audit-log.service.js';

describe('Append-only audit redaction (BR-31, S1-T06)', () => {
  it('strips passwords, tokens, and secret keys before the hash is stored', async () => {
    let inserted: unknown[] | undefined;
    const client = {
      query: async (sql: string, params?: unknown[]) => {
        if (sql.includes('INSERT INTO audit.events')) {
          inserted = params;
          return { rows: [] };
        }
        return { rows: [{ hash: Buffer.alloc(0) }] };
      },
    };

    await appendAuditEvent(client as never, {
      actorId: '00000000-0000-4000-8000-000000000001',
      actorRole: 'company_admin',
      orgId: '00000000-0000-4000-8000-000000000002',
      action: 'assignment.time_extended',
      entity: 'assignment',
      entityId: '00000000-0000-4000-8000-000000000003',
      after: {
        additionalMinutes: 30,
        reason: 'Extra time',
        password: 'plaintext-secret',
        accessToken: 'raw-token',
        nested: { apiKey: 'sk-live' },
      },
    });

    const after = JSON.parse(String(inserted?.[7]));
    expect(after.additionalMinutes).toBe(30);
    expect(after.password).toBe('[REDACTED]');
    expect(after.accessToken).toBe('[REDACTED]');
    expect(after.nested.apiKey).toBe('[REDACTED]');
    expect(redactSensitiveData({ passwordHash: 'argon', name: 'Ada' }).passwordHash).toBe('[REDACTED]');
  });
});
