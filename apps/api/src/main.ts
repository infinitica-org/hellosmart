import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { pino } from 'pino';
import { AppModule } from './app.module.js';
import { createPinoOptions } from './common/logger/pino-redact.js';
import { loadConfig } from './config/config.js';

async function bootstrap(): Promise<void> {
  const config = loadConfig();

  const logger = pino(createPinoOptions());

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      trustProxy: true,
      bodyLimit: 1_048_576,
      genReqId: () => crypto.randomUUID(),
      logger,
    }),
    { bufferLogs: true },
  );

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

  await app.listen(config.PORT, '0.0.0.0');
  logger.info({ port: config.PORT }, 'API listening');
}

void bootstrap();
