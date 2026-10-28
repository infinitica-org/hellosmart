import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import pg from 'pg';
import { APP_CONFIG } from '../../config/config.tokens.js';
import type { Config } from '../../config/config.js';
import { PG_POOL, type PgPool } from './database.tokens.js';

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
  ],
  exports: [PG_POOL],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(@Inject(PG_POOL) private readonly pool: PgPool) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
