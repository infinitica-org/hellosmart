import { pino, type DestinationStream, type Logger, type LoggerOptions } from 'pino';
import { currentTraceFields } from './telemetry.js';

export const SERVICE_NAME = 'hellosmart-api';

export const DEFAULT_REDACT_PATHS: readonly string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'req.headers["session-secret"]',
  'req.headers["x-hs-csrf"]',
  'headers.authorization',
  'headers.cookie',
  'headers["x-api-key"]',
  'headers["session-secret"]',
  'headers["x-hs-csrf"]',
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
  'api_key',
  '*.api_key',
  'accessToken',
  '*.accessToken',
  'access_token',
  '*.access_token',
  'refreshToken',
  '*.refreshToken',
  'refresh_token',
  '*.refresh_token',
  'sessionSecret',
  '*.sessionSecret',
  'session_secret',
  '*.session_secret',
  'clientSecret',
  '*.clientSecret',
  'client_secret',
  '*.client_secret',
  'mfaSecret',
  '*.mfaSecret',
  'mfa_secret',
  '*.mfa_secret',
  'mfaCode',
  '*.mfaCode',
  'mfa_code',
  '*.mfa_code',
  'totpCode',
  '*.totpCode',
  'totp_code',
  '*.totp_code',
  'code',
  '*.code',
  'recoveryCode',
  '*.recoveryCode',
  'recovery_code',
  '*.recovery_code',
  'mfaRecoveryCodes',
  '*.mfaRecoveryCodes',
  'invitationToken',
  '*.invitationToken',
  'invitation_token',
  '*.invitation_token',
  'rawToken',
  '*.rawToken',
  'raw_token',
  '*.raw_token',
  'tokenHash',
  '*.tokenHash',
  'token_hash',
  '*.token_hash',
  'passwordHash',
  '*.passwordHash',
  'password_hash',
  '*.password_hash',
  'key',
  '*.key',
  'SESSION_SECRET',
  '*.SESSION_SECRET',
  'DATABASE_URL',
  '*.DATABASE_URL',
  'REDIS_URL',
  '*.REDIS_URL',
  'PLATFORM_ADMIN_MFA_SECRET',
  '*.PLATFORM_ADMIN_MFA_SECRET',
  'mfa_secret_ref',
  '*.mfa_secret_ref',
  'mfaSecretRef',
  '*.mfaSecretRef',
  'MFA_ENCRYPTION_KEY',
  '*.MFA_ENCRYPTION_KEY',
  'MFA_PREVIOUS_ENCRYPTION_KEYS',
  '*.MFA_PREVIOUS_ENCRYPTION_KEYS',
  'encryptionKey',
  '*.encryptionKey',
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
    mixin: () => currentTraceFields(),
  };

  if (level !== undefined) {
    pinoOptions.level = level;
  }

  return destination ? pino(pinoOptions, destination) : pino(pinoOptions);
}
