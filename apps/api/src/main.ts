import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import { loadConfig } from './config/config.js';
import {
  createHelmetOptions,
  createCorsOptions,
  DEFAULT_BODY_LIMIT_BYTES,
} from './config/security.config.js';
import {
  createLogger,
  AppLoggerService,
  resolveRequestId,
  registerLoggingHooks,
  setSharedLogger,
} from './modules/observability/index.js';
import { registerWebhookRawBodyParser } from './modules/webhooks/calcom/calcom-webhook-parser.js';

async function bootstrap(): Promise<void> {
  const config = loadConfig();

  const logger = createLogger({ level: config.LOG_LEVEL });
  setSharedLogger(logger);
  const appLogger = new AppLoggerService(logger);

  const adapter = new FastifyAdapter({
    trustProxy: true, // behind ALB; client IP from X-Forwarded-For for audit + throttling
    bodyLimit: DEFAULT_BODY_LIMIT_BYTES, // 1 MB; bulk uploads go to S3 via presigned URLs
    logger,
    disableRequestLogging: true,
    genReqId: resolveRequestId,
    ignoreTrailingSlash: true,
  });

  registerLoggingHooks(adapter.getInstance());
  registerWebhookRawBodyParser(adapter.getInstance());

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.forRoot({ logger }),
    adapter,
    { bufferLogs: true },
  );

  app.useLogger(appLogger);

  await app.register(helmet, createHelmetOptions(config));
  await app.register(cookie, { secret: config.SESSION_SECRET });
  await app.register(multipart, {
    limits: {
      fileSize: 52_428_800, // 50 MB
      files: 1,
      fields: 10,
    },
    attachFieldsToBody: false,
  });

  app.enableCors(createCorsOptions(config));
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();

  appLogger.log('Starting HelloSmart API...', 'Bootstrap');
  await app.listen(config.PORT, '0.0.0.0');
  appLogger.log(
    `HelloSmart API listening on port ${config.PORT} [${config.NODE_ENV}]`,
    'Bootstrap',
  );
}

void bootstrap();
