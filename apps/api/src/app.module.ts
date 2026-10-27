import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter.js';
import { OrgScopeGuard } from './common/guards/org-scope.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { SessionGuard } from './common/guards/session.guard.js';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor.js';
import { AppConfigModule } from './config/config.module.js';
import { AdaptersModule } from './modules/adapters/adapters.module.js';
import { DevTestController } from './modules/dev/dev-test.controller.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { RedisModule } from './modules/redis/redis.module.js';
import { SessionModule } from './modules/session/session.module.js';

const devControllers =
  process.env.NODE_ENV === 'production' ? [] : [DevTestController];

@Module({
  imports: [
    AppConfigModule,
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 120 },
      { name: 'login', ttl: 60_000, limit: 5 },
    ]),
    RedisModule,
    SessionModule,
    AdaptersModule,
    AuthModule,
    HealthModule,
  ],
  controllers: [...devControllers],
  providers: [
    ProblemDetailsFilter,
    SessionGuard,
    RolesGuard,
    OrgScopeGuard,
    IdempotencyInterceptor,
    { provide: APP_FILTER, useExisting: ProblemDetailsFilter },
    { provide: APP_GUARD, useExisting: SessionGuard },
    { provide: APP_GUARD, useExisting: RolesGuard },
    { provide: APP_GUARD, useExisting: OrgScopeGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useExisting: IdempotencyInterceptor },
  ],
})
export class AppModule {}
