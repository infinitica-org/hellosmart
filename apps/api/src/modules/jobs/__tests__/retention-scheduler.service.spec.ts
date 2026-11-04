import { describe, expect, it, vi } from 'vitest';
import { RetentionSchedulerService } from '../retention-scheduler.service.js';
import type { RetentionPurgeWorker } from '../retention-purge.worker.js';
import type { Config } from '../../../config/config.js';

describe('RetentionSchedulerService (Unit)', () => {
  const baseConfig: Config = {
    NODE_ENV: 'production',
    PORT: 4000,
    LOG_LEVEL: 'silent',
    DATABASE_URL: 'postgres://localhost:5432/hellosmart_test',
    DATABASE_PLATFORM_URL: 'postgres://localhost:5432/hellosmart_test',
    SESSION_SECRET: 'test_session_secret_at_least_32_characters_long_hello',
    CORS_ORIGINS: ['http://localhost:3000'],
    PAYMENT_GATEWAY: 'fake',
    EMAIL_PROVIDER: 'fake',
    WORKSPACE_RUNTIME: 'fake',
    APP_BASE_URL: 'http://localhost:3000',
    STORAGE_DRIVER: 'fake',
    STORAGE_LOCAL_ROOT: '.storage',
    STORAGE_S3_BUCKET: 'hs-test-bucket',
    STORAGE_S3_REGION: 'us-east-1',
    RETENTION_PURGE_ENABLED: false,
    RETENTION_PURGE_HOUR_UTC: 3,
    RETENTION_PURGE_BATCH_SIZE: 100,
    RETENTION_PURGE_DRY_RUN: false,
  } as unknown as Config;

  it('does nothing on bootstrap when RETENTION_PURGE_ENABLED is false', () => {
    const mockWorker = { run: vi.fn() } as unknown as RetentionPurgeWorker;
    const scheduler = new RetentionSchedulerService(baseConfig, mockWorker);

    scheduler.onApplicationBootstrap();
    expect(mockWorker.run).not.toHaveBeenCalled();
    scheduler.onApplicationShutdown();
  });

  it('does nothing in test environment even if RETENTION_PURGE_ENABLED is true', () => {
    const testConfig = { ...baseConfig, NODE_ENV: 'test' as const, RETENTION_PURGE_ENABLED: true };
    const mockWorker = { run: vi.fn() } as unknown as RetentionPurgeWorker;
    const scheduler = new RetentionSchedulerService(testConfig, mockWorker);

    scheduler.onApplicationBootstrap();
    expect(mockWorker.run).not.toHaveBeenCalled();
    scheduler.onApplicationShutdown();
  });

  it('triggers worker when current UTC hour is at or past configured hour, and runs once per day', async () => {
    const enabledConfig = {
      ...baseConfig,
      NODE_ENV: 'production' as const,
      RETENTION_PURGE_ENABLED: true,
      RETENTION_PURGE_HOUR_UTC: 0, // 0 means any hour of the day matches
    };
    const mockWorker = { run: vi.fn().mockResolvedValue({}) } as unknown as RetentionPurgeWorker;
    const scheduler = new RetentionSchedulerService(enabledConfig, mockWorker);

    await scheduler.checkAndRun();
    expect(mockWorker.run).toHaveBeenCalledTimes(1);

    // Second run on the same day should be skipped
    await scheduler.checkAndRun();
    expect(mockWorker.run).toHaveBeenCalledTimes(1);

    scheduler.onApplicationShutdown();
  });
});
