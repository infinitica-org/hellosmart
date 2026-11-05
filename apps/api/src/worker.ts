import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { loadConfig } from './config/config.js';
import {
  AppLoggerService,
  createLogger,
  registerLoggingHooks,
  setSharedLogger,
} from './modules/observability/index.js';
import { startTelemetry } from './modules/observability/telemetry.js';
import { WorkerModule } from './worker.module.js';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  process.env.OTEL_SERVICE_NAME = 'hellosmart-worker';
  await startTelemetry('hellosmart-worker');

  const logger = createLogger({ level: config.LOG_LEVEL, name: 'hellosmart-worker' });
  setSharedLogger(logger);
  const appLogger = new AppLoggerService(logger);

  const adapter = new FastifyAdapter({
    logger,
    disableRequestLogging: true,
  });
  registerLoggingHooks(adapter.getInstance());

  const app = await NestFactory.create<NestFastifyApplication>(WorkerModule, adapter, {
    bufferLogs: true,
  });
  app.useLogger(appLogger);
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();

  appLogger.log(
    `Starting HelloSmart worker env=${config.NODE_ENV} poolMax=${config.PG_POOL_MAX}`,
    'Bootstrap',
  );
  await app.listen(config.WORKER_HEALTH_PORT, '0.0.0.0');
  appLogger.log(`HelloSmart worker health on port ${config.WORKER_HEALTH_PORT}`, 'Bootstrap');
}

void bootstrap();
