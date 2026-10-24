import crypto from 'node:crypto';
import { deterministicUuid } from '../lib/keys.js';
import { ASTER_RIDGE_ID } from './organizations.js';

/**
 * Standard candidate invitation validity window in hours (BR-24).
 */
export const INVITE_TTL_HOURS = 72;

/**
 * Typed union for invitation fixture states.
 */
export type InvitationLabel = 'valid' | 'expired' | 'used';

/**
 * Obviously fake, dev-only raw tokens for local testing.
 * Kept only in memory for test helpers and link generation; never stored in plaintext in the database.
 */
export const DEV_INVITE_TOKEN_VALID = 'dev-invite-valid-ast-cand-071';
export const DEV_INVITE_TOKEN_EXPIRED = 'dev-invite-expired-ast-cand-072';
export const DEV_INVITE_TOKEN_USED = 'dev-invite-used-ast-cand-001';

/**
 * SHA-256 token hashing helper matching application security standards (BR-16, BR-24).
 */
export function hashInvitationToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Candidate Invitation entity representation matching PostgreSQL schema.
 */
export interface InvitationEntity {
  id: string; // Deterministic UUIDv5
  org_id: string; // Foreign key to app.organizations(id)
  user_id: string; // Foreign key to app.users(id) - candidate
  token_hash: string; // SHA-256 hash of raw token
  raw_token: string; // Dev-only string constant (never stored in DB or logged)
  invited_by: string; // Foreign key to app.users(id) - inviter admin
  created_at: Date;
  expires_at: Date;
  used_at: Date | null;
}

/**
 * Generates invitation fixtures for testing candidate onboarding.
 *
 * Timestamps are computed relative to reference date (`now` at seed time):
 * 1. Valid: created at `now`, expires in 72h (`now + 72h`), `used_at: null`. Linked to candidate 071 (`invited`).
 * 2. Expired: created at `now - 100h`, expired at `now - 28h`, `used_at: null`. Linked to candidate 072 (`invited`).
 * 3. Used: created at `now - 24h`, expires at `now + 48h`, `used_at: now - 12h`. Linked to candidate 001 (`active`).
 *
 * @param refDate Reference timestamp representing "now" (defaults to current date at seed time).
 */
export function getInvitations(refDate: Date = new Date()): InvitationEntity[] {
  const now = refDate.getTime();
  const asterAdminId = deterministicUuid('user', 'admin@asterridge.com');

  // Candidate 071 (Aster Ridge - status: 'invited', must_reset_password: true)
  const validCandidateId = deterministicUuid('candidate', 'candidate.aster-ridge.071@example.com');
  const validCreatedAt = new Date(now);
  const validExpiresAt = new Date(now + INVITE_TTL_HOURS * 3600 * 1000);

  // Candidate 072 (Aster Ridge - status: 'invited', must_reset_password: true)
  const expiredCandidateId = deterministicUuid(
    'candidate',
    'candidate.aster-ridge.072@example.com',
  );
  const expiredCreatedAt = new Date(now - 100 * 3600 * 1000); // 100 hours ago
  const expiredExpiresAt = new Date(expiredCreatedAt.getTime() + INVITE_TTL_HOURS * 3600 * 1000); // expired 28 hours ago

  // Candidate 001 (Aster Ridge - status: 'active', completed onboarding)
  const usedCandidateId = deterministicUuid('candidate', 'candidate.aster-ridge.001@example.com');
  const usedCreatedAt = new Date(now - 24 * 3600 * 1000); // 24 hours ago
  const usedExpiresAt = new Date(usedCreatedAt.getTime() + INVITE_TTL_HOURS * 3600 * 1000); // expires in 48 hours
  const usedAt = new Date(now - 12 * 3600 * 1000); // used 12 hours ago (between created_at and now)

  return [
    {
      id: deterministicUuid('invitation', 'valid'),
      org_id: ASTER_RIDGE_ID,
      user_id: validCandidateId,
      token_hash: hashInvitationToken(DEV_INVITE_TOKEN_VALID),
      raw_token: DEV_INVITE_TOKEN_VALID,
      invited_by: asterAdminId,
      created_at: validCreatedAt,
      expires_at: validExpiresAt,
      used_at: null,
    },
    {
      id: deterministicUuid('invitation', 'expired'),
      org_id: ASTER_RIDGE_ID,
      user_id: expiredCandidateId,
      token_hash: hashInvitationToken(DEV_INVITE_TOKEN_EXPIRED),
      raw_token: DEV_INVITE_TOKEN_EXPIRED,
      invited_by: asterAdminId,
      created_at: expiredCreatedAt,
      expires_at: expiredExpiresAt,
      used_at: null,
    },
    {
      id: deterministicUuid('invitation', 'used'),
      org_id: ASTER_RIDGE_ID,
      user_id: usedCandidateId,
      token_hash: hashInvitationToken(DEV_INVITE_TOKEN_USED),
      raw_token: DEV_INVITE_TOKEN_USED,
      invited_by: asterAdminId,
      created_at: usedCreatedAt,
      expires_at: usedExpiresAt,
      used_at: usedAt,
    },
  ];
}

/**
 * Returns the raw token string for a given invitation state label.
 * Throws a descriptive error if an unknown label is provided.
 */
export function getInvitationToken(label: InvitationLabel): string {
  switch (label) {
    case 'valid':
      return DEV_INVITE_TOKEN_VALID;
    case 'expired':
      return DEV_INVITE_TOKEN_EXPIRED;
    case 'used':
      return DEV_INVITE_TOKEN_USED;
    default:
      throw new Error(
        `Unknown invitation label '${String(label)}'. Expected 'valid' | 'expired' | 'used'.`,
      );
  }
}

/**
 * Returns the full candidate invitation link built from the app's real invite route
 * and a configurable base URL (APP_BASE_URL / WEB_BASE_URL, default http://localhost:3000).
 *
 * Route: `/invite?token=<raw_token>` (BR-24)
 *
 * @param label 'valid' | 'expired' | 'used'
 * @param baseUrl Optional override for the base URL.
 */
export function getInvitationLink(label: InvitationLabel, baseUrl?: string): string {
  const token = getInvitationToken(label);
  const rawBase =
    baseUrl || process.env.APP_BASE_URL || process.env.WEB_BASE_URL || 'http://localhost:3000';
  const cleanBase = rawBase.replace(/\/+$/, '');
  return `${cleanBase}/invite?token=${encodeURIComponent(token)}`;
}

/**
 * Token state validation helper.
 * Validates expiration against reference timestamp and checks whether the token has been consumed.
 */
export function validateInvitation(
  invitation: { expires_at: Date; used_at: Date | null },
  now: Date = new Date(),
): { valid: boolean; reason?: 'expired' | 'already_used' } {
  if (invitation.used_at !== null) {
    return { valid: false, reason: 'already_used' };
  }
  if (invitation.expires_at.getTime() <= now.getTime()) {
    return { valid: false, reason: 'expired' };
  }
  return { valid: true };
}
