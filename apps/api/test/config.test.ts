import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/config.js';

describe('loadConfig', () => {
  it('requires REDIS_URL in staging', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'staging',
        DATABASE_URL: 'postgres://hs_app:hs_app_local@127.0.0.1:5432/hellosmart',
        SESSION_SECRET: 'test-secret-test-secret-test-secret-test',
        MFA_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
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
        DATABASE_PLATFORM_URL: 'postgres://hs_platform:hs_platform_local@127.0.0.1:5432/hellosmart',
        REDIS_URL: 'redis://:hs_redis_local@127.0.0.1:6379',
        SESSION_SECRET: 'test-secret-test-secret-test-secret-test',
        MFA_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        CORS_ORIGINS: 'https://app.hellosmart.ai',
        PAYMENT_GATEWAY: 'fake',
        EMAIL_PROVIDER: 'ses',
        WORKSPACE_RUNTIME: 'sysbox',
      }),
    ).toThrow(/Fake adapters/);
  });

  it('requires DATABASE_PLATFORM_URL in production and staging', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://hs_app:hs_app_local@127.0.0.1:5432/hellosmart',
        REDIS_URL: 'redis://:hs_redis_local@127.0.0.1:6379',
        SESSION_SECRET: 'test-secret-test-secret-test-secret-test',
        MFA_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        CORS_ORIGINS: 'https://app.hellosmart.ai',
        PAYMENT_GATEWAY: 'razorpay',
        EMAIL_PROVIDER: 'ses',
        WORKSPACE_RUNTIME: 'sysbox',
      }),
    ).toThrow(/DATABASE_PLATFORM_URL is required/);
  });

  it('rejects DATABASE_PLATFORM_URL when misconfigured as hs_app', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://hs_app:hs_app_local@127.0.0.1:5432/hellosmart',
        DATABASE_PLATFORM_URL: 'postgres://hs_app:hs_app_local@127.0.0.1:5432/hellosmart',
        REDIS_URL: 'redis://:hs_redis_local@127.0.0.1:6379',
        SESSION_SECRET: 'test-secret-test-secret-test-secret-test',
        MFA_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        CORS_ORIGINS: 'https://app.hellosmart.ai',
        PAYMENT_GATEWAY: 'razorpay',
        EMAIL_PROVIDER: 'ses',
        WORKSPACE_RUNTIME: 'sysbox',
      }),
    ).toThrow(/cannot use hs_app runtime role/);
  });

  it('rejects DATABASE_URL when configured with elevated or superuser roles', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://hs_platform:secret@127.0.0.1:5432/hellosmart',
        DATABASE_PLATFORM_URL: 'postgres://hs_platform:secret@127.0.0.1:5432/hellosmart',
        REDIS_URL: 'redis://:hs_redis_local@127.0.0.1:6379',
        SESSION_SECRET: 'test-secret-test-secret-test-secret-test',
        MFA_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        CORS_ORIGINS: 'https://app.hellosmart.ai',
        PAYMENT_GATEWAY: 'razorpay',
        EMAIL_PROVIDER: 'ses',
        WORKSPACE_RUNTIME: 'sysbox',
      }),
    ).toThrow(/must connect as restricted runtime role/);
  });

  it('requires MFA_ENCRYPTION_KEY in production and staging (S0-T14-3)', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://hs_app:hs_app_local@127.0.0.1:5432/hellosmart',
        DATABASE_PLATFORM_URL: 'postgres://hs_platform:hs_platform_local@127.0.0.1:5432/hellosmart',
        REDIS_URL: 'redis://:hs_redis_local@127.0.0.1:6379',
        SESSION_SECRET: 'test-secret-test-secret-test-secret-test',
        CORS_ORIGINS: 'https://app.hellosmart.ai',
        PAYMENT_GATEWAY: 'razorpay',
        EMAIL_PROVIDER: 'ses',
        WORKSPACE_RUNTIME: 'sysbox',
      }),
    ).toThrow(/MFA_ENCRYPTION_KEY is required/);
  });

  it('rejects invalid MFA_ENCRYPTION_KEY length (must be 32 bytes / 256 bits)', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://hs_app:hs_app_local@127.0.0.1:5432/hellosmart',
        DATABASE_PLATFORM_URL: 'postgres://hs_platform:hs_platform_local@127.0.0.1:5432/hellosmart',
        REDIS_URL: 'redis://:hs_redis_local@127.0.0.1:6379',
        SESSION_SECRET: 'test-secret-test-secret-test-secret-test',
        MFA_ENCRYPTION_KEY: 'too-short-key',
        CORS_ORIGINS: 'https://app.hellosmart.ai',
        PAYMENT_GATEWAY: 'razorpay',
        EMAIL_PROVIDER: 'ses',
        WORKSPACE_RUNTIME: 'sysbox',
      }),
    ).toThrow(/expected 32 bytes/);
  });

  it('rejects wildcard * in CORS_ORIGINS due to credentialed cookie architecture (BR-25, S0-T14-1)', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgres://hs_app:hs_app_local@127.0.0.1:5432/hellosmart',
        DATABASE_PLATFORM_URL: 'postgres://hs_platform:hs_platform_local@127.0.0.1:5432/hellosmart',
        REDIS_URL: 'redis://:hs_redis_local@127.0.0.1:6379',
        SESSION_SECRET: 'test-secret-test-secret-test-secret-test',
        CORS_ORIGINS: '*',
      }),
    ).toThrow(/Wildcard CORS origin '\*' is not permitted/);
  });

});
