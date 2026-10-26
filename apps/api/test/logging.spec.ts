import { Writable } from 'node:stream';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  InternalServerErrorException,
  Module,
  Post,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AppLoggerService,
  createLogger,
  ObservabilityModule,
  registerLoggingHooks,
  REQUEST_ID_HEADER,
  resolveRequestId,
  SERVICE_NAME,
} from '../src/modules/observability/index.js';

interface LogRecord {
  level: number;
  time: number;
  name: string;
  reqId?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  responseTime?: number;
  msg?: string;
  err?: {
    message?: string;
    name?: string;
    code?: string;
  };
  context?: string;
  [key: string]: unknown;
}

@Controller('test')
class LoggingTestController {
  @Get('success')
  getSuccess() {
    return { status: 'success', data: 42 };
  }

  @Get('client-error')
  getClientError() {
    throw new BadRequestException('Validation failed: invalid organization ID');
  }

  @Get('server-error')
  getServerError() {
    throw new InternalServerErrorException('Unexpected database failure');
  }

  @Get('database-error')
  getDatabaseError() {
    throw new InternalServerErrorException(
      'Database connection failed: postgres://hs_app:super_secret_db_pass_999@localhost:5432/hellosmart?sslmode=disable&token=leak_token',
    );
  }

  @Post('credentials')
  postCredentials(@Body() body: Record<string, unknown>) {
    return { ok: true, keysReceived: Object.keys(body) };
  }

  @Get('headers-echo')
  echoHeaders(@Headers() headers: Record<string, string>) {
    return { hasAuth: Boolean(headers['authorization']), hasCookie: Boolean(headers['cookie']) };
  }
}

@Controller()
class HealthController {
  @Get('health')
  getHealth() {
    return { status: 'healthy' };
  }

  @Get('api/v1/health')
  getApiHealth() {
    return { status: 'healthy' };
  }
}

describe('Central Logging Framework (Fastify + Pino)', () => {
  let capturedLogs: LogRecord[];
  let app: NestFastifyApplication;
  let fastifyInstance: any;
  let rootLogger: any;

  beforeEach(async () => {
    capturedLogs = [];
    const memoryStream = new Writable({
      write(chunk, _encoding, callback) {
        try {
          capturedLogs.push(JSON.parse(chunk.toString()));
        } catch {
          // Ignore unparseable entries
        }
        callback();
      },
    });

    rootLogger = createLogger({ level: 'trace' }, memoryStream);
    const appLogger = new AppLoggerService(rootLogger);

    const adapter = new FastifyAdapter({
      logger: rootLogger,
      disableRequestLogging: true,
      genReqId: resolveRequestId,
      ignoreTrailingSlash: true,
    });

    registerLoggingHooks(adapter.getInstance(), {
      healthCheckPaths: ['/health', '/api/v1/health'],
      healthCheckLevel: 'debug',
    });

    @Module({
      imports: [ObservabilityModule.forRoot({ logger: rootLogger })],
      controllers: [LoggingTestController, HealthController],
    })
    class DynamicTestModule {}

    app = await NestFactory.create<NestFastifyApplication>(DynamicTestModule, adapter, {
      bufferLogs: true,
    });

    app.useLogger(appLogger);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    fastifyInstance = app.getHttpAdapter().getInstance();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  // Requirement 8.1 & 8.2: Successful HTTP request produces structured log with required fields
  it('logs a successful HTTP request with request ID, method, status code, and response duration', async () => {
    const res = await fastifyInstance.inject({
      method: 'GET',
      url: '/test/success',
    });

    expect(res.statusCode).toBe(200);

    const completionLogs = capturedLogs.filter((l) => l.msg === 'request completed');
    expect(completionLogs.length).toBe(1);

    const [log] = completionLogs;
    expect(log).toBeDefined();
    expect(log!.name).toBe(SERVICE_NAME);
    expect(log!.level).toBe(30); // 30 = info
    expect(log!.method).toBe('GET');
    expect(log!.url).toBe('/test/success');
    expect(log!.statusCode).toBe(200);
    expect(typeof log!.responseTime).toBe('number');
    expect(log!.responseTime).toBeGreaterThanOrEqual(0);
    expect(typeof log!.time).toBe('number');
    expect(typeof log!.reqId).toBe('string');
    expect(log!.reqId!.length).toBeGreaterThan(0);
  });

  // Requirement 8.3: Client error logs at warning level with status and diagnostic info
  it('records client errors (4xx) at warning level with status and diagnostic information', async () => {
    const res = await fastifyInstance.inject({
      method: 'GET',
      url: '/test/client-error',
    });

    expect(res.statusCode).toBe(400);

    const completionLogs = capturedLogs.filter((l) => l.msg === 'request completed');
    expect(completionLogs.length).toBe(1);

    const [log] = completionLogs;
    expect(log).toBeDefined();
    expect(log!.level).toBe(40); // 40 = warn
    expect(log!.statusCode).toBe(400);
    expect(log!.err).toBeDefined();
    expect(log!.err?.message).toContain('Validation failed');
  });

  // Requirement 8.3: Server error logs at error level with status and diagnostic info
  it('records server errors (5xx) at error level with status and diagnostic information', async () => {
    const res = await fastifyInstance.inject({
      method: 'GET',
      url: '/test/server-error',
    });

    expect(res.statusCode).toBe(500);

    const completionLogs = capturedLogs.filter((l) => l.msg === 'request completed');
    expect(completionLogs.length).toBe(1);

    const [log] = completionLogs;
    expect(log).toBeDefined();
    expect(log!.level).toBe(50); // 50 = error
    expect(log!.statusCode).toBe(500);
    expect(log!.err).toBeDefined();
    expect(log!.err?.message).toBe('Unexpected database failure');
  });

  // Requirement 8.4: Sensitive headers such as authorization and cookie are redacted or excluded
  it('redacts sensitive headers such as authorization, cookie, and api keys if logged', async () => {
    rootLogger.info(
      {
        headers: {
          authorization: 'Bearer secret-jwt-token-12345',
          cookie: 'hs_session=secret-session-id-98765',
          'x-api-key': 'live_key_abcdef123456',
        },
        user: {
          password: 'super-secret-password-raw',
          token: 'bearer-secret-token',
        },
      },
      'Explicit security check',
    );

    const secLog = capturedLogs.find((l) => l.msg === 'Explicit security check');
    expect(secLog).toBeDefined();

    const rawLogged = JSON.stringify(secLog);
    expect(rawLogged).not.toContain('secret-jwt-token-12345');
    expect(rawLogged).not.toContain('secret-session-id-98765');
    expect(rawLogged).not.toContain('live_key_abcdef123456');
    expect(rawLogged).not.toContain('super-secret-password-raw');

    const headers = (secLog as any).headers;
    expect(headers.authorization).toBe('[REDACTED]');
    expect(headers.cookie).toBe('[REDACTED]');
    expect(headers['x-api-key']).toBe('[REDACTED]');
    expect((secLog as any).user.password).toBe('[REDACTED]');
    expect((secLog as any).user.token).toBe('[REDACTED]');
  });

  // Requirement 8.5: Request bodies are not logged
  it('does not log HTTP request bodies containing sensitive information', async () => {
    const sensitivePayload = {
      password: 'ConfidentialPassword123!',
      sessionSecret: 'super-secret-hex-token',
      creditCard: '4111111111111111',
    };

    const res = await fastifyInstance.inject({
      method: 'POST',
      url: '/test/credentials',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(sensitivePayload),
    });

    expect(res.statusCode).toBe(201);

    const completionLogs = capturedLogs.filter((l) => l.msg === 'request completed');
    expect(completionLogs.length).toBe(1);

    const [log] = completionLogs;
    const serializedLog = JSON.stringify(log);

    expect(serializedLog).not.toContain('ConfidentialPassword123!');
    expect(serializedLog).not.toContain('super-secret-hex-token');
    expect(serializedLog).not.toContain('4111111111111111');
    expect((log as any).body).toBeUndefined();
    expect((log as any).payload).toBeUndefined();
  });

  // Requirement 8.6: Separate requests receive distinct request IDs
  it('assigns distinct request IDs to separate incoming requests', async () => {
    const res1 = await fastifyInstance.inject({ method: 'GET', url: '/test/success' });
    const res2 = await fastifyInstance.inject({ method: 'GET', url: '/test/success' });

    const id1 = res1.headers[REQUEST_ID_HEADER];
    const id2 = res2.headers[REQUEST_ID_HEADER];

    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    expect(id1).not.toBe(id2);

    const completionLogs = capturedLogs.filter((l) => l.msg === 'request completed');
    expect(completionLogs.length).toBe(2);
    expect(completionLogs[0]?.reqId).toBe(id1);
    expect(completionLogs[1]?.reqId).toBe(id2);
  });

  // Requirement 3: Client correlation ID validation
  it('accepts and preserves valid correlation ID headers while rejecting unsafe arbitrary input', async () => {
    // Valid correlation ID
    const validCustomId = 'client-trace-12345_ABC';
    const resValid = await fastifyInstance.inject({
      method: 'GET',
      url: '/test/success',
      headers: {
        'x-request-id': validCustomId,
      },
    });

    expect(resValid.headers[REQUEST_ID_HEADER]).toBe(validCustomId);

    // Unsafe correlation ID (special characters / script tag injection attempt)
    const unsafeId = '<script>alert(1)</script>';
    const resUnsafe = await fastifyInstance.inject({
      method: 'GET',
      url: '/test/success',
      headers: {
        'x-request-id': unsafeId,
      },
    });

    const returnedId = resUnsafe.headers[REQUEST_ID_HEADER];
    expect(returnedId).not.toBe(unsafeId);
    expect(returnedId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  // Requirement 8.7: Logging does not change status codes, bodies, headers, or application behavior
  it('preserves response status codes, bodies, headers, and application behavior', async () => {
    const res = await fastifyInstance.inject({
      method: 'GET',
      url: '/test/success',
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ status: 'success', data: 42 });
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.headers[REQUEST_ID_HEADER]).toBeDefined();
  });

  // Requirement 2 & COR-02: Health check noise reduction policy with trailing slash normalization
  it('logs health check requests at debug level to avoid log flooding, even with trailing slashes', async () => {
    const res1 = await fastifyInstance.inject({
      method: 'GET',
      url: '/health',
    });
    const res2 = await fastifyInstance.inject({
      method: 'GET',
      url: '/health/',
    });
    const res3 = await fastifyInstance.inject({
      method: 'GET',
      url: '/api/v1/health',
    });
    const res4 = await fastifyInstance.inject({
      method: 'GET',
      url: '/api/v1/health/',
    });

    expect(res1.statusCode).toBe(200);
    expect(res2.statusCode).toBe(200);
    expect(res3.statusCode).toBe(200);
    expect(res4.statusCode).toBe(200);

    const healthLogs = capturedLogs.filter(
      (l) => l.msg === 'request completed' && (l.url === '/health' || l.url === '/api/v1/health'),
    );
    expect(healthLogs.length).toBe(4);
    for (const hLog of healthLogs) {
      expect(hLog.level).toBe(20); // 20 = debug
    }
  });

  // SEC-01: Redacts credentials embedded in database URI error messages
  it('redacts database credentials and connection URIs from error messages', async () => {
    const res = await fastifyInstance.inject({
      method: 'GET',
      url: '/test/database-error',
    });

    expect(res.statusCode).toBe(500);

    const completionLogs = capturedLogs.filter((l) => l.msg === 'request completed');
    const [log] = completionLogs;

    expect(log).toBeDefined();
    expect(log!.level).toBe(50); // 50 = error
    expect(log!.err?.message).not.toContain('super_secret_db_pass_999');
    expect(log!.err?.message).not.toContain('leak_token');
    expect(log!.err?.message).toContain('postgres://[REDACTED]@localhost:5432/hellosmart');

    const serialized = JSON.stringify(log);
    expect(serialized).not.toContain('super_secret_db_pass_999');
    expect(serialized).not.toContain('leak_token');
  });

  // Requirement 5: Query strings with tokens are not logged in url
  it('normalizes URL path and strips query strings containing tokens from logs', async () => {
    const res = await fastifyInstance.inject({
      method: 'GET',
      url: '/test/success?token=super-confidential-token-abc&apiKey=live123',
    });

    expect(res.statusCode).toBe(200);

    const completionLogs = capturedLogs.filter((l) => l.msg === 'request completed');
    const [log] = completionLogs;

    expect(log).toBeDefined();
    expect(log!.url).toBe('/test/success');
    expect(JSON.stringify(log)).not.toContain('super-confidential-token-abc');
    expect(JSON.stringify(log)).not.toContain('live123');
  });

  // Requirement 2: No duplicate completion logs
  it('never emits duplicate request-completion records for the same request', async () => {
    await fastifyInstance.inject({ method: 'GET', url: '/test/success' });
    await fastifyInstance.inject({ method: 'GET', url: '/test/client-error' });
    await fastifyInstance.inject({ method: 'GET', url: '/test/server-error' });

    const completionLogs = capturedLogs.filter((l) => l.msg === 'request completed');
    expect(completionLogs.length).toBe(3);
  });
});
