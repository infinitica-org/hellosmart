import { describe, expect, it } from 'vitest';
import { AutoSubmitWorker } from '../../src/modules/jobs/auto-submit.worker.js';

describe('Auto-submit worker (BR-08, S1-T03)', () => {
  it('claims due assignments with SKIP LOCKED and an injectable clock', async () => {
    const sql: string[] = [];
    const client = {
      query: async (text: string) => {
        sql.push(text);
        if (text.includes('pg_try_advisory_lock')) {
          return { rows: [{ acquired: true }] };
        }
        if (text.includes('FOR UPDATE OF a SKIP LOCKED')) {
          return { rows: [] };
        }
        return { rows: [] };
      },
      release: () => undefined,
    };
    const pool = { connect: async () => client };
    const worker = new AutoSubmitWorker(
      pool as never,
      pool as never,
      { finalize: async () => null } as never,
      { record: async () => undefined } as never,
    );

    const report = await worker.sweep({
      referenceTime: new Date('2026-11-03T15:00:00.000Z'),
      limit: 10,
    });

    expect(report.skippedDueToLock).toBe(false);
    expect(report.scanned).toBe(0);
    expect(sql.some((statement) => statement.includes('FOR UPDATE OF a SKIP LOCKED'))).toBe(true);
    expect(sql.some((statement) => statement.includes('pg_advisory_unlock'))).toBe(true);
  });
});
