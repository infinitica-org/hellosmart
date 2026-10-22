import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import { loadConfig } from './config/config.js';

async function bootstrap(): Promise<void> {
  const config = loadConfig(); // fails fast on missing/invalid env (zod)

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      trustProxy: true, // behind ALB; client IP from X-Forwarded-For for audit + throttling
      bodyLimit: 1_048_576, // 1 MB; bulk uploads go to S3 via presigned URLs
      genReqId: () => crypto.randomUUID(),
    }),
    { bufferLogs: true },
  );

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

  await app.listen(config.PORT, '0.0.0.0');
}

void bootstrap();
