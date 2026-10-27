import { z } from 'zod';

// All config validated at boot. Secrets arrive as env vars injected by ECS from Secrets Manager;
// they are never logged (see logger redaction in modules/observability).
const ConfigSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'staging', 'production']),
    PORT: z.coerce.number().int().default(4000),
    DATABASE_URL: z.string().url(),
    DATABASE_MIGRATOR_URL: z.string().url().optional(),
    /** Required in staging/production. Unit tests omit Redis and use in-memory stores. */
    REDIS_URL: z.string().url().optional(),
    SESSION_SECRET: z.string().min(32),
    CORS_ORIGINS: z.string().optional(),
    PAYMENT_GATEWAY: z.enum(['fake', 'razorpay']).default('fake'),
    EMAIL_PROVIDER: z.enum(['fake', 'ses']).default('fake'),
    WORKSPACE_RUNTIME: z.enum(['fake', 'sysbox']).default('fake'),
    /** Base32 TOTP secret for platform admin MFA (dev/test). Production uses vault via mfa_secret_ref. */
    PLATFORM_ADMIN_MFA_SECRET: z.string().min(16).optional(),
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
    };
  });

export type Config = z.infer<typeof ConfigSchema>;

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
  if (nodeEnv === 'production') {
    const { PAYMENT_GATEWAY, EMAIL_PROVIDER, WORKSPACE_RUNTIME } = parsed.data;
    if (
      PAYMENT_GATEWAY === 'fake' ||
      EMAIL_PROVIDER === 'fake' ||
      WORKSPACE_RUNTIME === 'fake'
    ) {
      throw new Error('Fake adapters are not allowed in production');
    }
  }
  return parsed.data;
}
