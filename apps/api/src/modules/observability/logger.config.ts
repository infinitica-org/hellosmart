import pino, { type DestinationStream, type Logger, type LoggerOptions } from 'pino';

export const SERVICE_NAME = 'hellosmart-api';

export const DEFAULT_REDACT_PATHS: readonly string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'req.headers["session-secret"]',
  'headers.authorization',
  'headers.cookie',
  'headers["x-api-key"]',
  'headers["session-secret"]',
  'authorization',
  'cookie',
  'password',
  '*.password',
  'secret',
  '*.secret',
  'token',
  '*.token',
  'apiKey',
  '*.apiKey',
  'access_token',
  'refresh_token',
  'SESSION_SECRET',
  'DATABASE_URL',
  'REDIS_URL',
];

export type CreateLoggerOptions = LoggerOptions;

export function createLogger(
  options: CreateLoggerOptions = {},
  destination?: DestinationStream,
): Logger {
  const { redact, serializers, level, ...rest } = options;

  let redactPaths = [...DEFAULT_REDACT_PATHS];
  if (Array.isArray(redact)) {
    redactPaths = [...redactPaths, ...redact];
  } else if (redact && typeof redact === 'object' && Array.isArray(redact.paths)) {
    redactPaths = [...redactPaths, ...redact.paths];
  }

  const redactOptions = {
    paths: redactPaths,
    censor: '[REDACTED]',
  };

  const defaultSerializers = {
    err: pino.stdSerializers.err,
    ...serializers,
  };

  const pinoOptions: LoggerOptions = {
    name: SERVICE_NAME,
    redact: redactOptions,
    serializers: defaultSerializers,
    timestamp: pino.stdTimeFunctions.epochTime,
    ...rest,
  };

  if (level !== undefined) {
    pinoOptions.level = level;
  }

  return destination ? pino(pinoOptions, destination) : pino(pinoOptions);
}
