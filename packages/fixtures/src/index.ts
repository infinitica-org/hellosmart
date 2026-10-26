#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { assertEnvironmentSafe } from './lib/guard.js';
import { maskSensitiveData } from './lib/masker.js';
import { runSafeSeed, type SeedSummary } from './lib/upsert.js';

// Re-export all entities, helpers, guard, and seed engine for library consumers
export * from './entities/index.js';
export * from './lib/keys.js';
export * from './lib/guard.js';
export * from './lib/masker.js';
export * from './lib/upsert.js';

/**
 * Options for programmatic invocation of the CLI seed runner.
 */
export interface CliSeedOptions {
  databaseUrl?: string;
  nodeEnv?: string;
  referenceDate?: Date;
  exitProcess?: boolean;
  quiet?: boolean;
  logger?: (msg: string) => void;
}

/**
 * Parses and loads environment variables from .env or .env.local if present.
 * Uses process.loadEnvFile (Node 20.6+ built-in) with fallback to key=value parsing.
 */
export function loadEnvFiles(): void {
  const possiblePaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '../../.env'),
    path.resolve(process.cwd(), '../.env'),
  ];

  for (const envPath of possiblePaths) {
    if (fs.existsSync(envPath)) {
      try {
        if (typeof (process as any).loadEnvFile === 'function') {
          (process as any).loadEnvFile(envPath);
          return;
        }
      } catch {}

      // Fallback simple line-by-line parser for .env files
      try {
        const content = fs.readFileSync(envPath, 'utf8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx > 0) {
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if (
              (val.startsWith('"') && val.endsWith('"')) ||
              (val.startsWith("'") && val.endsWith("'"))
            ) {
              val = val.slice(1, -1);
            }
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
        return;
      } catch {}
    }
  }
}

/**
 * Extracts non-sensitive target database information (hostname and database name).
 * Strips usernames, passwords, tokens, and query parameters.
 */
export function extractTargetDbInfo(connectionString: string): { host: string; database: string } {
  try {
    const parsed = new URL(connectionString);
    const host = parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;
    const database = parsed.pathname.replace(/^\//, '') || 'unknown';
    return { host, database };
  } catch {
    return { host: 'unknown', database: 'unknown' };
  }
}

/**
 * Formats a clean ASCII summary table of upserted entities.
 */
export function formatSummaryTable(summary: SeedSummary): Record<string, string | number>[] {
  return [
    {
      Entity: 'Organizations (app.organizations)',
      Status: 'Upserted',
      Count: summary.organizationsUpserted,
    },
    {
      Entity: 'Entitlements (app.entitlements)',
      Status: 'Upserted',
      Count: summary.entitlementsUpserted,
    },
    {
      Entity: 'Platform Admins (app.users)',
      Status: 'Upserted',
      Count: summary.platformAdminsUpserted,
    },
    {
      Entity: 'Company Admins (app.users)',
      Status: 'Upserted',
      Count: summary.companyAdminsUpserted,
    },
    {
      Entity: 'Candidates (app.users)',
      Status: 'Upserted',
      Count: summary.candidatesUpserted,
    },
    {
      Entity: 'Candidate Invitations (app.invitations)',
      Status: 'Upserted',
      Count: summary.invitationsUpserted,
    },
    {
      Entity: '────────────────────────────────────────',
      Status: '────────',
      Count: '─────',
    },
    {
      Entity: 'Grand Total',
      Status: 'Processed',
      Count: summary.totalRecordsUpserted,
    },
  ];
}

/**
 * Main CLI entry point execution function.
 *
 * Order of operations:
 * 1. Load env (.env / .env.local)
 * 2. Run safety guard FIRST (before any DB connection)
 * 3. Connect to database
 * 4. Seed all entities in FK-safe order inside the transactional/idempotent engine
 * 5. Print formatted summary table and metadata
 * 6. Close database connection cleanly
 */
export async function runCliSeed(options: CliSeedOptions = {}): Promise<SeedSummary> {
  const log = (msg: string) => {
    if (options.quiet) return;
    const sanitized = maskSensitiveData(msg);
    if (options.logger) {
      options.logger(sanitized);
    } else {
      console.log(sanitized);
    }
  };

  // 1. Load environment variables
  loadEnvFiles();

  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV ?? 'development';
  // Check DATABASE_URL first; fall back to DATABASE_MIGRATOR_URL if DATABASE_URL is not set
  const databaseUrl =
    options.databaseUrl ??
    (process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== ''
      ? process.env.DATABASE_URL
      : process.env.DATABASE_MIGRATOR_URL);

  if (!databaseUrl || databaseUrl.trim() === '') {
    const errorMsg =
      '\n❌ Missing database connection string.\n' +
      'Please set DATABASE_URL or DATABASE_MIGRATOR_URL in your environment or root .env file.\n' +
      'Example: DATABASE_URL=postgres://hs_migrator:hs_migrator_local@localhost:5434/hellosmart\n';
    console.error(errorMsg);
    if (options.exitProcess) {
      process.exit(1);
    }
    throw new Error('DATABASE_URL is not set');
  }

  // 2. Safety Guard Check FIRST before any DB connection
  try {
    assertEnvironmentSafe(nodeEnv, databaseUrl);
  } catch (err: any) {
    const dbInfo = extractTargetDbInfo(databaseUrl);
    console.error('\n🚫 DATABASE SEED BLOCKED BY SAFETY GUARD');
    console.error(`Target Host : ${dbInfo.host}`);
    console.error(`Environment : ${nodeEnv}`);
    console.error(`Reason      : ${err.message}`);
    console.error(
      '\nSeeding in production or against non-local database hosts is strictly forbidden.\n',
    );
    if (options.exitProcess) {
      process.exit(1);
    }
    throw err;
  }

  // 3. Connect to Database cleanly
  const startTime = Date.now();
  const dbInfo = extractTargetDbInfo(databaseUrl);
  log(`Connecting to local test database at ${dbInfo.host} (${dbInfo.database})...`);

  const Client = pg.Client || (pg as any).default?.Client;
  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();

    // 4. Execute safe seed inside transaction
    const summary = await runSafeSeed(client, {
      referenceDate: options.referenceDate ?? new Date(),
      skipSafetyCheck: true, // Guard already ran in Step 2
      logger: options.quiet ? () => {} : (m) => log(m),
    });

    const elapsedMs = Date.now() - startTime;

    // 5. Print formatted summary table and metadata
    if (!options.quiet) {
      console.log('\n================ HelloSmart Seed Summary ================');
      console.table(formatSummaryTable(summary));
      console.log(`Target Database : ${dbInfo.host} / ${dbInfo.database}`);
      console.log(`Execution Time  : ${elapsedMs}ms`);
      console.log(`Status          : Seed Completed Successfully (Idempotent)`);
      console.log('=========================================================\n');
    }

    if (options.exitProcess) {
      process.exit(0);
    }
    return summary;
  } catch (err: any) {
    console.error('\n❌ Seed execution failed:');
    console.error(maskSensitiveData(err.message || String(err)));
    if (options.exitProcess) {
      process.exit(1);
    }
    throw err;
  } finally {
    // 6. Cleanly close database connection (never hang)
    try {
      await client.end();
    } catch {}
  }
}

/**
 * Checks if this module is being run directly as a script from CLI.
 */
function isMain(): boolean {
  if (!process.argv || !process.argv[1]) return false;
  try {
    const currentFile = fileURLToPath(import.meta.url).replace(/\\/g, '/');
    const executedFile = process.argv[1].replace(/\\/g, '/');
    return (
      currentFile === executedFile ||
      currentFile.replace(/\.ts$/, '.js') === executedFile ||
      executedFile.endsWith('/dist/index.js') ||
      executedFile.endsWith('/src/index.ts')
    );
  } catch {
    return false;
  }
}

if (isMain()) {
  runCliSeed({ exitProcess: true }).catch(() => {
    process.exit(1);
  });
}
