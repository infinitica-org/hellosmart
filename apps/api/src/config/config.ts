import { z } from 'zod';

// All config validated at boot. Secrets arrive as env vars injected by ECS from Secrets Manager;
// they are never logged (see logger redaction in modules/observability).
const ConfigSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'staging', 'production']),
    PORT: z.coerce.number().int().default(4000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    DATABASE_URL: z.string().url(),
    DATABASE_MIGRATOR_URL: z.string().url().optional(),
    DATABASE_PLATFORM_URL: z.string().url().optional(),
    /** Required in staging/production. Unit tests omit Redis and use in-memory stores. */
    REDIS_URL: z.string().url().optional(),
    SESSION_SECRET: z.string().min(32),
    CORS_ORIGINS: z.string().optional(),
    PAYMENT_GATEWAY: z.enum(['fake', 'razorpay']).default('fake'),
    EMAIL_PROVIDER: z.enum(['fake', 'ses']).default('fake'),
    WORKSPACE_RUNTIME: z.enum(['fake', 'sysbox']).default('fake'),
    STORAGE_DRIVER: z.enum(['local', 's3', 'fake']).default('local'),
    STORAGE_LOCAL_ROOT: z.string().default('.storage'),
    STORAGE_SIGNING_SECRET: z.string().min(32).optional(),
    STORAGE_S3_BUCKET: z.string().default('hs-local-artifacts'),
    STORAGE_S3_REGION: z.string().default('us-east-1'),
    STORAGE_S3_ENDPOINT: z.string().url().optional(),
    STORAGE_S3_ACCESS_KEY_ID: z.string().optional(),
    STORAGE_S3_SECRET_ACCESS_KEY: z.string().optional(),
    STORAGE_S3_FORCE_PATH_STYLE: z.coerce.boolean().optional(),
    APP_BASE_URL: z.string().url().default('http://localhost:3000'),
    /** Base32 TOTP secret for platform admin MFA (dev/test). Production uses vault via mfa_secret_ref. */
    PLATFORM_ADMIN_MFA_SECRET: z.string().min(16).optional(),
    /** 32-byte AES-256-GCM encryption key for MFA secrets at rest (hex, base64, or 32 raw bytes). Required in staging/production. */
    MFA_ENCRYPTION_KEY: z.string().optional(),
    /** Active MFA encryption key identifier. Defaults to 'k1'. */
    MFA_ENCRYPTION_KEY_ID: z.string().default('k1'),
    /** JSON or comma-separated mapping of previous MFA encryption keys for seamless key rotation. */
    MFA_PREVIOUS_ENCRYPTION_KEYS: z.string().optional(),
    /** Cal.com webhook HMAC verification secret (min 16 chars). */
    CALCOM_WEBHOOK_SECRET: z.string().min(16).optional(),
    /** Seller tax jurisdiction country (ISO 3166-1 alpha-2, e.g. 'IN'). Required for GST calculation. */
    SELLER_COUNTRY: z.string().length(2).optional(),
    /** Seller tax jurisdiction state code (e.g. 'KA' for Karnataka). Required for GST calculation. */
    SELLER_STATE: z.string().min(1).max(10).optional(),
    /** Seller tax jurisdiction city. */
    SELLER_CITY: z.string().min(1).optional(),
    /** Seller tax jurisdiction postal PIN code. */
    SELLER_PIN_CODE: z.string().min(1).optional(),
    /** Statutory GSTIN of seller entity. */
    SELLER_GSTIN: z.string().optional(),
    /** International export tax classification treatment ('reject', 'zero_rated_lut', 'standard_igst'). */
    INTERNATIONAL_TAX_TREATMENT: z
      .enum(['reject', 'zero_rated_lut', 'standard_igst'])
      .default('reject'),
    /** Letter of Undertaking (LUT) reference number for zero-rated export of services under GST. */
    EXPORT_LUT_NUMBER: z.string().optional(),
    /** Optional Mailpit URL for local email capture in development. */
    MAILPIT_URL: z.string().url().default('http://127.0.0.1:8025'),
    /** S0-T17-1: Have I Been Pwned breach check fail-open toggle (default true). */
    HIBP_FAIL_OPEN: z
      .union([z.boolean(), z.string()])
      .optional()
      .transform((v) => {
        if (v === undefined) return true;
        if (typeof v === 'boolean') return v;
        return v.toLowerCase() !== 'false' && v !== '0';
      }),
  })
  .transform((raw) => {
    const corsList = raw.CORS_ORIGINS
      ? raw.CORS_ORIGINS.split(',').map((o) => o.trim())
      : raw.NODE_ENV === 'development'
        ? ['http://localhost:3000']
        : [];
    if (corsList.length === 0 && raw.NODE_ENV !== 'test') {
      throw new Error('CORS_ORIGINS is required outside development and test');
    }
    for (const origin of corsList) {
      if (origin === '*' || origin.includes('*')) {
        throw new Error(
          `Wildcard CORS origin '${origin}' is not permitted with credentialed requests`,
        );
      }
      try {
        // eslint-disable-next-line no-new
        new URL(origin);
      } catch {
        throw new Error(`Invalid CORS origin: ${origin}`);
      }
    }
    return {
      ...raw,
      CORS_ORIGINS: corsList,
      DATABASE_MIGRATOR_URL:
        raw.DATABASE_MIGRATOR_URL ?? raw.DATABASE_URL.replace('hs_app:', 'hs_migrator:'),
      DATABASE_PLATFORM_URL:
        raw.DATABASE_PLATFORM_URL ??
        raw.DATABASE_URL.replace('hs_app:hs_app_local', 'hs_platform:hs_platform_local').replace(
          'hs_app:',
          'hs_platform:',
        ),
    };
  });

export type Config = z.infer<typeof ConfigSchema>;

export function parseCryptoKey(keyStr: string, keyId: string): Buffer {
  const trimmed = keyStr.trim();
  let buf: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    buf = Buffer.from(trimmed, 'hex');
  } else if (trimmed.length === 32) {
    buf = Buffer.from(trimmed, 'utf8');
  } else {
    buf = Buffer.from(trimmed, 'base64');
  }
  if (buf.length !== 32) {
    throw new Error(
      `Invalid MFA encryption key '${keyId}': expected 32 bytes (256 bits), got ${buf.length} bytes`,
    );
  }
  return buf;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = ConfigSchema.safeParse(env);
  if (!parsed.success) {
    // Print key names only, never values.
    const keys = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Invalid configuration: ${keys}`);
  }
  const nodeEnv = parsed.data.NODE_ENV;
  if ((nodeEnv === 'production' || nodeEnv === 'staging') && !parsed.data.REDIS_URL) {
    throw new Error('REDIS_URL is required in staging and production');
  }
  if ((nodeEnv === 'production' || nodeEnv === 'staging') && !env.DATABASE_PLATFORM_URL) {
    throw new Error('DATABASE_PLATFORM_URL is required in staging and production');
  }
  if ((nodeEnv === 'production' || nodeEnv === 'staging') && !parsed.data.MFA_ENCRYPTION_KEY) {
    throw new Error('MFA_ENCRYPTION_KEY is required in staging and production');
  }
  if (parsed.data.MFA_ENCRYPTION_KEY) {
    parseCryptoKey(parsed.data.MFA_ENCRYPTION_KEY, parsed.data.MFA_ENCRYPTION_KEY_ID);
  }
  if (parsed.data.MFA_PREVIOUS_ENCRYPTION_KEYS) {
    const raw = parsed.data.MFA_PREVIOUS_ENCRYPTION_KEYS.trim();
    if (raw.startsWith('{')) {
      try {
        const parsedKeys = JSON.parse(raw);
        for (const [kid, kstr] of Object.entries(parsedKeys)) {
          if (typeof kstr !== 'string') {
            throw new Error(`Previous MFA key '${kid}' must be a string`);
          }
          parseCryptoKey(kstr, kid);
        }
      } catch (err: any) {
        if (
          err.message?.includes('Invalid MFA encryption key') ||
          err.message?.includes('must be a string')
        ) {
          throw err;
        }
        throw new Error('Invalid MFA_PREVIOUS_ENCRYPTION_KEYS JSON format');
      }
    } else {
      const pairs = raw
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      for (const pair of pairs) {
        const [kid, kstr] = pair.split(':');
        if (!kid || !kstr) {
          throw new Error(
            'Invalid MFA_PREVIOUS_ENCRYPTION_KEYS format. Expected keyId:keyValue,...',
          );
        }
        parseCryptoKey(kstr.trim(), kid.trim());
      }
    }
  }
  if (parsed.data.DATABASE_PLATFORM_URL) {
    try {
      const platformUrl = new URL(parsed.data.DATABASE_PLATFORM_URL);
      if (platformUrl.username === 'hs_app') {
        throw new Error('DATABASE_PLATFORM_URL cannot use hs_app runtime role');
      }
    } catch (e: any) {
      if (e.message?.includes('hs_app')) throw e;
      throw new Error('Invalid DATABASE_PLATFORM_URL');
    }
  }
  if (parsed.data.DATABASE_URL) {
    try {
      const appUrl = new URL(parsed.data.DATABASE_URL);
      if (
        appUrl.username === 'hs_platform' ||
        appUrl.username === 'postgres' ||
        appUrl.username === 'hs_migrator'
      ) {
        throw new Error('DATABASE_URL must connect as restricted runtime role (hs_app)');
      }
    } catch (e: any) {
      if (e.message?.includes('restricted runtime role')) throw e;
      throw new Error('Invalid DATABASE_URL');
    }
  }
  if (nodeEnv === 'production') {
    const { PAYMENT_GATEWAY, EMAIL_PROVIDER, WORKSPACE_RUNTIME, STORAGE_DRIVER } = parsed.data;
    if (
      PAYMENT_GATEWAY === 'fake' ||
      EMAIL_PROVIDER === 'fake' ||
      WORKSPACE_RUNTIME === 'fake' ||
      STORAGE_DRIVER === 'fake' ||
      STORAGE_DRIVER === 'local'
    ) {
      throw new Error('Fake adapters are not allowed in production');
    }
  }
  return parsed.data;
}
