import { describe, expect, it, vi } from 'vitest';
import { TenantContextService } from '../src/common/database/tenant-context.service.js';

describe('TenantContextService SQL (BR-01)', () => {
  it('uses parameterized set_config only (no interpolated SET LOCAL)', async () => {
    const queries: Array<{ text: string; values?: unknown[] }> = [];
    const client = {
      query: vi.fn(async (text: string, values?: unknown[]) => {
        queries.push({ text, values });
        return { rows: [] };
      }),
    };
    const svc = new TenantContextService();
    await svc.setTenantContext(client as never, {
      orgId: "org-'; DROP TABLE app.users;--",
      role: 'company_admin',
    });
    expect(queries.some((q) => q.text.includes('SET LOCAL'))).toBe(false);
    expect(queries.every((q) => q.text.includes('set_config'))).toBe(true);
    expect(queries.some((q) => q.values?.includes("org-'; DROP TABLE app.users;--"))).toBe(true);
  });
});
