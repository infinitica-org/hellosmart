import { describe, expect, it, vi } from 'vitest';
import { HealthService } from '../src/modules/health/health.service.js';
import type { Config } from '../src/config/config.js';

const config = { DATABASE_URL: 'postgres://hs_app:x@127.0.0.1:5432/hellosmart' } as Config;

describe('HealthService readiness (NF-015)', () => {
  it('returns degraded when postgres query fails', async () => {
    const pool = { query: vi.fn().mockRejectedValue(new Error('connection refused')) };
    const redis = { ping: vi.fn().mockResolvedValue('PONG') };
    const health = new HealthService(config, redis as never, pool as never);
    const body = await health.readiness();
    expect(body.status).toBe('degraded');
    expect(body.checks.postgres).toBe('fail');
    expect(body.checks.redis).toBe('ok');
  });

  it('returns degraded when redis ping fails', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }) };
    const redis = { ping: vi.fn().mockRejectedValue(new Error('redis down')) };
    const health = new HealthService(config, redis as never, pool as never);
    const body = await health.readiness();
    expect(body.status).toBe('degraded');
    expect(body.checks.redis).toBe('fail');
    expect(body.checks.postgres).toBe('ok');
  });

  it('returns ok when postgres and redis succeed', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }) };
    const redis = { ping: vi.fn().mockResolvedValue('PONG') };
    const health = new HealthService(config, redis as never, pool as never);
    const body = await health.readiness();
    expect(body.status).toBe('ok');
    expect(body.checks).toEqual({ api: 'ok', postgres: 'ok', redis: 'ok' });
  });
});
