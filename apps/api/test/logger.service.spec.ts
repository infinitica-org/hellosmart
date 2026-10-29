import 'reflect-metadata';
import { Writable } from 'node:stream';
import { Controller, Get, Inject, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { Public } from '../src/common/decorators/public.decorator.js';
import {
  AppLoggerService,
  createLogger,
  DEFAULT_REDACT_PATHS,
  normalizePath,
  ObservabilityModule,
  PINO_LOGGER,
  resolveRequestId,
  sanitizeErrorMessage,
  SERVICE_NAME,
} from '../src/modules/observability/index.js';

@Controller('sample')
class SampleController {
  constructor(@Inject(AppLoggerService) private readonly logger: AppLoggerService) {}

  @Public()
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

    it('includes all required sensitive path variants in redaction rules (SEC-02)', () => {
      // Basic credentials
      expect(DEFAULT_REDACT_PATHS).toContain('password');
      expect(DEFAULT_REDACT_PATHS).toContain('*.password');
      expect(DEFAULT_REDACT_PATHS).toContain('token');
      expect(DEFAULT_REDACT_PATHS).toContain('*.token');
      expect(DEFAULT_REDACT_PATHS).toContain('secret');
      expect(DEFAULT_REDACT_PATHS).toContain('*.secret');

      // Tokens variants
      expect(DEFAULT_REDACT_PATHS).toContain('accessToken');
      expect(DEFAULT_REDACT_PATHS).toContain('*.accessToken');
      expect(DEFAULT_REDACT_PATHS).toContain('access_token');
      expect(DEFAULT_REDACT_PATHS).toContain('*.access_token');
      expect(DEFAULT_REDACT_PATHS).toContain('refreshToken');
      expect(DEFAULT_REDACT_PATHS).toContain('*.refreshToken');
      expect(DEFAULT_REDACT_PATHS).toContain('refresh_token');
      expect(DEFAULT_REDACT_PATHS).toContain('*.refresh_token');

      // API key variants
      expect(DEFAULT_REDACT_PATHS).toContain('apiKey');
      expect(DEFAULT_REDACT_PATHS).toContain('*.apiKey');
      expect(DEFAULT_REDACT_PATHS).toContain('api_key');
      expect(DEFAULT_REDACT_PATHS).toContain('*.api_key');

      // Secrets variants
      expect(DEFAULT_REDACT_PATHS).toContain('sessionSecret');
      expect(DEFAULT_REDACT_PATHS).toContain('*.sessionSecret');
      expect(DEFAULT_REDACT_PATHS).toContain('session_secret');
      expect(DEFAULT_REDACT_PATHS).toContain('*.session_secret');
      expect(DEFAULT_REDACT_PATHS).toContain('clientSecret');
      expect(DEFAULT_REDACT_PATHS).toContain('*.clientSecret');
      expect(DEFAULT_REDACT_PATHS).toContain('client_secret');
      expect(DEFAULT_REDACT_PATHS).toContain('*.client_secret');
      expect(DEFAULT_REDACT_PATHS).toContain('PLATFORM_ADMIN_MFA_SECRET');
      expect(DEFAULT_REDACT_PATHS).toContain('mfaSecret');
      expect(DEFAULT_REDACT_PATHS).toContain('*.mfaSecret');
      expect(DEFAULT_REDACT_PATHS).toContain('mfa_secret');
      expect(DEFAULT_REDACT_PATHS).toContain('*.mfa_secret');
      expect(DEFAULT_REDACT_PATHS).toContain('invitationToken');
      expect(DEFAULT_REDACT_PATHS).toContain('*.invitationToken');
      expect(DEFAULT_REDACT_PATHS).toContain('invitation_token');
      expect(DEFAULT_REDACT_PATHS).toContain('*.invitation_token');
      expect(DEFAULT_REDACT_PATHS).toContain('recoveryCode');
      expect(DEFAULT_REDACT_PATHS).toContain('*.recoveryCode');
      expect(DEFAULT_REDACT_PATHS).toContain('recovery_code');
      expect(DEFAULT_REDACT_PATHS).toContain('*.recovery_code');
    });

    it('redacts nested passwords, tokens, secrets, and all casing variants (SEC-02)', () => {
      const logger = createLogger({}, memoryStream);
      logger.info({
        db: {
          password: 'db-super-secret-password',
        },
        auth: {
          token: 'jwt-access-token-live',
          secret: 'oauth-client-secret',
          accessToken: 'camel-access-token',
          access_token: 'snake-access-token',
          refreshToken: 'camel-refresh-token',
          refresh_token: 'snake-refresh-token',
          sessionSecret: 'camel-session-secret',
          session_secret: 'snake-session-secret',
          clientSecret: 'camel-client-secret',
          client_secret: 'snake-client-secret',
          PLATFORM_ADMIN_MFA_SECRET: 'JBSWY3DPEHPK3PXP_SUPER_SECRET',
          mfaSecret: 'mfa-totp-secret-key-123',
          mfa_secret: 'mfa-snake-secret-key-456',
          invitationToken: 'invite-token-secret-999',
          recoveryCode: 'backup-code-secret-888',
        },
        apiKey: 'sk_live_1234567890',
        api_key: 'sk_live_snake_key_999',
        DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
      });

      expect(capturedLogs.length).toBe(1);
      const log = capturedLogs[0]!;
      expect(log.db?.password).toBe('[REDACTED]');
      expect(log.auth?.token).toBe('[REDACTED]');
      expect(log.auth?.secret).toBe('[REDACTED]');
      expect(log.auth?.accessToken).toBe('[REDACTED]');
      expect(log.auth?.access_token).toBe('[REDACTED]');
      expect(log.auth?.refreshToken).toBe('[REDACTED]');
      expect(log.auth?.refresh_token).toBe('[REDACTED]');
      expect(log.auth?.sessionSecret).toBe('[REDACTED]');
      expect(log.auth?.session_secret).toBe('[REDACTED]');
      expect(log.auth?.clientSecret).toBe('[REDACTED]');
      expect(log.auth?.client_secret).toBe('[REDACTED]');
      expect(log.auth?.PLATFORM_ADMIN_MFA_SECRET).toBe('[REDACTED]');
      expect(log.auth?.mfaSecret).toBe('[REDACTED]');
      expect(log.auth?.mfa_secret).toBe('[REDACTED]');
      expect(log.auth?.invitationToken).toBe('[REDACTED]');
      expect(log.auth?.recoveryCode).toBe('[REDACTED]');
      expect(log.apiKey).toBe('[REDACTED]');
      expect(log.api_key).toBe('[REDACTED]');
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

    describe('error() parameter interpretation (COR-01)', () => {
      it('handles context-only single string parameter without misinterpreting as stack trace', () => {
        const rootLogger = createLogger({}, memoryStream);
        const appLogger = new AppLoggerService(rootLogger);

        appLogger.error('Database connection failed', 'DatabaseService');

        expect(capturedLogs.length).toBe(1);
        const log = capturedLogs[0]!;
        expect(log.level).toBe(50); // error
        expect(log.msg).toBe('Database connection failed');
        expect(log.context).toBe('DatabaseService');
        expect(log.trace).toBeUndefined();
      });

      it('handles stack-trace-only single string parameter containing newline or trace markers', () => {
        const rootLogger = createLogger({}, memoryStream);
        const appLogger = new AppLoggerService(rootLogger);

        const fakeTrace = 'Error: Connection timeout\n    at Socket.connect (/net.js:10:5)';
        appLogger.error('Connection aborted', fakeTrace);

        expect(capturedLogs.length).toBe(1);
        const log = capturedLogs[0]!;
        expect(log.level).toBe(50); // error
        expect(log.msg).toBe('Connection aborted');
        expect(log.trace).toBe(fakeTrace);
        expect(log.context).toBeUndefined();
      });

      it('formats error logs with both trace and context when both are provided', () => {
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

      it('formats error logs when passed an Error instance and context', () => {
        const rootLogger = createLogger({}, memoryStream);
        const appLogger = new AppLoggerService(rootLogger);

        const errorInstance = new Error('Socket hang up');
        appLogger.error('Network disconnect', errorInstance, 'NetworkService');

        expect(capturedLogs.length).toBe(1);
        const log = capturedLogs[0]!;
        expect(log.level).toBe(50);
        expect(log.msg).toBe('Network disconnect');
        expect(log.trace).toBe(errorInstance.stack);
        expect(log.context).toBe('NetworkService');
      });
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

    it('injects AppLoggerService into NestJS controllers and services via AppModule.forRoot (ARC-01)', async () => {
      const rootLogger = createLogger({ level: 'warn' }, memoryStream);
      const adapter = new FastifyAdapter();

      @Module({
        imports: [AppModule.forRoot({ logger: rootLogger })],
        controllers: [SampleController],
      })
      class DynamicTestAppModule {}

      const app = await NestFactory.create<NestFastifyApplication>(DynamicTestAppModule, adapter, {
        logger: false,
      });

      await app.init();
      await app.getHttpAdapter().getInstance().ready();

      const res = await app.getHttpAdapter().getInstance().inject({
        method: 'GET',
        url: '/sample/ping',
      });

      expect(res.statusCode).toBe(200);

      // Since rootLogger was configured with level: 'warn', info calls in SampleController should be suppressed
      const pingLog = capturedLogs.find((l) => l.msg === 'Ping endpoint called');
      expect(pingLog).toBeUndefined();

      // But the injected service logger directly respects the configured level and emits warn
      const injectedService = app.get(AppLoggerService);
      injectedService.warn('Injected service warning emitted', 'InjectedContext');

      expect(capturedLogs.length).toBe(1);
      expect(capturedLogs[0]?.level).toBe(40); // warn
      expect(capturedLogs[0]?.msg).toBe('Injected service warning emitted');
      expect(capturedLogs[0]?.context).toBe('InjectedContext');

      await app.close();
    });
  });

  describe('sanitizeErrorMessage security helper (SEC-01)', () => {
    it('redacts username and password in postgres URI strings', () => {
      const raw = 'connection failed to postgres://hs_app:super_secret_db_pass@127.0.0.1:5432/hellosmart';
      const sanitized = sanitizeErrorMessage(raw);
      expect(sanitized).not.toContain('super_secret_db_pass');
      expect(sanitized).toBe('connection failed to postgres://[REDACTED]@127.0.0.1:5432/hellosmart');
    });

    it('redacts password-only URIs like redis://', () => {
      const raw = 'Redis AUTH failed on redis://:mypassword123@redis.internal:6379/0';
      const sanitized = sanitizeErrorMessage(raw);
      expect(sanitized).not.toContain('mypassword123');
      expect(sanitized).toBe('Redis AUTH failed on redis://[REDACTED]@redis.internal:6379/0');
    });

    it('redacts URL-encoded credentials in URIs', () => {
      const raw = 'Error connecting to postgres://user%40domain:p%23ss%3Aword@db.host.com:5432/db';
      const sanitized = sanitizeErrorMessage(raw);
      expect(sanitized).not.toContain('p%23ss%3Aword');
      expect(sanitized).toBe('Error connecting to postgres://[REDACTED]@db.host.com:5432/db');
    });

    it('strips query parameters from error messages', () => {
      const raw = 'Cannot GET /api/v1/auth/callback?code=secret_oauth_code&state=xyz';
      const sanitized = sanitizeErrorMessage(raw);
      expect(sanitized).not.toContain('secret_oauth_code');
      expect(sanitized).toBe('Cannot GET /api/v1/auth/callback');
    });

    it('preserves clean error messages without URIs or query strings', () => {
      const raw = 'Validation failed: organization ID is required';
      const sanitized = sanitizeErrorMessage(raw);
      expect(sanitized).toBe('Validation failed: organization ID is required');
    });
  });

  describe('normalizePath health-check helper (COR-02)', () => {
    it('removes trailing slashes from routes', () => {
      expect(normalizePath('/health/')).toBe('/health');
      expect(normalizePath('/api/v1/health/')).toBe('/api/v1/health');
      expect(normalizePath('/users///')).toBe('/users');
    });

    it('preserves root path / correctly', () => {
      expect(normalizePath('/')).toBe('/');
      expect(normalizePath('///')).toBe('/');
    });

    it('preserves clean paths without trailing slashes', () => {
      expect(normalizePath('/health')).toBe('/health');
      expect(normalizePath('/api/v1/assessments')).toBe('/api/v1/assessments');
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
