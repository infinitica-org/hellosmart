import {
  type DynamicModule,
  Global,
  Inject,
  Module,
  type OnApplicationShutdown,
  Optional,
} from '@nestjs/common';
import type { Logger } from 'pino';
import { AppLoggerService, PINO_LOGGER } from './logger.service.js';
import { createLogger, type CreateLoggerOptions } from './logger.config.js';

@Global()
@Module({
  providers: [
    {
      provide: PINO_LOGGER,
      useFactory: () => createLogger(),
    },
    AppLoggerService,
  ],
  exports: [AppLoggerService, PINO_LOGGER],
})
export class ObservabilityModule implements OnApplicationShutdown {
  constructor(
    @Optional() @Inject(AppLoggerService) private readonly logger?: AppLoggerService,
  ) {}

  static forRoot(options?: { logger?: Logger; config?: CreateLoggerOptions }): DynamicModule {
    const loggerProvider = {
      provide: PINO_LOGGER,
      useValue: options?.logger ?? createLogger(options?.config),
    };

    return {
      module: ObservabilityModule,
      global: true,
      providers: [loggerProvider, AppLoggerService],
      exports: [AppLoggerService, PINO_LOGGER],
    };
  }

  onApplicationShutdown(signal?: string): void {
    if (this.logger) {
      this.logger.log(
        `HelloSmart API shutting down (signal: ${signal ?? 'graceful'})...`,
        'Shutdown',
      );
    }
  }
}
