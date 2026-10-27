import type { LoggerOptions } from 'pino';

/** Mandatory redaction paths (BR-13, BR-16). */
export const PINO_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  '*.password',
  '*key*',
  '*secret*',
  '*token*',
] as const;

export function createPinoOptions(): LoggerOptions {
  return {
    level: process.env.LOG_LEVEL ?? 'info',
    redact: {
      paths: [...PINO_REDACT_PATHS],
      censor: '[REDACTED]',
    },
  };
}
