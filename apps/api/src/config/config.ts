import { z } from 'zod';

// All config validated at boot. Secrets arrive as env vars injected by ECS from Secrets Manager;
// they are never logged (see logger redaction in modules/observability).
const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']),
  PORT: z.coerce.number().int().default(4000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  CORS_ORIGINS: z
    .string()
    .transform((s) => s.split(',').map((o) => o.trim()))
    .pipe(z.array(z.string().url())),
  PAYMENT_GATEWAY: z.enum(['fake', 'razorpay']).default('fake'),
  EMAIL_PROVIDER: z.enum(['fake', 'ses']).default('fake'),
  WORKSPACE_RUNTIME: z.enum(['fake', 'sysbox']).default('fake'),
  SECRET_STORE_PROVIDER: z.enum(['fake', 'aws']).default('aws'),
  AWS_REGION: z.string().default('ap-south-1'),
  AWS_SECRETS_MANAGER_ENDPOINT: z.string().url().optional(),
  APP_BASE_URL: z.string().url().default('http://localhost:3000'),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = ConfigSchema.safeParse(env);
  if (!parsed.success) {
    // Print key names only, never values.
    const keys = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Invalid configuration: ${keys}`);
  }
  if (parsed.data.NODE_ENV === 'production' && Object.values(parsed.data).includes('fake')) {
    throw new Error('Fake adapters are not allowed in production');
  }
  return parsed.data;
}
