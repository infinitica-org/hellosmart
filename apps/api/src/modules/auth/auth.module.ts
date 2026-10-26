import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule, type ThrottlerStorage } from '@nestjs/throttler';
import pg from 'pg';
import { Redis } from 'ioredis';
import { AwsSecretsManagerStore, MemorySecretStore } from '@hs/adapters';
import { loadConfig } from '../../config/config.js';
import { MailService } from '../../common/services/mail.service.js';
import { HasherService } from './hasher.service.js';
import { MfaService } from './mfa.service.js';
import { DB_POOL, InvitationsService } from './invitations.service.js';
import { SECRET_STORE } from './secret-store.interface.js';
import { InvitationsController } from './invitations.controller.js';
import { AuthController, MeController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SessionService } from './session/session.service.js';
import { SESSION_STORE } from './session/session.interface.js';
import { MemorySessionStore } from './session/memory.session.store.js';
import { RedisSessionStore } from './session/redis.session.store.js';
import { ThrottlerStorageRedis } from './session/throttler-storage-redis.js';
import { SessionGuard } from './guards/session.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { ThrottlerProblemFilter } from './auth-exception.filter.js';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      useFactory: () => {
        let isStrict = false;
        let redisClient: Redis | null = null;
        try {
          const config = loadConfig();
          isStrict = config.NODE_ENV === 'production' || config.NODE_ENV === 'staging';
          if (config.REDIS_URL) {
            redisClient = new Redis(config.REDIS_URL, {
              lazyConnect: true,
              maxRetriesPerRequest: 2,
            });
          }
        } catch {
          // ignore config load errors during non-runtime tasks
        }

        const storage = new ThrottlerStorageRedis(redisClient, { strictMode: isStrict });

        return {
          throttlers: [
            {
              ttl: 3600000, // 1 hour window for general endpoints
              limit: 10,
            },
          ],
          storage,
        };
      },
    }),
  ],
  controllers: [AuthController, MeController, InvitationsController],
  providers: [
    HasherService,
    MfaService,
    SessionService,
    AuthService,
    InvitationsService,
    MailService,
    SessionGuard,
    RolesGuard,
    {
      provide: SESSION_STORE,
      useFactory: async () => {
        const nodeEnv = process.env.NODE_ENV;
        if (nodeEnv === 'test') {
          return new MemorySessionStore();
        }

        let config: ReturnType<typeof loadConfig>;
        try {
          config = loadConfig();
        } catch (err) {
          if (nodeEnv === 'production' || nodeEnv === 'staging') {
            throw err;
          }
          return new MemorySessionStore();
        }

        const isProduction = config.NODE_ENV === 'production' || config.NODE_ENV === 'staging';

        if (isProduction) {
          if (!config.REDIS_URL) {
            throw new Error(
              'FATAL: REDIS_URL must be configured in production/staging environments. Silent in-memory session fallback is prohibited.',
            );
          }
          const store = new RedisSessionStore(config.REDIS_URL);
          const isHealthy = await store.ping();
          if (!isHealthy) {
            throw new Error(
              'FATAL: Failed to connect to Redis session store during startup verification.',
            );
          }
          return store;
        }

        if (config.REDIS_URL) {
          try {
            const store = new RedisSessionStore(config.REDIS_URL);
            const isHealthy = await store.ping();
            if (isHealthy) {
              return store;
            }
          } catch {
            // fallback in development
          }
        }
        return new MemorySessionStore();
      },
    },
    {
      provide: SECRET_STORE,
      useFactory: () => {
        if (process.env.NODE_ENV === 'test') {
          return null;
        }
        try {
          const config = loadConfig();
          if (config.SECRET_STORE_PROVIDER === 'fake') {
            return new MemorySecretStore();
          }
          return new AwsSecretsManagerStore({
            region: config.AWS_REGION,
            ...(config.AWS_SECRETS_MANAGER_ENDPOINT ? { endpoint: config.AWS_SECRETS_MANAGER_ENDPOINT } : {}),
          });
        } catch {
          if (process.env.NODE_ENV === 'development') {
            return new MemorySecretStore();
          }
          return new AwsSecretsManagerStore();
        }
      },
    },
    {
      provide: DB_POOL,
      useFactory: () => {
        try {
          const config = loadConfig();
          return new pg.Pool({ connectionString: config.DATABASE_URL });
        } catch {
          return null;
        }
      },
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: ThrottlerProblemFilter,
    },
  ],
  exports: [
    AuthService,
    MfaService,
    SessionService,
    InvitationsService,
    HasherService,
    MailService,
    SessionGuard,
    RolesGuard,
    SESSION_STORE,
    SECRET_STORE,
    DB_POOL,
  ],
})
export class AuthModule {}
