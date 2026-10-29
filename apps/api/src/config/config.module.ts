import { Global, Module } from '@nestjs/common';
import { loadConfig } from './config.js';
import { APP_CONFIG } from './config.tokens.js';

@Global()
@Module({
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: () => loadConfig(),
    },
  ],
  exports: [APP_CONFIG],
})
export class AppConfigModule {}
