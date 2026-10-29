import { deterministicUuid } from '../lib/keys.js';
import { ASTER_RIDGE_ID } from './organizations.js';
import {
  hashInvitationToken,
  generateRawInviteToken,
  getInviteToken,
  getAcceptInviteLink,
  getInvitationLink,
  type InvitationLabel,
  type SeedTokensMap,
} from '../lib/invite-links.js';

// Re-export invite-links utilities for consumers
export {
  hashInvitationToken,
  generateRawInviteToken,
  getInviteToken,
  getAcceptInviteLink,
  getInvitationLink,
  type InvitationLabel,
  type SeedTokensMap,
};

/**
 * Standard candidate invitation validity window in hours (BR-24).
 */
export const INVITE_TTL_HOURS = 72;

/**
 * Candidate Invitation entity representation matching PostgreSQL schema.
 * Note: Raw tokens are NEVER persisted to the database; only token_hash is stored.
 */
export interface InvitationEntity {
  id: string; // Deterministic UUIDv5
  org_id: string; // Foreign key to app.organizations(id)
  user_id: string; // Foreign key to app.users(id) - candidate
  token_hash: string; // SHA-256 hash of raw token
  invited_by: string; // Foreign key to app.users(id) - inviter admin
  created_at: Date;
  expires_at: Date;
  used_at: Date | null;
}

/**
 * Backwards-compatible alias for getInviteToken.
 */
export function getInvitationToken(label: InvitationLabel): string {
  return getInviteToken(label);
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
 * @param tokens Optional SeedTokensMap containing raw 32-byte tokens to hash.
 */
export function getInvitations(
  refDate: Date = new Date(),
  tokens?: SeedTokensMap,
): InvitationEntity[] {
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

  // Resolve tokens for each label
  const validToken = tokens?.valid ?? getSafeToken('valid');
  const expiredToken = tokens?.expired ?? getSafeToken('expired');
  const usedToken = tokens?.used ?? getSafeToken('used');

  return [
    {
      id: deterministicUuid('invitation', 'valid'),
      org_id: ASTER_RIDGE_ID,
      user_id: validCandidateId,
      token_hash: hashInvitationToken(validToken),
      invited_by: asterAdminId,
      created_at: validCreatedAt,
      expires_at: validExpiresAt,
      used_at: null,
    },
    {
      id: deterministicUuid('invitation', 'expired'),
      org_id: ASTER_RIDGE_ID,
      user_id: expiredCandidateId,
      token_hash: hashInvitationToken(expiredToken),
      invited_by: asterAdminId,
      created_at: expiredCreatedAt,
      expires_at: expiredExpiresAt,
      used_at: null,
    },
    {
      id: deterministicUuid('invitation', 'used'),
      org_id: ASTER_RIDGE_ID,
      user_id: usedCandidateId,
      token_hash: hashInvitationToken(usedToken),
      invited_by: asterAdminId,
      created_at: usedCreatedAt,
      expires_at: usedExpiresAt,
      used_at: usedAt,
    },
  ];
}

function getSafeToken(label: InvitationLabel): string {
  try {
    return getInviteToken(label);
  } catch {
    return generateRawInviteToken();
  }
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
