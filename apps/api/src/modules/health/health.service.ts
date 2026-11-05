import { Inject, Injectable, Optional } from '@nestjs/common';
import { APP_CONFIG } from '../../config/config.tokens.js';
import type { Config } from '../../config/config.js';
import { PG_POOL, type PgPool } from '../database/database.tokens.js';
import { REDIS_CLIENT, type HelloRedisClient } from '../redis/redis.tokens.js';

export interface HealthReadyResponse {
  status: 'ok' | 'degraded';
  checks: {
    api: 'ok';
    postgres: 'ok' | 'fail' | 'skipped';
    redis: 'ok' | 'fail' | 'skipped';
  };
}

@Injectable()
export class HealthService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: Config,
    @Inject(REDIS_CLIENT) private readonly redis: HelloRedisClient,
    @Optional() @Inject(PG_POOL) private readonly pool: PgPool | null,
  ) {}

  liveness(): { status: 'ok' } {
    return { status: 'ok' };
  }

  async readiness(): Promise<HealthReadyResponse> {
    const checks: HealthReadyResponse['checks'] = { api: 'ok', postgres: 'skipped', redis: 'skipped' };

    if (this.pool) {
      try {
        await this.pool.query('SELECT 1');
        checks.postgres = 'ok';
      } catch {
        checks.postgres = 'fail';
      }
    } else if (this.config.DATABASE_URL) {
      checks.postgres = 'fail';
    }

    if (this.redis) {
      try {
        const pong = await this.redis.ping();
        checks.redis = pong === 'PONG' ? 'ok' : 'fail';
      } catch {
        checks.redis = 'fail';
      }
    }

    const status =
      checks.postgres === 'fail' || checks.redis === 'fail' ? 'degraded' : 'ok';
    return { status, checks };
  }
}
