import fs from 'node:fs';
import path from 'node:path';

export interface SeedConfig {
  nodeEnv: string;
  databaseUrl: string;
  defaultPassword: string;
  allowedHosts: string[];
  referenceDate: Date;
  dryRun: boolean;
  onlyGroups: string[];
  confirmRemote: boolean;
  verbose: boolean;
  logger?: (msg: string) => void;
}

function loadEnvFile(): void {
  // Try loading from current dir or project root
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../../.env'),
  ];
  for (const envPath of candidates) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim();
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
      break;
    }
  }
}

export function loadConfig(argv: string[] = process.argv.slice(2)): SeedConfig {
  loadEnvFile();

  const dryRun = argv.includes('--dry-run');
  const confirmRemote = argv.includes('--confirm-remote');
  const verbose = argv.includes('--verbose');

  let onlyGroups: string[] = [];
  const onlyIdx = argv.indexOf('--only');
  if (onlyIdx !== -1 && argv[onlyIdx + 1]) {
    onlyGroups = (argv[onlyIdx + 1] ?? '')
      .split(',')
      .map((g) => g.trim().toLowerCase())
      .filter(Boolean);
  }

  const nodeEnv = (
    process.env['SEED_ENV'] ||
    process.env['NODE_ENV'] ||
    'development'
  ).toLowerCase();

  // hs_migrator URL is preferred for running DDL/platform seed operations
  const databaseUrl =
    process.env['DATABASE_MIGRATOR_URL'] ||
    process.env['DATABASE_URL'] ||
    'postgres://hs_migrator:hs_migrator_local@localhost:5434/hellosmart';

  const defaultPassword = process.env['SEED_DEFAULT_PASSWORD'] || 'DevPassword123!';

  const allowedHosts = (process.env['SEED_ALLOWED_DB_HOSTS'] || 'localhost,127.0.0.1,postgres')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);

  const refDateStr = process.env['SEED_REFERENCE_DATE'];
  const referenceDate = refDateStr ? new Date(refDateStr) : new Date('2026-10-23T00:00:00Z');

  return {
    nodeEnv,
    databaseUrl,
    defaultPassword,
    allowedHosts,
    referenceDate,
    dryRun,
    onlyGroups,
    confirmRemote,
    verbose,
  };
}
