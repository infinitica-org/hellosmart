import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import { loadConfig } from './config/config.js';
import {
  createLogger,
  AppLoggerService,
  resolveRequestId,
  registerLoggingHooks,
} from './modules/observability/index.js';

async function bootstrap(): Promise<void> {
  const config = loadConfig(); // fails fast on missing/invalid env (zod)

  const logger = createLogger({ level: config.LOG_LEVEL });
  const appLogger = new AppLoggerService(logger);

  const adapter = new FastifyAdapter({
    trustProxy: true, // behind ALB; client IP from X-Forwarded-For for audit + throttling
    bodyLimit: 1_048_576, // 1 MB; bulk uploads go to S3 via presigned URLs
    logger,
    disableRequestLogging: true,
    genReqId: resolveRequestId,
  });

  registerLoggingHooks(adapter.getInstance());

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    adapter,
    { bufferLogs: true },
  );

  app.useLogger(appLogger);

  // Ensure @fastify plugins with 5.x metadata remain compatible with Fastify 4 runtime
  const pluginMeta = Symbol.for('plugin-meta');
  if ((helmet as any)[pluginMeta]) {
    (helmet as any)[pluginMeta].fastify = '>=4.0.0';
  }
  if ((cookie as any)[pluginMeta]) {
    (cookie as any)[pluginMeta].fastify = '>=4.0.0';
  }

  await app.register(helmet, {
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    hsts: { maxAge: 63_072_000, includeSubDomains: true, preload: true },
    referrerPolicy: { policy: 'no-referrer' },
    crossOriginResourcePolicy: { policy: 'same-site' },
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
