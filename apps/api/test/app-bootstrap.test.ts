import { describe, it, expect, afterEach } from 'vitest';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { APP_CONFIG } from '../src/config/config.tokens.js';
import { PG_POOL, PG_PLATFORM_POOL } from '../src/modules/database/database.tokens.js';
import { DatabaseService } from '../src/common/database/database.service.js';
import { registerCsvContentTypeParsers } from '../src/modules/candidates/csv-stream-parser.js';
import type { Config } from '../src/config/config.js';

describe('Application Bootstrap & Fastify CSV Parser Verification', () => {
  let app: NestFastifyApplication;

  const testConfig: Config = {
    NODE_ENV: 'test',
    PORT: 4000,
    DATABASE_URL: 'postgres://localhost:5432/hellosmart_test',
    DATABASE_MIGRATOR_URL: 'postgres://localhost:5432/hellosmart_test',
    SESSION_SECRET: 'test_session_secret_at_least_32_characters_long_hello',
    CORS_ORIGINS: ['http://localhost:3000'],
    PAYMENT_GATEWAY: 'fake',
    EMAIL_PROVIDER: 'fake',
    WORKSPACE_RUNTIME: 'fake',
    APP_BASE_URL: 'http://localhost:3000',
    MAILPIT_URL: 'http://127.0.0.1:8025',
  };

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('boots the NestJS application successfully with CSV content-type parsers registered', async () => {
    const adapter = new FastifyAdapter();

    // Register CSV content-type parser
    registerCsvContentTypeParsers(adapter.getInstance());

    // Calling it a second time should be idempotent and not throw FST_ERR_CTP_ALREADY_PRESENT
    expect(() => registerCsvContentTypeParsers(adapter.getInstance())).not.toThrow();

    const fastify = adapter.getInstance();
    expect(fastify.hasContentTypeParser('text/csv')).toBe(true);
    expect(fastify.hasContentTypeParser('application/csv')).toBe(true);

    const mockPool = {
      query: () => ({ rows: [] }),
      connect: () => ({ query: () => ({ rows: [] }), release: () => {} }),
      end: async () => {},
    };

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(APP_CONFIG)
      .useValue(testConfig)
      .overrideProvider(PG_POOL)
      .useValue(mockPool)
      .overrideProvider(PG_PLATFORM_POOL)
      .useValue(mockPool)
      .overrideProvider(DatabaseService)
      .useValue({ checkAccountStatus: () => ({ userStatus: 'active', orgStatus: 'trial_active' }) })
      .compile();

    app = moduleRef.createNestApplication(adapter);
    app.setGlobalPrefix('api/v1');

    await expect(app.init()).resolves.toBeDefined();
    await expect(adapter.getInstance().ready()).resolves.toBeDefined();
  });
});
