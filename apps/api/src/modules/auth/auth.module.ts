import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import pg from 'pg';
import { loadConfig } from '../../config/config.js';
import { MailService } from '../../common/services/mail.service.js';
import { HasherService } from './hasher.service.js';
import { DB_POOL, InvitationsService } from './invitations.service.js';
import { InvitationsController } from './invitations.controller.js';
import { ThrottlerProblemFilter } from './auth-exception.filter.js';

@Module({
  imports: [
    // Rate limiting: 10 requests per hour per IP.
    // Multi-Instance Deployment Note:
    // Uses default in-memory storage for single-instance / local testing.
    // When deploying horizontally scaled API replicas behind an AWS ALB (Sprint 1 / S0-T10),
    // wire ThrottlerStorageRedisService using the shared REDIS_URL so rate counters are cluster-wide.
    ThrottlerModule.forRoot([
      {
        ttl: 3600000, // 1 hour window
        limit: 10,    // 10 requests per window
      },
    ]),
  ],
  controllers: [InvitationsController],
  providers: [
    HasherService,
    InvitationsService,
    MailService,
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
  exports: [InvitationsService, HasherService, MailService, DB_POOL],
})
export class AuthModule {}

