import { z } from 'zod';

const MigratorEnvSchema = z
  .object({
    DATABASE_MIGRATOR_URL: z.string().url().optional(),
    DATABASE_URL: z.string().url().optional(),
  })
  .refine((v) => Boolean(v.DATABASE_MIGRATOR_URL ?? v.DATABASE_URL), {
    message: 'DATABASE_MIGRATOR_URL or DATABASE_URL must be set',
  });

/** DB migrate/seed only — does not require SESSION_SECRET or full API config. */
export function loadMigratorDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const parsed = MigratorEnvSchema.safeParse(env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ');
    throw new Error(
      `Invalid migration configuration: ${msg}. Copy .env.example to .env at the repo root and ensure Postgres is up (pnpm infra:up).`,
    );
  }
  const data = parsed.data;
  return data.DATABASE_MIGRATOR_URL ?? data.DATABASE_URL!;
}
