import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { createClient } from 'redis';
import { APP_CONFIG } from '../../config/config.tokens.js';
import type { Config } from '../../config/config.js';
import { REDIS_CLIENT, type HelloRedisClient } from './redis.tokens.js';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: async (config: Config): Promise<HelloRedisClient> => {
        if (!config.REDIS_URL) {
          return null;
        }
        const client = createClient({
          url: config.REDIS_URL,
          name: 'hellosmart-api',
          socket: {
            keepAlive: 5_000,
            connectTimeout: 3_000,
            reconnectStrategy: (retries: number) => Math.min(retries * 50, 2_000),
          },
        });
        client.on('error', () => {
          // Connection errors are surfaced on command failure; avoid logging URLs or secrets.
        });
        await client.connect();
        return client as HelloRedisClient;
      },
      inject: [APP_CONFIG],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: HelloRedisClient) {}

  async onModuleDestroy(): Promise<void> {
    if (this.redis?.isOpen) {
      await this.redis.quit();
    }
  }
}
