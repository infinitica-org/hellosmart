import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule, type ThrottlerStorage } from '@nestjs/throttler';
import pg from 'pg';
import { Redis } from 'ioredis';
import { loadConfig } from '../../config/config.js';
import { MailService } from '../../common/services/mail.service.js';
import { HasherService } from './hasher.service.js';
import { DB_POOL, InvitationsService } from './invitations.service.js';
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
        let storage: ThrottlerStorage | undefined;
        try {
          const config = loadConfig();
          if (config.NODE_ENV !== 'test' && config.REDIS_URL) {
            const redis = new Redis(config.REDIS_URL, {
              lazyConnect: true,
              maxRetriesPerRequest: 2,
            });
            storage = new ThrottlerStorageRedis(redis);
          }
        } catch {
          // fallback to in-memory storage
        }
        return {
          throttlers: [
            {
              ttl: 3600000, // 1 hour window for general endpoints
              limit: 10,
            },
          ],
          storage: storage ?? new ThrottlerStorageRedis(null),
        };
      },
    }),
  ],
  controllers: [AuthController, MeController, InvitationsController],
  providers: [
    HasherService,
    SessionService,
    AuthService,
    InvitationsService,
    MailService,
    SessionGuard,
    RolesGuard,
    {
      provide: SESSION_STORE,
      useFactory: () => {
        try {
          const config = loadConfig();
          if (config.NODE_ENV === 'test') {
            return new MemorySessionStore();
          }
          if (config.REDIS_URL) {
            return new RedisSessionStore(config.REDIS_URL);
          }
        } catch {
          // fallback
        }
        return new MemorySessionStore();
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
    SessionService,
    InvitationsService,
    HasherService,
    MailService,
    SessionGuard,
    RolesGuard,
    SESSION_STORE,
    DB_POOL,
  ],
})
export class AuthModule {}
