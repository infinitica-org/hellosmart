import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { z } from 'zod';
import {
  createHelmetOptions,
  createCorsOptions,
  CSRF_HEADER_NAME,
  CSRF_EXPECTED_VALUE,
  DEFAULT_BODY_LIMIT_BYTES,
  CORS_ALLOWED_METHODS,
  CORS_ALLOWED_HEADERS,
} from '../src/config/security.config.js';
import type { Config } from '../src/config/config.js';
import { CsrfOriginGuard } from '../src/common/guards/csrf-origin.guard.js';
import { SKIP_CSRF_KEY } from '../src/common/decorators/skip-csrf.decorator.js';
import { ZodValidationPipe, enforceStrict } from '../src/common/pipes/zod-validation.pipe.js';
import { ProblemDetailsFilter } from '../src/common/filters/problem-details.filter.js';
import { LoginDtoSchema } from '@hs/contracts';

describe('Stream 14 — S0-T14-1 Security Hardening Suite', () => {
  const mockConfig: Config = {
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

  describe('A. Security HTTP Headers (Helmet Configuration)', () => {
    it('disables HSTS in non-production / development environments', () => {
      const devConfig: Config = { ...mockConfig, NODE_ENV: 'development' };
      const options = createHelmetOptions(devConfig);

      expect(options.hsts).toBe(false);
      expect(options.noSniff).toBe(true);
      expect(options.hidePoweredBy).toBe(true);
      expect(options.frameguard).toEqual({ action: 'deny' });
      expect((options.contentSecurityPolicy as any).directives.frameAncestors).toEqual(["'none'"]);
      expect((options.contentSecurityPolicy as any).directives.defaultSrc).toEqual(["'none'"]);
    });

    it('enforces strict HSTS with 2-year max-age, subdomains, and preload in production', () => {
      const prodConfig: Config = { ...mockConfig, NODE_ENV: 'production' };
      const options = createHelmetOptions(prodConfig);

      expect(options.hsts).toEqual({
        maxAge: 63_072_000,
        includeSubDomains: true,
        preload: true,
      });
      expect(options.noSniff).toBe(true);
      expect(options.hidePoweredBy).toBe(true);
      expect(options.frameguard).toEqual({ action: 'deny' });
      expect((options.contentSecurityPolicy as any).directives.frameAncestors).toEqual(["'none'"]);
    });

    it('enforces default body size limit constant of 1 MB', () => {
      expect(DEFAULT_BODY_LIMIT_BYTES).toBe(1_048_576);
    });
  });

  describe('B. Strict CORS Policy', () => {
    it('allows requests from explicitly configured trusted origins', () => {
      const corsOptions = createCorsOptions(mockConfig);
      const callback = vi.fn();

      corsOptions.origin('http://localhost:3000', callback);
      expect(callback).toHaveBeenCalledWith(null, true);

      corsOptions.origin('https://app.hellosmart.ai', callback);
      expect(callback).toHaveBeenCalledWith(null, true);
    });

    it('rejects untrusted origins without allowing CORS headers', () => {
      const corsOptions = createCorsOptions(mockConfig);
      const callback = vi.fn();

      corsOptions.origin('https://evil.attacker.com', callback);
      expect(callback).toHaveBeenCalledWith(null, false);
    });

    it('allows requests with absent origin for non-browser / server-to-server calls', () => {
      const corsOptions = createCorsOptions(mockConfig);
      const callback = vi.fn();

      corsOptions.origin(undefined, callback);
      expect(callback).toHaveBeenCalledWith(null, true);
    });

    it('enforces credentials: true with explicit allowed methods and headers', () => {
      const corsOptions = createCorsOptions(mockConfig);

      expect(corsOptions.credentials).toBe(true);
      expect(corsOptions.methods).toEqual(expect.arrayContaining(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']));
      expect(corsOptions.allowedHeaders).toEqual(
        expect.arrayContaining(['Content-Type', 'Authorization', 'X-HS-CSRF', 'X-Request-Id']),
      );
      expect(corsOptions.maxAge).toBe(86400);
    });
  });

  describe('C. CSRF and Origin Guard (CsrfOriginGuard)', () => {
    let reflector: Reflector;
    let guard: CsrfOriginGuard;

    beforeEach(() => {
      reflector = new Reflector();
      guard = new CsrfOriginGuard(reflector, mockConfig);
    });

    function createMockContext(req: {
      method?: string;
      headers?: Record<string, string>;
      isExempt?: boolean;
    }): ExecutionContext {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(req.isExempt ?? false);

      const request: any = {
        method: req.method ?? 'GET',
        headers: req.headers ?? {},
      };

      return {
        switchToHttp: () => ({
          getRequest: () => request,
          getResponse: () => ({}),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;
    }

    it('bypasses safe HTTP methods (GET, HEAD, OPTIONS)', () => {
      for (const method of ['GET', 'HEAD', 'OPTIONS']) {
        const ctx = createMockContext({ method });
        expect(guard.canActivate(ctx)).toBe(true);
      }
    });

    it('bypasses state-changing requests when route is marked @SkipCsrf()', () => {
      const ctx = createMockContext({
        method: 'POST',
        headers: {},
        isExempt: true,
      });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('rejects state-changing requests when X-HS-CSRF header is missing', () => {
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
        const ctx = createMockContext({
          method,
          headers: {
            origin: 'http://localhost:3000',
          },
        });

        try {
          guard.canActivate(ctx);
          expect.fail(`Expected CsrfOriginGuard to throw 403 for missing CSRF header on ${method}`);
        } catch (err: any) {
          expect(err.getStatus()).toBe(403);
          expect(err.getResponse()).toMatchObject({
            code: 'CSRF_TOKEN_MISSING',
            detail: expect.stringContaining('missing required X-HS-CSRF header'),
          });
        }
      }
    });

    it('accepts state-changing request with valid X-HS-CSRF and trusted Origin', () => {
      const ctx = createMockContext({
        method: 'POST',
        headers: {
          [CSRF_HEADER_NAME]: CSRF_EXPECTED_VALUE,
          origin: 'http://localhost:3000',
        },
      });

      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('rejects state-changing request with untrusted Origin header', () => {
      const ctx = createMockContext({
        method: 'POST',
        headers: {
          [CSRF_HEADER_NAME]: '1',
          origin: 'https://evil.com',
        },
      });

      try {
        guard.canActivate(ctx);
        expect.fail('Expected CsrfOriginGuard to throw 403 for untrusted origin');
      } catch (err: any) {
        expect(err.getStatus()).toBe(403);
        expect(err.getResponse()).toMatchObject({
          code: 'CSRF_INVALID_ORIGIN',
          detail: expect.stringContaining("untrusted origin 'https://evil.com'"),
        });
      }
    });

    it('rejects substring / domain-suffix attacks on Origin', () => {
      const spoofOrigins = [
        'http://localhost:3000.attacker.com',
        'http://attacker.com/localhost:3000',
        'https://app.hellosmart.ai.evil.com',
        'http://notlocalhost:3000',
      ];

      for (const origin of spoofOrigins) {
        const ctx = createMockContext({
          method: 'POST',
          headers: {
            [CSRF_HEADER_NAME]: '1',
            origin,
          },
        });

        try {
          guard.canActivate(ctx);
          expect.fail(`Expected spoofed origin ${origin} to be rejected`);
        } catch (err: any) {
          expect(err.getStatus()).toBe(403);
          expect(err.getResponse().code).toBe('CSRF_INVALID_ORIGIN');
        }
      }
    });

    it('falls back to Referer when Origin is absent, validating exact origin', () => {
      // Valid referer matching trusted origin
      const validCtx = createMockContext({
        method: 'POST',
        headers: {
          [CSRF_HEADER_NAME]: '1',
          referer: 'http://localhost:3000/auth/login?from=/portal',
        },
      });
      expect(guard.canActivate(validCtx)).toBe(true);

      // Untrusted referer
      const untrustedCtx = createMockContext({
        method: 'POST',
        headers: {
          [CSRF_HEADER_NAME]: '1',
          referer: 'https://evil.com/phishing',
        },
      });
      try {
        guard.canActivate(untrustedCtx);
        expect.fail('Expected untrusted referer to be rejected');
      } catch (err: any) {
        expect(err.getStatus()).toBe(403);
        expect(err.getResponse()).toMatchObject({
          code: 'CSRF_INVALID_REFERER',
          detail: expect.stringContaining("untrusted referer origin 'https://evil.com'"),
        });
      }
    });

    it('reconciles with CORS: permits non-browser callers when Origin and Referer are absent but X-HS-CSRF is present', () => {
      const ctx = createMockContext({
        method: 'POST',
        headers: {
          [CSRF_HEADER_NAME]: '1',
        },
      });

      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('rejects cross-site browser requests flagged by Sec-Fetch-Site even if Origin/Referer stripped', () => {
      const ctx = createMockContext({
        method: 'POST',
        headers: {
          [CSRF_HEADER_NAME]: '1',
          'sec-fetch-site': 'cross-site',
        },
      });

      try {
        guard.canActivate(ctx);
        expect.fail('Expected cross-site request to be rejected');
      } catch (err: any) {
        expect(err.getStatus()).toBe(403);
        expect(err.getResponse()).toMatchObject({
          code: 'CSRF_CROSS_SITE_BLOCKED',
          detail: expect.stringContaining('cross-site request rejected'),
        });
      }
    });
  });

  describe('D. Input Validation and Unknown Field Rejection (ZodValidationPipe)', () => {
    it('accepts valid payload without unrecognized fields', () => {
      const pipe = new ZodValidationPipe(LoginDtoSchema);
      const validData = {
        email: 'user@example.com',
        password: 'ValidPassword123!',
      };

      const result = pipe.transform(validData);
      expect(result).toEqual(validData);
    });

    it('rejects unknown JSON fields with HTTP 422 VALIDATION_ERROR', () => {
      const pipe = new ZodValidationPipe(LoginDtoSchema);
      const payloadWithUnknown = {
        email: 'user@example.com',
        password: 'ValidPassword123!',
        extraMaliciousField: 'exploit',
        anotherField: 12345,
      };

      try {
        pipe.transform(payloadWithUnknown);
        expect.fail('Expected ZodValidationPipe to throw 422 for unknown fields');
      } catch (err: any) {
        expect(err.getStatus()).toBe(422);
        const res = err.getResponse();
        expect(res.code).toBe('VALIDATION_ERROR');
        expect(res.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              message: expect.stringContaining("Unrecognized key(s) in object: 'extraMaliciousField', 'anotherField'"),
            }),
          ]),
        );
      }
    });

    it('rejects payloads missing required fields with HTTP 422', () => {
      const pipe = new ZodValidationPipe(LoginDtoSchema);
      const invalidData = {
        email: 'not-an-email',
      };

      try {
        pipe.transform(invalidData);
        expect.fail('Expected ZodValidationPipe to throw 422 for invalid payload');
      } catch (err: any) {
        expect(err.getStatus()).toBe(422);
        const res = err.getResponse();
        expect(res.code).toBe('VALIDATION_ERROR');
      }
    });

    it('recursively rejects unknown fields in nested objects without mutating shared schemas', () => {
      const nestedSchema = z.object({
        user: z.object({
          name: z.string(),
          profile: z.object({
            role: z.string(),
          }),
        }),
      });

      const pipe = new ZodValidationPipe(nestedSchema);

      // Verify original shared schema remains non-strict (unmutated)
      const testPayloadWithExtra = {
        user: {
          name: 'Alice',
          extraUserField: 'hack',
          profile: {
            role: 'admin',
            extraProfileField: 'hack2',
          },
        },
      };
      expect(nestedSchema.safeParse(testPayloadWithExtra).success).toBe(true);

      // Verify ZodValidationPipe rejects nested unknown fields
      try {
        pipe.transform(testPayloadWithExtra);
        expect.fail('Expected ZodValidationPipe to reject nested unknown fields');
      } catch (err: any) {
        expect(err.getStatus()).toBe(422);
        const res = err.getResponse();
        expect(res.code).toBe('VALIDATION_ERROR');
        expect(res.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              field: 'user',
              message: expect.stringContaining("Unrecognized key(s) in object: 'extraUserField'"),
            }),
            expect.objectContaining({
              field: 'user.profile',
              message: expect.stringContaining("Unrecognized key(s) in object: 'extraProfileField'"),
            }),
          ]),
        );
      }
    });

    it('recursively rejects unknown fields in arrays of objects', () => {
      const arraySchema = z.object({
        tags: z.array(z.object({ id: z.string(), label: z.string() })),
      });

      const pipe = new ZodValidationPipe(arraySchema);

      try {
        pipe.transform({
          tags: [
            { id: 't1', label: 'Tech' },
            { id: 't2', label: 'Security', maliciousKey: 'boom' },
          ],
        });
        expect.fail('Expected ZodValidationPipe to reject unknown fields in array elements');
      } catch (err: any) {
        expect(err.getStatus()).toBe(422);
        expect(err.getResponse().code).toBe('VALIDATION_ERROR');
      }
    });
  });

  describe('E. Problem Details and Fastify Error Mapping (ProblemDetailsFilter)', () => {
    let filter: ProblemDetailsFilter;
    let mockReply: any;
    let mockRequest: any;
    let mockHost: any;

    beforeEach(() => {
      filter = new ProblemDetailsFilter();
      mockReply = {
        statusCode: 200,
        headers: {} as Record<string, string>,
        sentBody: null as any,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        header(name: string, value: string) {
          this.headers[name.toLowerCase()] = value;
          return this;
        },
        send(body: any) {
          this.sentBody = body;
          return this;
        },
      };
      mockRequest = {
        id: 'req-test-uuid-1234',
        url: '/api/v1/auth/login',
      };
      mockHost = {
        switchToHttp: () => ({
          getResponse: () => mockReply,
          getRequest: () => mockRequest,
        }),
      };
    });

    it('maps Fastify 413 body too large error to RFC 7807 PAYLOAD_TOO_LARGE', () => {
      const fastifyError = {
        statusCode: 413,
        code: 'FST_ERR_CTP_BODY_TOO_LARGE',
        message: 'Request body is too large',
      };

      filter.catch(fastifyError, mockHost);

      expect(mockReply.statusCode).toBe(413);
      expect(mockReply.headers['content-type']).toBe('application/problem+json');
      expect(mockReply.headers['x-content-type-options']).toBe('nosniff');
      expect(mockReply.headers['x-frame-options']).toBe('DENY');
      expect(mockReply.sentBody).toMatchObject({
        status: 413,
        code: 'PAYLOAD_TOO_LARGE',
        title: 'Payload Too Large',
        requestId: 'req-test-uuid-1234',
      });
    });

    it('maps Fastify 400 malformed JSON error to RFC 7807 BAD_REQUEST', () => {
      const fastifyError = {
        statusCode: 400,
        code: 'FST_ERR_CTP_INVALID_MEDIA_TYPE',
        message: 'Unexpected token in JSON at position 12',
      };

      filter.catch(fastifyError, mockHost);

      expect(mockReply.statusCode).toBe(400);
      expect(mockReply.headers['content-type']).toBe('application/problem+json');
      expect(mockReply.headers['x-content-type-options']).toBe('nosniff');
      expect(mockReply.headers['x-frame-options']).toBe('DENY');
      expect(mockReply.sentBody).toMatchObject({
        status: 400,
        code: 'BAD_REQUEST',
        title: 'Bad Request',
      });
    });

    it('maps Fastify 415 unsupported media type to RFC 7807 UNSUPPORTED_MEDIA_TYPE', () => {
      const fastifyError = {
        statusCode: 415,
        code: 'FST_ERR_CTP_UNSUPPORTED_MEDIA_TYPE',
        message: 'Unsupported Media Type: text/xml',
      };

      filter.catch(fastifyError, mockHost);

      expect(mockReply.statusCode).toBe(415);
      expect(mockReply.sentBody).toMatchObject({
        status: 415,
        code: 'UNSUPPORTED_MEDIA_TYPE',
      });
    });

    it('sanitizes SQL query and stack trace details in production environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        const sqlLeakError = {
          statusCode: 500,
          message: 'syntax error at or near "SELECT" at pg_query (d:/db/pg.js:45)',
        };

        filter.catch(sqlLeakError, mockHost);

        expect(mockReply.statusCode).toBe(500);
        expect(mockReply.sentBody.detail).toBe('An error occurred while processing the request');
        expect(mockReply.sentBody.detail).not.toContain('SELECT');
        expect(mockReply.sentBody.detail).not.toContain('syntax error');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });
});
