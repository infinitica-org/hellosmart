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
export * from './lib/credentials.js';
export * from './lib/upsert.js';
export * from './lib/invite-links.js';
export * from './verify.js';
import { getAcceptInviteLink } from './lib/invite-links.js';

// Test fixtures and tenant context helpers for integration tests
export interface TenantContext {
  orgId: string;
  sessionToken: string;
}

export async function createTenantContext(slug: string): Promise<TenantContext> {
  return {
    orgId: `org_${slug}`,
    sessionToken: `token_${slug}`,
  };
}

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
  seedPassword?: string;
  totpSecret?: string;
  showTokens?: boolean;
}

/**
 * Checks if the current execution is running inside a CI environment.
 */
export function isCiEnvironment(): boolean {
  const ciEnv = process.env.CI;
  if (
    ciEnv !== undefined &&
    ciEnv !== '' &&
    ciEnv.toLowerCase() !== 'false' &&
    ciEnv.toLowerCase() !== '0'
  ) {
    return true;
  }
  return Boolean(process.env.GITHUB_ACTIONS || process.env.CONTINUOUS_INTEGRATION);
}

/**
 * Parses and loads environment variables from .env and .env.local files.
 * Searches cwd and workspace root directories.
 * Variables from .env.local take precedence over .env.
 */
export function loadEnvFiles(): void {
  const currentDir = process.cwd();
  const fileDir = path.dirname(fileURLToPath(import.meta.url));

  const candidateDirs = [
    currentDir,
    path.resolve(currentDir, '..'),
    path.resolve(currentDir, '../..'),
    fileDir,
    path.resolve(fileDir, '..'),
    path.resolve(fileDir, '../..'),
    path.resolve(fileDir, '../../..'),
  ];

  // Helper to parse key-value lines
  const parseEnvContent = (content: string, overwrite: boolean) => {
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
        if (overwrite || process.env[key] === undefined) {
          process.env[key] = val;
        }
      }
    }
  };

  // 1. First pass: load base .env without overwriting existing environment
  for (const dir of candidateDirs) {
    const envFile = path.resolve(dir, '.env');
    if (fs.existsSync(envFile)) {
      try {
        const content = fs.readFileSync(envFile, 'utf8');
        parseEnvContent(content, false);
      } catch {}
      break;
    }
  }

  // 2. Second pass: load .env.local with overwrite=true so local uncommitted overrides take precedence
  for (const dir of candidateDirs) {
    const envLocalFile = path.resolve(dir, '.env.local');
    if (fs.existsSync(envLocalFile)) {
      try {
        const content = fs.readFileSync(envLocalFile, 'utf8');
        parseEnvContent(content, true);
      } catch {}
      break;
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

  // Determine if raw tokens should be printed
  const showTokens =
    options.showTokens ??
    (typeof process !== 'undefined' && process.argv
      ? process.argv.includes('--show-tokens')
      : false);

  // Refuse to print raw tokens in CI environment
  if (showTokens && isCiEnvironment()) {
    console.error(
      '\n🚫 Cannot print raw invitation tokens: CI environment detected (refusing --show-tokens).\n',
    );
    if (options.exitProcess) {
      process.exit(1);
    }
    throw new Error('Refusing to print invitation tokens in CI environment');
  }

  // 1. Load environment variables
  loadEnvFiles();

  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV ?? 'development';
  // Connect with OWNER / MIGRATOR role: DATABASE_MIGRATOR_URL takes precedence, falling back to DATABASE_URL
  const databaseUrl =
    options.databaseUrl ??
    (process.env.DATABASE_MIGRATOR_URL && process.env.DATABASE_MIGRATOR_URL.trim() !== ''
      ? process.env.DATABASE_MIGRATOR_URL
      : process.env.DATABASE_URL);

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
      seedPassword: options.seedPassword,
      totpSecret: options.totpSecret,
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

    if (showTokens && summary.tokens) {
      const tokenOutput = [
        '================ Seed Invitation Tokens ================',
        `Valid   : token=${summary.tokens.valid}`,
        `          link=${getAcceptInviteLink('valid')}`,
        `Expired : token=${summary.tokens.expired}`,
        `          link=${getAcceptInviteLink('expired')}`,
        `Used    : token=${summary.tokens.used}`,
        `          link=${getAcceptInviteLink('used')}`,
        '========================================================',
      ].join('\n');
      if (options.logger) {
        options.logger(tokenOutput);
      } else {
        console.log(tokenOutput);
      }
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
  const showTokens = process.argv.includes('--show-tokens');
  runCliSeed({ exitProcess: true, showTokens }).catch(() => {
    process.exit(1);
  });
}
