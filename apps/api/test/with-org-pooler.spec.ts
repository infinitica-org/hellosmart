import { describe, expect, it } from 'vitest';
import { withOrg } from '../src/modules/tenancy/with-org.js';
import type { PoolClient } from 'pg';

describe('withOrg transaction pooling (BR-01)', () => {
  it('does not leave app.org_id set after COMMIT', async () => {
    const local: Record<string, string> = {};
    const client = {
      query: async (text: string, values?: string[]) => {
        if (text === 'BEGIN') {
          return { rows: [] };
        }
        if (text === 'COMMIT' || text === 'ROLLBACK') {
          for (const key of Object.keys(local)) delete local[key];
          return { rows: [] };
        }
        if (text.includes('set_config')) {
          const name = text.match(/set_config\('([^']+)'/)?.[1];
          const isLocal = text.includes('true');
          if (name && isLocal && values?.[0] !== undefined) {
            local[name] = values[0];
          }
          return { rows: [] };
        }
        if (text.includes('current_setting')) {
          const name = values?.[0] ?? text.match(/current_setting\('([^']+)'/)?.[1];
          return { rows: [{ value: name ? (local[name] ?? null) : null }] };
        }
        return { rows: [] };
      },
    };

    await withOrg(client as unknown as PoolClient, 'org-a', async () => 'ok');
    const after = await client.query("SELECT current_setting('app.org_id', true) as value");
    expect(after.rows[0]?.value).toBeNull();

    await withOrg(client as unknown as PoolClient, 'org-b', async (tx) => {
      await tx.query("SELECT current_setting('app.org_id', true) as value", ['app.org_id']);
      return 'ok';
    });
    const afterB = await client.query("SELECT current_setting('app.org_id', true) as value");
    expect(afterB.rows[0]?.value).toBeNull();
  });
});
