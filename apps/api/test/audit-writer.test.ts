import { describe, expect, it } from 'vitest';
import { appendAuditEvent } from '../src/modules/audit/audit-writer.js';

describe('appendAuditEvent', () => {
  it('builds hash chain payload deterministically', async () => {
    const calls: string[] = [];
    const client = {
      query: async (sql: string, params?: unknown[]) => {
        calls.push(sql);
        if (sql.includes('SELECT hash')) {
          return { rows: [] };
        }
        if (sql.includes('INSERT INTO audit.events')) {
          expect(params).toHaveLength(13);
          return { rows: [] };
        }
        return { rows: [] };
      },
    };

    await appendAuditEvent(client as never, {
      actorId: '00000000-0000-4000-8000-000000000001',
      actorRole: 'platform_admin',
      orgId: null,
      action: 'org.created',
      entity: 'organization',
      entityId: '03fa0961-c787-51dd-a4f6-d445495111c6',
      after: { name: 'Aster Ridge' },
      requestId: 'req-1',
    });

    expect(calls.some((c) => c.includes('INSERT INTO audit.events'))).toBe(true);
  });
});
