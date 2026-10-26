export const REQUEST_ID_HEADER = 'x-request-id';
export const CORRELATION_ID_HEADER = 'x-correlation-id';
export const SAFE_REQUEST_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

export interface RawRequestLike {
  headers: Record<string, string | string[] | undefined>;
}

export function resolveRequestId(rawReq: RawRequestLike): string {
  const headerVal = rawReq.headers[REQUEST_ID_HEADER] ?? rawReq.headers[CORRELATION_ID_HEADER];
  if (typeof headerVal === 'string') {
    const trimmed = headerVal.trim();
    if (SAFE_REQUEST_ID_REGEX.test(trimmed)) {
      return trimmed;
    }
  }
  return crypto.randomUUID();
}

/**
 * Sanitizes an error message before structured logging:
 * 1. Redacts user credentials embedded in URI connection strings:
 *    `postgres://user:password@host:5432/db` -> `postgres://[REDACTED]@host:5432/db`
 *    `redis://:mypassword@localhost:6379` -> `redis://[REDACTED]@localhost:6379`
 * 2. Strips query parameters (?token=... or ?apiKey=...)
 */
export function sanitizeErrorMessage(message: unknown): string {
  if (typeof message !== 'string') {
    return 'Request failed';
  }

  let sanitized = message;

  // 1. Redact credentials embedded in URI connection strings (scheme://user:pass@host)
  // Handles encoded characters (e.g. %40, %3A), password-only (redis://:pass@host), and username:password
  sanitized = sanitized.replace(
    /\b([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)(?:[^@\s/]+)@/g,
    '$1[REDACTED]@',
  );

  // 2. Strip query parameters if included in framework error messages (e.g. NestJS "Cannot GET /path?token=...")
  if (sanitized.includes('?')) {
    sanitized = sanitized.replace(/\?[^\s"']*/g, '');
  }

  return sanitized;
}

/**
 * Normalizes route path by removing trailing slashes for consistent routing and health check dampening:
 * - "/health/" -> "/health"
 * - "/api/v1/health/" -> "/api/v1/health"
 * - "/" -> "/"
 */
export function normalizePath(path: string): string {
  if (!path || path === '/') {
    return '/';
  }
  return path.replace(/\/+$/, '') || '/';
}

export interface LoggingHooksOptions {
  healthCheckPaths?: readonly string[];
  healthCheckLevel?: 'info' | 'debug' | 'trace' | 'silent';
}

const DEFAULT_HEALTH_CHECK_PATHS: readonly string[] = [
  '/health',
  '/healthz',
  '/api/v1/health',
  '/api/v1/healthz',
];

export interface FastifyLikeRequest {
  id: string;
  method: string;
  url: string;
  raw?: { url?: string };
  log?: {
    info?: (obj: unknown, msg?: string) => void;
    warn?: (obj: unknown, msg?: string) => void;
    error?: (obj: unknown, msg?: string) => void;
    debug?: (obj: unknown, msg?: string) => void;
    trace?: (obj: unknown, msg?: string) => void;
  };
  startTime?: bigint;
  rawError?: Error & { code?: string };
  errorInfo?: { message: string; code?: string; name?: string; statusCode?: number };
}

export interface FastifyLikeReply {
  statusCode: number;
  elapsedTime?: number;
  header(name: string, value: unknown): this;
}

export interface FastifyLikeInstance {
  addHook(name: 'onRequest', hook: (req: FastifyLikeRequest, reply: FastifyLikeReply, done: () => void) => void): void;
  addHook(name: 'onSend', hook: (req: FastifyLikeRequest, reply: FastifyLikeReply, payload: unknown, done: () => void) => void): void;
  addHook(name: 'onError', hook: (req: FastifyLikeRequest, reply: FastifyLikeReply, error: Error, done: () => void) => void): void;
  addHook(name: 'onResponse', hook: (req: FastifyLikeRequest, reply: FastifyLikeReply, done: () => void) => void): void;
}

export function registerLoggingHooks(
  fastify: FastifyLikeInstance,
  options: LoggingHooksOptions = {},
): void {
  const healthCheckPaths = new Set(options.healthCheckPaths ?? DEFAULT_HEALTH_CHECK_PATHS);
  const healthCheckLevel = options.healthCheckLevel ?? 'debug';

  fastify.addHook('onRequest', (req: FastifyLikeRequest, _reply: FastifyLikeReply, done: () => void) => {
    req.startTime = process.hrtime.bigint();
    done();
  });

  fastify.addHook(
    'onSend',
    (req: FastifyLikeRequest, reply: FastifyLikeReply, payload: unknown, done: () => void) => {
      // Ensure the client receives the correlated request ID in the response header
      reply.header(REQUEST_ID_HEADER, req.id);

      // If an error response is being sent but rawError was not captured by onError,
      // extract safe diagnostic info from payload without leaking stack traces or internal secrets
      if (reply.statusCode >= 400 && !req.rawError && payload) {
        try {
          const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
          if (parsed && typeof parsed === 'object') {
            const message = (parsed as Record<string, unknown>).message
              ?? (parsed as Record<string, unknown>).detail
              ?? (parsed as Record<string, unknown>).error
              ?? 'Request failed';
            const code = (parsed as Record<string, unknown>).code;
            req.errorInfo = {
              message: Array.isArray(message) ? message.join('; ') : String(message),
              ...(typeof code === 'string' ? { code } : {}),
              statusCode: reply.statusCode,
            };
          }
        } catch {
          // Payload was not JSON; ignore parsing failure
        }
      }

      done();
    },
  );

  fastify.addHook(
    'onError',
    (req: FastifyLikeRequest, _reply: FastifyLikeReply, error: Error, done: () => void) => {
      req.rawError = error;
      done();
    },
  );

  fastify.addHook('onResponse', (req: FastifyLikeRequest, reply: FastifyLikeReply, done: () => void) => {
    const rawUrl = req.raw?.url ?? req.url ?? '/';
    const [pathWithoutQuery] = rawUrl.split('?');
    const safePath = normalizePath(pathWithoutQuery || '/');

    const statusCode = reply.statusCode;

    let level: 'info' | 'warn' | 'error' | 'debug' | 'trace' | 'silent';
    if (statusCode >= 500) {
      level = 'error';
    } else if (statusCode >= 400) {
      level = 'warn';
    } else if (healthCheckPaths.has(safePath)) {
      level = healthCheckLevel;
    } else {
      level = 'info';
    }

    if (level === 'silent') {
      done();
      return;
    }

    let responseTime: number;
    if (typeof reply.elapsedTime === 'number' && reply.elapsedTime >= 0) {
      responseTime = reply.elapsedTime;
    } else if (req.startTime) {
      const elapsedNs = Number(process.hrtime.bigint() - req.startTime);
      responseTime = Number((elapsedNs / 1_000_000).toFixed(3));
    } else {
      responseTime = 0;
    }

    const logData: Record<string, unknown> = {
      method: req.method,
      url: safePath,
      statusCode,
      responseTime,
    };

    const err = req.rawError ?? req.errorInfo;
    if (err) {
      const rawMessage = typeof err.message === 'string' ? err.message : 'Request failed';
      const cleanMessage = sanitizeErrorMessage(rawMessage);

      const errPayload: Record<string, unknown> = {
        message: cleanMessage,
      };
      if (err.name && err.name !== 'Error') {
        errPayload['name'] = err.name;
      }
      if (err.code) {
        errPayload['code'] = err.code;
      }
      logData['err'] = errPayload;
    }

    // Call the request's child logger which already contains reqId and logger name
    const reqLogger = req.log;
    if (reqLogger && typeof (reqLogger as any)[level] === 'function') {
      (reqLogger as any)[level](logData, 'request completed');
    }

    done();
  });
}
