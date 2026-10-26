import 'reflect-metadata';
import { Writable } from 'node:stream';
import { Controller, Get, Inject, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  AppLoggerService,
  createLogger,
  DEFAULT_REDACT_PATHS,
  ObservabilityModule,
  PINO_LOGGER,
  resolveRequestId,
  SERVICE_NAME,
} from '../src/modules/observability/index.js';

@Controller('sample')
class SampleController {
  constructor(@Inject(AppLoggerService) private readonly logger: AppLoggerService) {}

  @Get('ping')
  ping() {
    this.logger.log('Ping endpoint called', 'SampleController');
    return { pong: true };
  }
}



describe('AppLoggerService & Configuration', () => {
  let capturedLogs: Record<string, any>[];
  let memoryStream: Writable;

  beforeEach(() => {
    capturedLogs = [];
    memoryStream = new Writable({
      write(chunk, _encoding, callback) {
        try {
          capturedLogs.push(JSON.parse(chunk.toString()));
        } catch {
          // ignore unparseable
        }
        callback();
      },
    });
  });

  describe('createLogger', () => {
    it('creates a Pino logger with default service name and redaction configuration', () => {
      const logger = createLogger({}, memoryStream);
      expect(logger).toBeDefined();

      logger.info('Test basic log');
      expect(capturedLogs.length).toBe(1);
      expect(capturedLogs[0]?.name).toBe(SERVICE_NAME);
      expect(capturedLogs[0]?.level).toBe(30); // info
      expect(capturedLogs[0]?.msg).toBe('Test basic log');
    });

    it('respects configurable log levels', () => {
      const warnLogger = createLogger({ level: 'warn' }, memoryStream);
      warnLogger.info('This info should be ignored');
      warnLogger.warn('This warning should be emitted');

      expect(capturedLogs.length).toBe(1);
      expect(capturedLogs[0]?.level).toBe(40); // warn
      expect(capturedLogs[0]?.msg).toBe('This warning should be emitted');
    });

    it('includes default sensitive paths in redaction rules', () => {
      expect(DEFAULT_REDACT_PATHS).toContain('req.headers.authorization');
      expect(DEFAULT_REDACT_PATHS).toContain('req.headers.cookie');
      expect(DEFAULT_REDACT_PATHS).toContain('password');
      expect(DEFAULT_REDACT_PATHS).toContain('*.password');
      expect(DEFAULT_REDACT_PATHS).toContain('token');
      expect(DEFAULT_REDACT_PATHS).toContain('secret');
      expect(DEFAULT_REDACT_PATHS).toContain('apiKey');
    });

    it('redacts nested passwords, tokens, and secrets across multiple structures', () => {
      const logger = createLogger({}, memoryStream);
      logger.info({
        db: {
          password: 'db-super-secret-password',
        },
        auth: {
          token: 'jwt-access-token-live',
          secret: 'oauth-client-secret',
        },
        apiKey: 'sk_live_1234567890',
        DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
      });

      expect(capturedLogs.length).toBe(1);
      const log = capturedLogs[0]!;
      expect(log.db?.password).toBe('[REDACTED]');
      expect(log.auth?.token).toBe('[REDACTED]');
      expect(log.auth?.secret).toBe('[REDACTED]');
      expect(log.apiKey).toBe('[REDACTED]');
      expect(log.DATABASE_URL).toBe('[REDACTED]');
    });
  });

  describe('AppLoggerService NestJS Integration', () => {
    it('implements LoggerService methods with context attribution', () => {
      const rootLogger = createLogger({ level: 'trace' }, memoryStream);
      const appLogger = new AppLoggerService(rootLogger);

      appLogger.log('System initialized', 'BootstrapContext');
      appLogger.warn('Resource usage high', 'MetricsContext');
      appLogger.debug('Cache hit count: 5', 'CacheContext');
      appLogger.verbose('Detailed trace event', 'TraceContext');

      expect(capturedLogs.length).toBe(4);

      expect(capturedLogs[0]?.level).toBe(30); // info
      expect(capturedLogs[0]?.msg).toBe('System initialized');
      expect(capturedLogs[0]?.context).toBe('BootstrapContext');

      expect(capturedLogs[1]?.level).toBe(40); // warn
      expect(capturedLogs[1]?.msg).toBe('Resource usage high');
      expect(capturedLogs[1]?.context).toBe('MetricsContext');

      expect(capturedLogs[2]?.level).toBe(20); // debug
      expect(capturedLogs[2]?.msg).toBe('Cache hit count: 5');
      expect(capturedLogs[2]?.context).toBe('CacheContext');

      expect(capturedLogs[3]?.level).toBe(10); // trace
      expect(capturedLogs[3]?.msg).toBe('Detailed trace event');
      expect(capturedLogs[3]?.context).toBe('TraceContext');
    });

    it('formats error logs with message, stack trace, and context', () => {
      const rootLogger = createLogger({}, memoryStream);
      const appLogger = new AppLoggerService(rootLogger);

      const fakeTrace = 'Error: DB failure\n    at Repository.query (/src/repo.ts:42:15)';
      appLogger.error('Failed to query database', fakeTrace, 'DatabaseRepository');

      expect(capturedLogs.length).toBe(1);
      const log = capturedLogs[0]!;
      expect(log.level).toBe(50); // error
      expect(log.msg).toBe('Failed to query database');
      expect(log.trace).toBe(fakeTrace);
      expect(log.context).toBe('DatabaseRepository');
    });

    it('handles object-based log payloads correctly', () => {
      const rootLogger = createLogger({}, memoryStream);
      const appLogger = new AppLoggerService(rootLogger);

      appLogger.log({ event: 'USER_LOGIN', userId: 'user-123' }, 'AuthService');

      expect(capturedLogs.length).toBe(1);
      const log = capturedLogs[0]!;
      expect(log.event).toBe('USER_LOGIN');
      expect(log.userId).toBe('user-123');
      expect(log.context).toBe('AuthService');
    });

    it('injects AppLoggerService into NestJS controllers and services via ObservabilityModule', async () => {
      const rootLogger = createLogger({}, memoryStream);
      const adapter = new FastifyAdapter();

      @Module({
        imports: [ObservabilityModule.forRoot({ logger: rootLogger })],
        controllers: [SampleController],
      })
      class DynamicSampleModule {}

      const app = await NestFactory.create<NestFastifyApplication>(DynamicSampleModule, adapter, {
        logger: false,
      });

      await app.init();
      await app.getHttpAdapter().getInstance().ready();

      const res = await app.getHttpAdapter().getInstance().inject({
        method: 'GET',
        url: '/sample/ping',
      });

      expect(res.statusCode).toBe(200);

      const pingLog = capturedLogs.find((l) => l.msg === 'Ping endpoint called');
      expect(pingLog).toBeDefined();
      expect(pingLog?.context).toBe('SampleController');

      await app.close();
    });
  });

  describe('resolveRequestId correlation helper', () => {
    it('accepts valid x-request-id header', () => {
      const id = resolveRequestId({ headers: { 'x-request-id': 'custom-req-id-123' } });
      expect(id).toBe('custom-req-id-123');
    });

    it('accepts valid x-correlation-id header when x-request-id is absent', () => {
      const id = resolveRequestId({ headers: { 'x-correlation-id': 'trace-abc-xyz' } });
      expect(id).toBe('trace-abc-xyz');
    });

    it('rejects malicious or invalid request ID values and generates a safe UUIDv4', () => {
      const injectionAttempt = 'req-123; DROP TABLE users;--';
      const resolved = resolveRequestId({ headers: { 'x-request-id': injectionAttempt } });

      expect(resolved).not.toBe(injectionAttempt);
      expect(resolved).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it('rejects overly long request ID values (> 64 characters)', () => {
      const oversized = 'a'.repeat(65);
      const resolved = resolveRequestId({ headers: { 'x-request-id': oversized } });

      expect(resolved).not.toBe(oversized);
      expect(resolved).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });
  });
});
