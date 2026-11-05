import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import pg from 'pg';
import { APP_CONFIG } from '../../config/config.tokens.js';
import type { Config } from '../../config/config.js';
import { PG_PLATFORM_POOL, PG_POOL, type PgPool } from './database.tokens.js';
import { DatabaseService } from '../../common/database/database.service.js';
import { TenantContextService } from '../../common/database/tenant-context.service.js';

function createPool(connectionString: string, config: Config, applicationName: string, max?: number): PgPool {
  const pool = new pg.Pool({
    connectionString,
    max: max ?? config.PG_POOL_MAX,
    connectionTimeoutMillis: config.PG_CONNECTION_TIMEOUT_MS,
    idleTimeoutMillis: 30_000,
    application_name: applicationName,
  });
  pool.on('error', (err) => {
    const message = err instanceof Error ? err.message : 'pool error';
    process.stderr.write(`postgres pool error name=${applicationName} msg=${message}\n`);
  });
  return pool;
}

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: (config: Config): PgPool => createPool(config.DATABASE_URL, config, 'hellosmart-api'),
      inject: [APP_CONFIG],
    },
    {
      provide: PG_PLATFORM_POOL,
      useFactory: (config: Config): PgPool =>
        createPool(
          config.DATABASE_PLATFORM_URL ?? config.DATABASE_URL,
          config,
          'hellosmart-api-platform',
          Math.max(2, Math.floor(config.PG_POOL_MAX / 2)),
        ),
      inject: [APP_CONFIG],
    },
    DatabaseService,
    TenantContextService,
  ],
  exports: [PG_POOL, PG_PLATFORM_POOL, DatabaseService, TenantContextService],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(
    @Inject(PG_POOL) private readonly pool: PgPool,
    @Inject(PG_PLATFORM_POOL) private readonly platformPool: PgPool,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.pool.end(), this.platformPool.end()]);
  }
}
