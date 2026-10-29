import type { FastifyHelmetOptions } from '@fastify/helmet';
import type { Config } from './config.js';

export interface CorsOptions {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ) => void;
  credentials: true;
  methods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  maxAge: number;
}

export const CSRF_HEADER_NAME = 'x-hs-csrf';
export const CSRF_EXPECTED_VALUE = '1';

export const STATE_CHANGING_METHODS: readonly string[] = [
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
];

export const SAFE_METHODS: readonly string[] = ['GET', 'HEAD', 'OPTIONS'];

export const CORS_ALLOWED_METHODS: readonly string[] = [
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
];

export const CORS_ALLOWED_HEADERS: readonly string[] = [
  'Content-Type',
  'Authorization',
  'X-HS-CSRF',
  'x-hs-csrf',
  'X-Request-Id',
  'x-request-id',
  'Idempotency-Key',
  'idempotency-key',
  'Accept',
];

export const DEFAULT_BODY_LIMIT_BYTES = 1_048_576; // 1 MB

export function createHelmetOptions(config: Config): FastifyHelmetOptions {
  const isProd = config.NODE_ENV === 'production' || config.NODE_ENV === 'staging';

  return {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: isProd
      ? {
          maxAge: 63_072_000, // 2 years
          includeSubDomains: true,
          preload: true,
        }
      : false,
    frameguard: {
      action: 'deny',
    },
    noSniff: true,
    referrerPolicy: {
      policy: 'no-referrer',
    },
    crossOriginResourcePolicy: {
      policy: 'cross-origin',
    },
    hidePoweredBy: true,
  };
}

export function createCorsOptions(config: Config): CorsOptions {
  return {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      // Note: Browser state-changing requests without origin are blocked by CsrfOriginGuard.
      if (!origin) {
        callback(null, true);
        return;
      }

      // Check against configured trusted origins list
      if (config.CORS_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }

      // Reject untrusted origin by disallowing CORS headers
      callback(null, false);
    },
    credentials: true,
    methods: [...CORS_ALLOWED_METHODS],
    allowedHeaders: [...CORS_ALLOWED_HEADERS],
    exposedHeaders: ['X-Request-Id', 'x-request-id', 'Content-Type'],
    maxAge: 86400,
  };
}
