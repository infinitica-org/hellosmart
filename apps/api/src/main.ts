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
  setSharedLogger,
} from './modules/observability/index.js';

async function bootstrap(): Promise<void> {
  const config = loadConfig(); // fails fast on missing/invalid env (zod)

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

  // Fastify plugin version compatibility bridge (MAINT-01):
  // @fastify/helmet@12.0.1 and @fastify/cookie@11.0.1 declare fastify: '5.x' in fastify-plugin metadata,
  // whereas NestJS 10 (@nestjs/platform-fastify@10.4.6) is pinned to Fastify 4.28.1 in the lockfile.
  // Overriding pluginMeta.fastify allows Fastify 4 to register these plugins safely at runtime
  // without risking lockfile churn. When upgrading to NestJS 11 / Fastify 5, this bridge can be retired.
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
