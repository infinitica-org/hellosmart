import { Global, Module } from '@nestjs/common';

/** Redis access goes through modules/redis (node-redis). This module is a no-op shim. */
@Global()
@Module({})
export class RedisModule {}
