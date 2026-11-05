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
import { loadConfig } from '../../config/config.js';

let activeSharedLogger: Logger | undefined;

export function setSharedLogger(logger?: Logger): void {
  activeSharedLogger = logger;
}

export function getSharedLogger(): Logger | undefined {
  return activeSharedLogger;
}

function resolveEffectiveLogger(configOptions?: CreateLoggerOptions): Logger {
  if (activeSharedLogger) {
    return activeSharedLogger;
  }
  if (configOptions) {
    return createLogger(configOptions);
  }
  try {
    const config = loadConfig();
    return createLogger({ level: config.LOG_LEVEL });
  } catch {
    return createLogger();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: PINO_LOGGER,
      useFactory: () => resolveEffectiveLogger(),
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
    if (options?.logger) {
      setSharedLogger(options.logger);
    }

    const loggerProvider = {
      provide: PINO_LOGGER,
      useFactory: () => resolveEffectiveLogger(options?.config),
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
