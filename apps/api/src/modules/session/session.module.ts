import { Global, Module } from '@nestjs/common';
import { APP_CONFIG } from '../../config/config.tokens.js';
import type { Config } from '../../config/config.js';
import { REDIS_CLIENT, type HelloRedisClient } from '../redis/redis.tokens.js';
import { createIdempotencyStore, createSessionStore } from './session-store.factory.js';
import { SessionService } from './session.service.js';
import { IDEMPOTENCY_STORE, SESSION_STORE } from './session.tokens.js';
import type { IdempotencyStore, SessionStore } from './session.types.js';

@Global()
@Module({
  providers: [
    {
      provide: SESSION_STORE,
      useFactory: (config: Config, redis: HelloRedisClient): SessionStore =>
        createSessionStore(config, redis),
      inject: [APP_CONFIG, REDIS_CLIENT],
    },
    {
      provide: IDEMPOTENCY_STORE,
      useFactory: (config: Config, redis: HelloRedisClient): IdempotencyStore =>
        createIdempotencyStore(config, redis),
      inject: [APP_CONFIG, REDIS_CLIENT],
    },
    SessionService,
  ],
  exports: [SESSION_STORE, IDEMPOTENCY_STORE, SessionService],
})
export class SessionModule {}
