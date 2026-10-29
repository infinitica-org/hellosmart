import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import pg from 'pg';
import { APP_CONFIG } from '../../config/config.tokens.js';
import type { Config } from '../../config/config.js';
import { PG_PLATFORM_POOL, PG_POOL, type PgPool } from './database.tokens.js';
import { DatabaseService } from '../../common/database/database.service.js';
import { TenantContextService } from '../../common/database/tenant-context.service.js';

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: (config: Config): PgPool =>
        new pg.Pool({
          connectionString: config.DATABASE_URL,
          max: 10,
        }),
      inject: [APP_CONFIG],
    },
    {
      provide: PG_PLATFORM_POOL,
      useFactory: (config: Config): PgPool =>
        new pg.Pool({
          connectionString: config.DATABASE_PLATFORM_URL,
          max: 5,
        }),
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
