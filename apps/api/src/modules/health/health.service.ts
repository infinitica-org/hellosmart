import { Inject, Injectable } from '@nestjs/common';
import pg from 'pg';
import { APP_CONFIG } from '../../config/config.tokens.js';
import type { Config } from '../../config/config.js';
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
  ) {}

  liveness(): { status: 'ok' } {
    return { status: 'ok' };
  }

  async readiness(): Promise<HealthReadyResponse> {
    const checks: HealthReadyResponse['checks'] = { api: 'ok', postgres: 'skipped', redis: 'skipped' };

    try {
      const pool = new pg.Pool({
        connectionString: this.config.DATABASE_URL,
        max: 1,
        connectionTimeoutMillis: 2_000,
      });
      await pool.query('SELECT 1');
      checks.postgres = 'ok';
      await pool.end();
    } catch {
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
