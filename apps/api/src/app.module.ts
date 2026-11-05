import crypto from 'node:crypto';
import { type DynamicModule, ExecutionContext, Injectable, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { Logger } from 'pino';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter.js';
import { CsrfOriginGuard } from './common/guards/csrf-origin.guard.js';
import { OrgScopeGuard } from './common/guards/org-scope.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { SessionGuard } from './common/guards/session.guard.js';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor.js';
import { DatabaseModule as CommonDatabaseModule } from './common/database/database.module.js';
import { RedisModule as CommonRedisModule } from './common/redis/redis.module.js';
import { AppConfigModule } from './config/config.module.js';
import { DatabaseModule } from './modules/database/database.module.js';
import { AdaptersModule } from './modules/adapters/adapters.module.js';
import { DevTestController } from './modules/dev/dev-test.controller.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CandidatesModule } from './modules/candidates/candidates.module.js';
import { TemplatesModule } from './modules/templates/templates.module.js';
import { AssessmentsModule } from './modules/assessments/assessments.module.js';
import { AssignmentsModule } from './modules/assignments/assignments.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { StorageModule } from './common/storage/storage.module.js';
import { JobsModule } from './modules/jobs/jobs.module.js';
import { CalcomWebhookModule } from './modules/webhooks/calcom/calcom-webhook.module.js';
import { QuotesModule } from './modules/quotes/quotes.module.js';
import { ObservabilityModule } from './modules/observability/observability.module.js';
import { RedisModule } from './modules/redis/redis.module.js';
import { REDIS_CLIENT, type HelloRedisClient } from './modules/redis/redis.tokens.js';
import { RedisThrottlerStorage } from './modules/redis/redis-throttler.storage.js';
import { SessionModule } from './modules/session/session.module.js';

@Injectable()
export class DevAwareThrottlerGuard extends ThrottlerGuard {
  protected override async shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (process.env.NODE_ENV === 'development') {
      return true;
    }
    return super.shouldSkip(context);
  }

  protected override async getTracker(req: Record<string, any>): Promise<string> {
    const token = req?.params?.token;
    if (typeof token === 'string' && token.trim().length > 0) {
      const tokenHashPrefix = crypto
        .createHash('sha256')
        .update(token.trim())
        .digest('hex')
        .slice(0, 16);
      return `quote_${tokenHashPrefix}`;
    }
    return super.getTracker(req);
  }
}

const devControllers =
  process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
    ? [DevTestController]
    : [];

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    CommonDatabaseModule,
    ObservabilityModule,
    RedisModule,
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [REDIS_CLIENT],
      useFactory: (redis: HelloRedisClient) => ({
        throttlers:
          process.env.NODE_ENV === 'test'
            ? [
                { name: 'default', ttl: 60_000, limit: 1_000_000 },
                { name: 'login', ttl: 60_000, limit: 1_000_000 },
              ]
            : [
                { name: 'default', ttl: 60_000, limit: 100 },
                { name: 'login', ttl: 60_000, limit: 5 },
              ],
        storage: new RedisThrottlerStorage(redis),
      }),
    }),
    CommonRedisModule,
    SessionModule,
    AdaptersModule,
    AuthModule,
    AdminModule,
    CandidatesModule,
    TemplatesModule,
    AssessmentsModule,
    AssignmentsModule,
    HealthModule,
    StorageModule,
    JobsModule,
    CalcomWebhookModule,
    QuotesModule,
  ],
  controllers: [...devControllers],
  providers: [
    Reflector,
    ProblemDetailsFilter,
    CsrfOriginGuard,
    SessionGuard,
    RolesGuard,
    OrgScopeGuard,
    IdempotencyInterceptor,
    { provide: APP_FILTER, useExisting: ProblemDetailsFilter },
    { provide: APP_GUARD, useClass: DevAwareThrottlerGuard },
    { provide: APP_GUARD, useExisting: CsrfOriginGuard },
    { provide: APP_GUARD, useExisting: SessionGuard },
    { provide: APP_GUARD, useExisting: RolesGuard },
    { provide: APP_GUARD, useExisting: OrgScopeGuard },
    { provide: APP_INTERCEPTOR, useExisting: IdempotencyInterceptor },
  ],
})
export class AppModule {
  static forRoot(options?: { logger?: Logger }): DynamicModule {
    const observability = options?.logger
      ? ObservabilityModule.forRoot({ logger: options.logger })
      : ObservabilityModule.forRoot();

    return {
      module: AppModule,
      imports: [observability],
    };
  }
}
