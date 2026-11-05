import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Typed union for candidate invitation fixture states.
 */
export type InvitationLabel = 'valid' | 'expired' | 'used';

/**
 * Map of raw invitation tokens keyed by fixture state.
 */
export type SeedTokensMap = Record<InvitationLabel, string>;

/**
 * In-memory storage for raw tokens generated during seed execution.
 * Allows in-process tests (including CI) to access generated tokens without file dependencies.
 */
let inMemoryTokens: SeedTokensMap | null = null;

/**
 * Sets the in-memory raw tokens for the current process.
 */
export function setInMemoryTokens(tokens: SeedTokensMap): void {
  inMemoryTokens = { ...tokens };
}

/**
 * Retrieves the in-memory raw tokens for the current process, if set.
 */
export function getInMemoryTokens(): SeedTokensMap | null {
  return inMemoryTokens ? { ...inMemoryTokens } : null;
}

/**
 * Clears the in-memory raw tokens.
 */
export function clearInMemoryTokens(): void {
  inMemoryTokens = null;
}

/**
 * Generates a cryptographically secure 32-byte raw token.
 * Formatted as a 64-character lowercase hexadecimal string (32 bytes of entropy).
 */
export function generateRawInviteToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Computes the binary SHA-256 hash of a raw invitation token string.
 * Matches backend InvitationsService.hashToken (apps/api/src/modules/auth/invitations.service.ts:73)
 * and PostgreSQL app.invitations.token_hash (bytea, 32 bytes) from migration 0003_invitations.sql.
 *
 * @param rawToken The plaintext token string.
 * @returns 32-byte binary Buffer for app.invitations.token_hash bytea column.
 */
export function hashInvitationToken(rawToken: string): Buffer {
  return crypto.createHash('sha256').update(rawToken.trim()).digest();
}

/**
 * Helper to return the hexadecimal representation of the token hash.
 */
export function hashInvitationTokenHex(rawToken: string): string {
  return hashInvitationToken(rawToken).toString('hex');
}

/**
 * Validates that a raw token string contains exactly 32 bytes of entropy.
 */
export function is32ByteEntropyToken(rawToken: string): boolean {
  if (typeof rawToken !== 'string') return false;
  // If hex string (64 hex characters = 32 bytes)
  if (/^[0-9a-f]{64}$/i.test(rawToken)) {
    return Buffer.from(rawToken, 'hex').length === 32;
  }
  // If base64url string (43 characters = 32 bytes)
  if (/^[A-Za-z0-9_-]{43}$/.test(rawToken)) {
    return Buffer.from(rawToken, 'base64url').length === 32;
  }
  return false;
}

/**
 * Resolves the path to the gitignored local seed tokens file.
 */
export function getLocalTokenFilePath(): string {
  const cwd = process.cwd();

  // If cwd is monorepo root, store under packages/fixtures/.seed-tokens.local.json
  if (fs.existsSync(path.resolve(cwd, 'packages/fixtures'))) {
    return path.resolve(cwd, 'packages/fixtures/.seed-tokens.local.json');
  }

  // If cwd is packages/fixtures
  if (fs.existsSync(path.resolve(cwd, 'src/lib/invite-links.ts'))) {
    return path.resolve(cwd, '.seed-tokens.local.json');
  }

  // Fallback relative to current module location
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(currentDir, '../../.seed-tokens.local.json');
}

/**
 * Loads raw tokens from the local gitignored file, if present.
 */
export function loadLocalTokens(): SeedTokensMap | null {
  const primaryPath = getLocalTokenFilePath();
  const alternatePaths = [
    primaryPath,
    path.resolve(process.cwd(), '.seed-tokens.local.json'),
    path.resolve(process.cwd(), 'packages/fixtures/.seed-tokens.local.json'),
  ];

  for (const filePath of alternatePaths) {
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(content) as Record<string, unknown>;
        if (
          typeof parsed.valid === 'string' &&
          typeof parsed.expired === 'string' &&
          typeof parsed.used === 'string'
        ) {
          return {
            valid: parsed.valid,
            expired: parsed.expired,
            used: parsed.used,
          };
        }
      } catch {
        // Continue to next path if parse fails
      }
    }
  }

  return null;
}

/**
 * Persists raw tokens to the local gitignored file with restrictive permissions (0600).
 */
export function saveLocalTokens(tokens: SeedTokensMap): void {
  const filePath = getLocalTokenFilePath();
  const data = JSON.stringify(tokens, null, 2);

  try {
    fs.writeFileSync(filePath, data, { mode: 0o600 });
  } catch {
    // If chmod/mode fails on specific platforms, try writing standard file
    fs.writeFileSync(filePath, data);
  }
}

/**
 * Retrieves the raw invitation token for a specified label.
 * Checks memory cache first, then the local gitignored file.
 *
 * @throws Error if the label is invalid or tokens have not been seeded yet.
 */
export function getInviteToken(label: InvitationLabel): string {
  if (label !== 'valid' && label !== 'expired' && label !== 'used') {
    throw new Error(
      `Unknown invitation label '${String(label)}'. Expected 'valid' | 'expired' | 'used'.`,
    );
  }

  // 1. Check in-memory tokens first
  if (inMemoryTokens && typeof inMemoryTokens[label] === 'string') {
    return inMemoryTokens[label];
  }

  // 2. Check local gitignored token file
  const fileTokens = loadLocalTokens();
  if (fileTokens && typeof fileTokens[label] === 'string') {
    return fileTokens[label];
  }

  throw new Error(
    "Invitation tokens not found. Please run 'pnpm db:seed' first to generate seed invitation tokens.",
  );
}

/**
 * Builds the acceptance URL for an invitation using the app's real route:
 * `<webBaseUrl>/accept-invite?token=<rawToken>`
 *
 * @param label 'valid' | 'expired' | 'used'
 * @param baseUrl Optional base URL override (defaults to APP_BASE_URL, WEB_BASE_URL, or http://localhost:3000)
 */
export function getAcceptInviteLink(label: InvitationLabel, baseUrl?: string): string {
  const token = getInviteToken(label);
  const rawBase =
    baseUrl || process.env.APP_BASE_URL || process.env.WEB_BASE_URL || 'http://localhost:3000';
  const cleanBase = rawBase.replace(/\/+$/, '');
  return `${cleanBase}/accept-invite?token=${encodeURIComponent(token)}`;
}

/**
 * Backwards-compatible alias for getAcceptInviteLink.
 */
export function getInvitationLink(label: InvitationLabel, baseUrl?: string): string {
  return getAcceptInviteLink(label, baseUrl);
}
