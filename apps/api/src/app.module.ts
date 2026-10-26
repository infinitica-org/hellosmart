import { Module } from '@nestjs/common';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { RedisModule } from './common/redis/redis.module.js';
import { DatabaseModule } from './common/database/database.module.js';
import { SessionGuard } from './common/guards/session.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { ProblemDetailsFilter } from './common/exceptions/problem-details.filter.js';

@Module({
  imports: [
    RedisModule,
    DatabaseModule,
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
      provide: APP_FILTER,
      useClass: ProblemDetailsFilter,
    },
  ],
})
export class AppModule {}
