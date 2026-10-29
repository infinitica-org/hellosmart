import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Controller, Get, Post, Body, HttpCode, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, Reflector } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import helmet from '@fastify/helmet';
import { LoginDtoSchema, type LoginDto } from '@hs/contracts';
import {
  createHelmetOptions,
  createCorsOptions,
  DEFAULT_BODY_LIMIT_BYTES,
  CSRF_HEADER_NAME,
} from '../src/config/security.config.js';
import { APP_CONFIG } from '../src/config/config.tokens.js';
import type { Config } from '../src/config/config.js';
import { CsrfOriginGuard } from '../src/common/guards/csrf-origin.guard.js';
import { ZodValidationPipe } from '../src/common/pipes/zod-validation.pipe.js';
import { ProblemDetailsFilter } from '../src/common/filters/problem-details.filter.js';
import { Public } from '../src/common/decorators/public.decorator.js';
import { SkipCsrf } from '../src/common/decorators/skip-csrf.decorator.js';

const testConfig: Config = {
  NODE_ENV: 'test',
  PORT: 4000,
  API_BASE_URL: 'http://localhost:4000/api/v1',
  WEB_APP_URL: 'http://localhost:3000',
  DOCS_APP_URL: 'http://localhost:3001',
  CORS_ORIGINS: ['http://localhost:3000', 'https://app.hellosmart.ai'],
  DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
  DATABASE_PLATFORM_URL: 'postgres://user:pass@localhost:5432/platform_db',
  REDIS_URL: 'redis://localhost:6379',
  LOG_LEVEL: 'info',
  SESSION_SECRET: 'test-session-secret-min-32-chars-long-here',
  COOKIE_DOMAIN: 'localhost',
  COOKIE_SECURE: false,
  ADMIN_EMAIL: 'admin@hellosmart.ai',
  ADMIN_SEED_PASSWORD: 'Password123!',
  PLATFORM_ADMIN_MFA_SECRET: 'JBSWY3DPEHPK3PXP',
  ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  ENCRYPTION_KEY_ID: 'k1',
};

@Public()
@Controller('security-test')
class SecurityTestController {
  @Get('ping')
  ping() {
    return { ok: true };
  }

  @Post('action')
  @HttpCode(200)
  action(@Body() body: any) {
    return { executed: true, data: body };
  }

  @SkipCsrf()
  @Post('webhook')
  @HttpCode(200)
  webhook(@Body() body: any) {
    return { webhookReceived: true, data: body };
  }

  @Post('login-strict')
  @HttpCode(200)
  login(@Body(new ZodValidationPipe(LoginDtoSchema)) body: LoginDto) {
    return { success: true, email: body.email };
  }
}

@Module({
  controllers: [SecurityTestController],
  providers: [
    Reflector,
    ProblemDetailsFilter,
    CsrfOriginGuard,
    { provide: APP_CONFIG, useValue: testConfig },
    { provide: APP_FILTER, useExisting: ProblemDetailsFilter },
    { provide: APP_GUARD, useExisting: CsrfOriginGuard },
  ],
})
class SecurityTestModule {}

describe('Security Hardening HTTP Integration Suite (S0-T14-1)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const adapter = new FastifyAdapter({
      bodyLimit: DEFAULT_BODY_LIMIT_BYTES,
    });

    const moduleRef = await Test.createTestingModule({
      imports: [SecurityTestModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(adapter);

    await app.register(helmet, createHelmetOptions(testConfig));
    app.enableCors(createCorsOptions(testConfig));
    app.setGlobalPrefix('api/v1');

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. HTTP Security Headers Verification', () => {
    it('sets nosniff, frame-ancestors none, DENY, and strips X-Powered-By on GET', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/security-test/ping',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['content-security-policy']).toContain("frame-ancestors 'none'");
      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    it('sets nosniff and DENY on error responses', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/security-test/non-existent-route',
      });

      expect(response.statusCode).toBe(404);
      expect(response.headers['content-type']).toContain('application/problem+json');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
    });
  });

  describe('2. Strict CORS Integration', () => {
    it('handles CORS preflight OPTIONS request for trusted origin', async () => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/api/v1/security-test/action',
        headers: {
          origin: 'http://localhost:3000',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'X-HS-CSRF, Content-Type',
        },
      });

      expect(response.statusCode).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
      expect(response.headers['access-control-allow-methods']).toContain('POST');
    });

    it('does not allow untrusted origin in CORS preflight', async () => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/api/v1/security-test/action',
        headers: {
          origin: 'https://evil.com',
          'access-control-request-method': 'POST',
        },
      });

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('3. CSRF & Origin Guard HTTP Enforcement', () => {
    it('blocks state-changing POST when X-HS-CSRF is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/security-test/action',
        headers: {
          origin: 'http://localhost:3000',
          'content-type': 'application/json',
        },
        payload: { item: 'value' },
      });

      expect(response.statusCode).toBe(403);
      expect(response.headers['content-type']).toContain('application/problem+json');
      const body = response.json();
      expect(body.code).toBe('CSRF_TOKEN_MISSING');
    });

    it('blocks state-changing POST when Origin is untrusted', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/security-test/action',
        headers: {
          [CSRF_HEADER_NAME]: '1',
          origin: 'https://evil.com',
          'content-type': 'application/json',
        },
        payload: { item: 'value' },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.code).toBe('CSRF_INVALID_ORIGIN');
    });

    it('allows state-changing POST when X-HS-CSRF is present and Origin is trusted', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/security-test/action',
        headers: {
          [CSRF_HEADER_NAME]: '1',
          origin: 'http://localhost:3000',
          'content-type': 'application/json',
        },
        payload: { item: 'value' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        executed: true,
        data: { item: 'value' },
      });
    });

    it('allows @SkipCsrf() endpoint without CSRF headers or origin (e.g. webhooks)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/security-test/webhook',
        headers: {
          'content-type': 'application/json',
        },
        payload: { event: 'booking.created' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        webhookReceived: true,
        data: { event: 'booking.created' },
      });
    });
  });

  describe('4. Input Validation & Unknown Fields (ZodValidationPipe)', () => {
    it('rejects unrecognized/unknown JSON fields with 422 VALIDATION_ERROR', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/security-test/login-strict',
        headers: {
          [CSRF_HEADER_NAME]: '1',
          origin: 'http://localhost:3000',
          'content-type': 'application/json',
        },
        payload: {
          email: 'admin@hellosmart.ai',
          password: 'Password123!',
          injectedField: 'malicious',
          isAdmin: true,
        },
      });

      expect(response.statusCode).toBe(422);
      expect(response.headers['content-type']).toContain('application/problem+json');
      const body = response.json();
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.title).toBe('Unprocessable Entity');
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining("Unrecognized key(s) in object: 'injectedField', 'isAdmin'"),
          }),
        ]),
      );
    });

    it('accepts valid schema payload without extra fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/security-test/login-strict',
        headers: {
          [CSRF_HEADER_NAME]: '1',
          origin: 'http://localhost:3000',
          'content-type': 'application/json',
        },
        payload: {
          email: 'admin@hellosmart.ai',
          password: 'Password123!',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        success: true,
        email: 'admin@hellosmart.ai',
      });
    });
  });

  describe('5. Fastify Framework Error Handling & Payload Limits', () => {
    it('returns RFC 7807 413 PAYLOAD_TOO_LARGE when request exceeds bodyLimit', async () => {
      // Create a payload larger than 1MB
      const hugeString = 'A'.repeat(DEFAULT_BODY_LIMIT_BYTES + 1024);
      const hugePayload = JSON.stringify({ data: hugeString });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/security-test/action',
        headers: {
          [CSRF_HEADER_NAME]: '1',
          origin: 'http://localhost:3000',
          'content-type': 'application/json',
        },
        payload: hugePayload,
      });

      expect(response.statusCode).toBe(413);
      expect(response.headers['content-type']).toContain('application/problem+json');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      const body = response.json();
      expect(body.code).toBe('PAYLOAD_TOO_LARGE');
      expect(body.title).toBe('Payload Too Large');
    });

    it('returns RFC 7807 400 BAD_REQUEST when request body contains malformed JSON', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/security-test/action',
        headers: {
          [CSRF_HEADER_NAME]: '1',
          origin: 'http://localhost:3000',
          'content-type': 'application/json',
        },
        payload: '{"email": "broken-json, missing closing brace',
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers['content-type']).toContain('application/problem+json');
      const body = response.json();
      expect(body.code).toBe('BAD_REQUEST');
      expect(body.title).toBe('Bad Request');
    });
  });
});

