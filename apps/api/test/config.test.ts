import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/config.js';

describe('loadConfig', () => {
  it('requires REDIS_URL in staging', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'staging',
        DATABASE_URL: 'postgres://hs_app:hs_app_local@127.0.0.1:5432/hellosmart',
        SESSION_SECRET: 'test-secret-test-secret-test-secret-test',
        PAYMENT_GATEWAY: 'razorpay',
        EMAIL_PROVIDER: 'ses',
        WORKSPACE_RUNTIME: 'sysbox',
        CORS_ORIGINS: 'https://app.hellosmart.ai',
      }),
    ).toThrow(/REDIS_URL/);
  });

  it('rejects fake adapters in production', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://hs_app:hs_app_local@127.0.0.1:5432/hellosmart',
        REDIS_URL: 'redis://:hs_redis_local@127.0.0.1:6379',
        SESSION_SECRET: 'test-secret-test-secret-test-secret-test',
        CORS_ORIGINS: 'https://app.hellosmart.ai',
        PAYMENT_GATEWAY: 'fake',
        EMAIL_PROVIDER: 'ses',
        WORKSPACE_RUNTIME: 'sysbox',
      }),
    ).toThrow(/Fake adapters/);
  });
});
