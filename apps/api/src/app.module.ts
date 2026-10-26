import { Module } from '@nestjs/common';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { RedisModule } from './common/redis/redis.module.js';
import { DatabaseModule } from './common/database/database.module.js';
import { AuditModule } from './common/audit/audit.module.js';
import { SessionGuard } from './common/guards/session.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { TenantContextInterceptor } from './common/interceptors/tenant-context.interceptor.js';
import { ProblemDetailsFilter } from './common/exceptions/problem-details.filter.js';

@Module({
  imports: [
    RedisModule,
    DatabaseModule,
    AuditModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: SessionGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantContextInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: ProblemDetailsFilter,
    },
  ],
})
export class AppModule {}
