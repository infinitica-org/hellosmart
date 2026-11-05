import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module.js';
import { DatabaseModule } from './modules/database/database.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { ObservabilityModule } from './modules/observability/observability.module.js';
import { OpsQueueModule } from './modules/ops-queue/ops-queue.module.js';
import { RedisModule } from './modules/redis/redis.module.js';

@Module({
  imports: [
    AppConfigModule,
    ObservabilityModule.forRoot(),
    DatabaseModule,
    RedisModule,
    HealthModule,
    OpsQueueModule,
  ],
})
export class WorkerModule {}
