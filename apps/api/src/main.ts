import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import { loadConfig } from './config/config.js';
import {
  createLogger,
  AppLoggerService,
  resolveRequestId,
  registerLoggingHooks,
  setSharedLogger,
} from './modules/observability/index.js';

async function bootstrap(): Promise<void> {
  const config = loadConfig();

  const logger = createLogger({ level: config.LOG_LEVEL });
  setSharedLogger(logger);
  const appLogger = new AppLoggerService(logger);

  const adapter = new FastifyAdapter({
    trustProxy: true, // behind ALB; client IP from X-Forwarded-For for audit + throttling
    bodyLimit: 1_048_576, // 1 MB; bulk uploads go to S3 via presigned URLs
    logger,
    disableRequestLogging: true,
    genReqId: resolveRequestId,
    ignoreTrailingSlash: true,
  });

  registerLoggingHooks(adapter.getInstance());

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.forRoot({ logger }),
    adapter,
    { bufferLogs: true },
  );

  app.useLogger(appLogger);

  await app.register(helmet, {
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    hsts: { maxAge: 63_072_000, includeSubDomains: true, preload: true },
    referrerPolicy: { policy: 'no-referrer' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
  await app.register(cookie, { secret: config.SESSION_SECRET });

  app.enableCors({ origin: config.CORS_ORIGINS, credentials: true });
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();

  appLogger.log('Starting HelloSmart API...', 'Bootstrap');
  await app.listen(config.PORT, '0.0.0.0');
  appLogger.log(`HelloSmart API listening on port ${config.PORT} [${config.NODE_ENV}]`, 'Bootstrap');
}

void bootstrap();
