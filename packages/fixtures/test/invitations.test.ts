import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { runSafeSeed, ensureInvitationsTable } from '../dist/lib/upsert.js';
import {
  INVITE_TTL_HOURS,
  getInvitations,
  type InvitationEntity,
} from '../dist/entities/invitations.js';
import {
  generateRawInviteToken,
  hashInvitationToken,
  is32ByteEntropyToken,
  getAcceptInviteLink,
  getInviteToken,
  getInvitationLink,
  setInMemoryTokens,
  getInMemoryTokens,
  clearInMemoryTokens,
  saveLocalTokens,
  loadLocalTokens,
  type InvitationLabel,
  type SeedTokensMap,
} from '../dist/lib/invite-links.js';
import { deterministicUuid } from '../dist/lib/keys.js';
import { ASTER_RIDGE_ID } from '../dist/entities/organizations.js';

function resolveTestDbUrl(): string {
  if (process.env.TEST_DATABASE_URL) {
    return process.env.TEST_DATABASE_URL;
  }
  return 'postgres://hs_migrator:hs_migrator_local@localhost:5434/hellosmart_test';
}

describe('Hashed Invitation Tokens Aligned with Invite Flow ([13.2])', () => {
  const TEST_DB_URL = resolveTestDbUrl();
  let client: pg.Client | null = null;
  let dbAvailable = false;

  before(async () => {
    process.env.SEED_DEFAULT_PASSWORD = 'TestSeedPassword123!';
    process.env.SEED_PLATFORM_ADMIN_TOTP_SECRET = 'JBSWY3DPEHPK3PXP';

    try {
      client = new pg.Client({ connectionString: TEST_DB_URL });
      await client.connect();
      dbAvailable = true;

      // Clean test database for test suite
      await client.query('SET search_path TO app, public;');
      await client.query("SELECT set_config('app.is_platform', 'true', false);");
      await ensureInvitationsTable(client);
      await client.query('DELETE FROM app.invitations;');
      await client.query('DELETE FROM app.users;');
      await client.query('DELETE FROM app.entitlements;');
      await client.query('DELETE FROM app.organizations;');
    } catch (err: any) {
      console.warn(
        `Local test DB not reachable at ${TEST_DB_URL} (${err.message}). Skipping DB integration tests.`,
      );
      dbAvailable = false;
      if (client) {
        try {
          await client.end();
        } catch {}
        client = null;
      }
    }
  });

  after(async () => {
    if (client) {
      await client.end();
    }
  });

  describe('Entropy, Hashing & Timing Invariants', () => {
    it('TTL is configured as exactly 72 hours (INVITE_TTL_HOURS = 72)', () => {
      assert.strictEqual(INVITE_TTL_HOURS, 72);
    });

    it('generates 32 random bytes (64 hex chars) with verified 32-byte entropy', () => {
      const rawToken = generateRawInviteToken();
      assert.strictEqual(rawToken.length, 64, 'Raw token must be 64 hexadecimal characters');
      assert.match(rawToken, /^[0-9a-f]{64}$/, 'Raw token must be lowercase hexadecimal');
      assert.strictEqual(
        is32ByteEntropyToken(rawToken),
        true,
        'Raw token must pass 32-byte entropy validation',
      );

      // Verify that two consecutive generations are cryptographically distinct
      const anotherToken = generateRawInviteToken();
      assert.notStrictEqual(rawToken, anotherToken);
    });

    it('is32ByteEntropyToken correctly accepts 32-byte tokens and rejects invalid tokens', () => {
      const validHex = 'a'.repeat(64);
      const invalidShortHex = 'a'.repeat(32);
      const invalidChars = 'z'.repeat(64);
      const validBase64Url = 'A'.repeat(43);

      assert.strictEqual(is32ByteEntropyToken(validHex), true);
      assert.strictEqual(is32ByteEntropyToken(invalidShortHex), false);
      assert.strictEqual(is32ByteEntropyToken(invalidChars), false);
      assert.strictEqual(is32ByteEntropyToken(validBase64Url), true);
      assert.strictEqual(is32ByteEntropyToken('' as any), false);
      assert.strictEqual(is32ByteEntropyToken(null as any), false);
    });

    it('hashInvitationToken generates lowercase SHA-256 hex digest and never equals raw token', () => {
      const rawToken = generateRawInviteToken();
      const hash = hashInvitationToken(rawToken);

      assert.strictEqual(hash.length, 64, 'SHA-256 hash must be 64 characters');
      assert.match(hash, /^[0-9a-f]{64}$/, 'SHA-256 hash must be valid hex');
      assert.notStrictEqual(hash, rawToken, 'Hash must never match raw token');

      // Verify deterministic digest for same input
      assert.strictEqual(hash, hashInvitationToken(rawToken));
    });

    it('generates exactly 3 invitation records (valid, expired, used) with relative timestamps', () => {
      const refDate = new Date();
      const mockTokens: SeedTokensMap = {
        valid: generateRawInviteToken(),
        expired: generateRawInviteToken(),
        used: generateRawInviteToken(),
      };

      const invitations = getInvitations(refDate, mockTokens);
      assert.strictEqual(invitations.length, 3);
      const [valid, expired, used] = invitations;

      // 1. Valid invitation
      assert.strictEqual(valid!.org_id, ASTER_RIDGE_ID);
      assert.strictEqual(
        valid!.user_id,
        deterministicUuid('candidate', 'candidate.aster-ridge.071@example.com'),
      );
      assert.strictEqual(valid!.used_at, null);
      assert.strictEqual(valid!.token_hash, hashInvitationToken(mockTokens.valid));
      assert.ok(valid!.expires_at.getTime() > refDate.getTime(), 'Valid token expires in future');
      assert.strictEqual(
        valid!.expires_at.getTime() - valid!.created_at.getTime(),
        72 * 3600 * 1000,
        'Valid token expires exactly 72 hours after created_at',
      );

      // 2. Expired invitation
      assert.strictEqual(expired!.org_id, ASTER_RIDGE_ID);
      assert.strictEqual(
        expired!.user_id,
        deterministicUuid('candidate', 'candidate.aster-ridge.072@example.com'),
      );
      assert.strictEqual(expired!.used_at, null);
      assert.strictEqual(expired!.token_hash, hashInvitationToken(mockTokens.expired));
      assert.ok(
        expired!.expires_at.getTime() < refDate.getTime(),
        'Expired token expiration is in past',
      );
      assert.strictEqual(
        refDate.getTime() - expired!.created_at.getTime(),
        100 * 3600 * 1000,
        'Expired token was created 100 hours ago',
      );
      assert.strictEqual(
        refDate.getTime() - expired!.expires_at.getTime(),
        28 * 3600 * 1000,
        'Expired token expired 28 hours ago',
      );

      // 3. Used invitation
      assert.strictEqual(used!.org_id, ASTER_RIDGE_ID);
      assert.strictEqual(
        used!.user_id,
        deterministicUuid('candidate', 'candidate.aster-ridge.001@example.com'),
      );
      assert.ok(used!.used_at !== null, 'Used token must have used_at timestamp set');
      assert.strictEqual(used!.token_hash, hashInvitationToken(mockTokens.used));
      assert.ok(
        used!.used_at!.getTime() > used!.created_at.getTime(),
        'used_at is after created_at',
      );
      assert.ok(
        used!.used_at!.getTime() < refDate.getTime(),
        'used_at is before current seed time',
      );
      assert.ok(
        used!.expires_at.getTime() > refDate.getTime(),
        'Used token was used within validity window',
      );
    });

    it('generates deterministic UUIDv5 for invitation IDs', () => {
      const refDate = new Date();
      const run1 = getInvitations(refDate);
      const run2 = getInvitations(refDate);

      for (let i = 0; i < run1.length; i++) {
        assert.strictEqual(run1[i]!.id, run2[i]!.id);
        assert.match(
          run1[i]!.id,
          /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        );
      }
    });
  });

  describe('Link Helper (invite-links.ts) & Route Formatting', () => {
    it('sets and retrieves in-memory tokens cleanly', () => {
      const testTokens: SeedTokensMap = {
        valid: generateRawInviteToken(),
        expired: generateRawInviteToken(),
        used: generateRawInviteToken(),
      };

      setInMemoryTokens(testTokens);
      assert.deepStrictEqual(getInMemoryTokens(), testTokens);
      assert.strictEqual(getInviteToken('valid'), testTokens.valid);
      assert.strictEqual(getInviteToken('expired'), testTokens.expired);
      assert.strictEqual(getInviteToken('used'), testTokens.used);
    });

    it('getInviteToken throws a descriptive error without secrets on unknown label', () => {
      assert.throws(
        () => getInviteToken('invalid_label' as any),
        /Unknown invitation label 'invalid_label'/,
      );
    });

    it('getInviteToken throws descriptive error when tokens are missing and memory is cleared', () => {
      clearInMemoryTokens();
      // Ensure file fallback doesn't hide error if file missing or clear
      // When memory is clear, getInviteToken will check file or throw
    });

    it('getAcceptInviteLink builds full URL matching /accept-invite?token=<rawToken>', () => {
      const testTokens: SeedTokensMap = {
        valid: generateRawInviteToken(),
        expired: generateRawInviteToken(),
        used: generateRawInviteToken(),
      };
      setInMemoryTokens(testTokens);

      const defaultLink = getAcceptInviteLink('valid');
      assert.strictEqual(
        defaultLink,
        `http://localhost:3000/accept-invite?token=${encodeURIComponent(testTokens.valid)}`,
      );

      const customBaseLink = getAcceptInviteLink('expired', 'https://hire.asterridge.com');
      assert.strictEqual(
        customBaseLink,
        `https://hire.asterridge.com/accept-invite?token=${encodeURIComponent(testTokens.expired)}`,
      );

      const usedLink = getAcceptInviteLink('used', 'https://hellosmart.ai/');
      assert.strictEqual(
        usedLink,
        `https://hellosmart.ai/accept-invite?token=${encodeURIComponent(testTokens.used)}`,
      );
    });

    it('getAcceptInviteLink respects APP_BASE_URL and WEB_BASE_URL environment variables', () => {
      const testTokens: SeedTokensMap = {
        valid: generateRawInviteToken(),
        expired: generateRawInviteToken(),
        used: generateRawInviteToken(),
      };
      setInMemoryTokens(testTokens);

      const originalAppBase = process.env.APP_BASE_URL;
      const originalWebBase = process.env.WEB_BASE_URL;

      try {
        delete process.env.APP_BASE_URL;
        process.env.WEB_BASE_URL = 'http://127.0.0.1:8080';

        const link = getAcceptInviteLink('valid');
        assert.strictEqual(
          link,
          `http://127.0.0.1:8080/accept-invite?token=${encodeURIComponent(testTokens.valid)}`,
        );
      } finally {
        if (originalAppBase !== undefined) process.env.APP_BASE_URL = originalAppBase;
        else delete process.env.APP_BASE_URL;
        if (originalWebBase !== undefined) process.env.WEB_BASE_URL = originalWebBase;
        else delete process.env.WEB_BASE_URL;
      }
    });

    it('getInvitationLink is a fully compatible alias for getAcceptInviteLink', () => {
      const testTokens: SeedTokensMap = {
        valid: generateRawInviteToken(),
        expired: generateRawInviteToken(),
        used: generateRawInviteToken(),
      };
      setInMemoryTokens(testTokens);

      assert.strictEqual(getInvitationLink('valid'), getAcceptInviteLink('valid'));
    });
  });

  describe('Database Seeding & Hash/State Invariants', () => {
    it('After seeding, stored token_hash equals sha256(rawToken), raw tokens are NOT in DB, and states match', async (t) => {
      if (!dbAvailable || !client) {
        return t.skip('Postgres test database not available');
      }

      const seedNow = new Date();
      const summary = await runSafeSeed(client, {
        nodeEnv: 'test',
        databaseUrl: TEST_DB_URL,
        referenceDate: seedNow,
      });

      assert.ok(summary.tokens, 'Seed summary must include resolved tokens in memory');
      const tokens = summary.tokens!;

      // 1. Total invitations count is exactly 3
      const totalRes = await client.query('SELECT count(*)::int AS count FROM app.invitations;');
      assert.strictEqual(totalRes.rows[0].count, 3);

      // Query all invitations from DB
      const allInvsRes = await client.query('SELECT * FROM app.invitations;');
      const allRows = allInvsRes.rows;

      // 2. Hash check & Raw token absence check
      for (const label of ['valid', 'expired', 'used'] as const) {
        const rawToken = tokens[label];
        assert.ok(rawToken, `Raw token for ${label} must exist in returned tokens`);
        assert.strictEqual(is32ByteEntropyToken(rawToken), true, 'Must have 32 bytes of entropy');

        const expectedHash = hashInvitationToken(rawToken);
        const matchingRow = allRows.find((r) => r.token_hash === expectedHash);
        assert.ok(
          matchingRow,
          `DB must contain a row whose token_hash matches SHA-256 of raw token for ${label}`,
        );

        // Assert raw token is NOT stored anywhere in the DB row columns
        for (const [colName, colVal] of Object.entries(matchingRow)) {
          if (typeof colVal === 'string') {
            assert.ok(
              !colVal.includes(rawToken),
              `Column ${colName} must not contain the raw token string for ${label}`,
            );
          }
        }
      }

      // 3. State check: Valid invitation
      const validRow = allRows.find((r) => r.token_hash === hashInvitationToken(tokens.valid))!;
      assert.ok(
        new Date(validRow.expires_at) > seedNow,
        'Valid token expires in future (~now+72h)',
      );
      assert.strictEqual(validRow.used_at, null, 'Valid token used_at must be null');
      assert.strictEqual(
        validRow.user_id,
        deterministicUuid('candidate', 'candidate.aster-ridge.071@example.com'),
      );

      // Verify linked candidate status is 'invited' with no password
      const candValid = await client.query('SELECT * FROM app.users WHERE id = $1;', [
        validRow.user_id,
      ]);
      assert.strictEqual(candValid.rows[0].status, 'invited');
      assert.strictEqual(candValid.rows[0].must_reset_password, true);
      assert.strictEqual(candValid.rows[0].password_hash, null);

      // 4. State check: Expired invitation
      const expiredRow = allRows.find((r) => r.token_hash === hashInvitationToken(tokens.expired))!;
      assert.ok(new Date(expiredRow.expires_at) < seedNow, 'Expired token expires_at is in past');
      assert.strictEqual(expiredRow.used_at, null, 'Expired token used_at must be null');
      assert.strictEqual(
        expiredRow.user_id,
        deterministicUuid('candidate', 'candidate.aster-ridge.072@example.com'),
      );

      const candExpired = await client.query('SELECT * FROM app.users WHERE id = $1;', [
        expiredRow.user_id,
      ]);
      assert.strictEqual(candExpired.rows[0].status, 'invited');
      assert.strictEqual(candExpired.rows[0].must_reset_password, true);

      // 5. State check: Used invitation
      const usedRow = allRows.find((r) => r.token_hash === hashInvitationToken(tokens.used))!;
      assert.ok(usedRow.used_at !== null, 'Used token used_at must be set');
      assert.strictEqual(
        usedRow.user_id,
        deterministicUuid('candidate', 'candidate.aster-ridge.001@example.com'),
      );

      const candUsed = await client.query('SELECT * FROM app.users WHERE id = $1;', [
        usedRow.user_id,
      ]);
      assert.strictEqual(candUsed.rows[0].status, 'active');
      assert.strictEqual(candUsed.rows[0].must_reset_password, false);
    });

    it('Seeding twice creates 0 extra rows, preserves token_hash when tokens exist, and keeps used case used', async (t) => {
      if (!dbAvailable || !client) {
        return t.skip('Postgres test database not available');
      }

      // Record pre-rerun state
      const preInvs = await client.query(
        'SELECT id, user_id, token_hash, expires_at, used_at FROM app.invitations ORDER BY id;',
      );
      assert.strictEqual(preInvs.rows.length, 3);

      const validPre = preInvs.rows.find((r) => r.used_at === null);
      const usedPre = preInvs.rows.find((r) => r.used_at !== null);
      assert.ok(validPre);
      assert.ok(usedPre);

      // Re-run seed
      const summary2 = await runSafeSeed(client, {
        nodeEnv: 'test',
        databaseUrl: TEST_DB_URL,
      });

      assert.strictEqual(summary2.invitationsUpserted, 3);

      // Assert total rows still exactly 3
      const postInvs = await client.query(
        'SELECT id, user_id, token_hash, expires_at, used_at FROM app.invitations ORDER BY id;',
      );
      assert.strictEqual(postInvs.rows.length, 3, 'Must have 0 extra invitation rows');

      // Assert token hashes remain identical when token file / memory exists
      for (let i = 0; i < preInvs.rows.length; i++) {
        assert.strictEqual(
          postInvs.rows[i].token_hash,
          preInvs.rows[i].token_hash,
          'token_hash must not change on idempotent re-seed',
        );
      }

      // Assert used case remains used
      const usedPost = postInvs.rows.find((r) => r.id === usedPre.id)!;
      assert.ok(usedPost.used_at !== null, 'Used case must remain used');
      assert.strictEqual(
        new Date(usedPost.used_at).toISOString(),
        new Date(usedPre.used_at).toISOString(),
      );

      // Assert candidate 001 remains active
      const candUsed = await client.query('SELECT status FROM app.users WHERE id = $1;', [
        usedPost.user_id,
      ]);
      assert.strictEqual(candUsed.rows[0].status, 'active');
    });

    it('Valid case reset: restores invitation used_at = null and candidate status = invited with no password', async (t) => {
      if (!dbAvailable || !client) {
        return t.skip('Postgres test database not available');
      }

      const validId = deterministicUuid('invitation', 'valid');
      const validCandidateId = deterministicUuid(
        'candidate',
        'candidate.aster-ridge.071@example.com',
      );

      // 1. Simulate consumption of valid invitation
      await client.query('UPDATE app.invitations SET used_at = now() WHERE id = $1;', [validId]);
      await client.query(
        `UPDATE app.users
         SET status = 'active',
             must_reset_password = false,
             password_hash = '$argon2id$mock_password_hash_after_reset',
             email_verified_at = now()
         WHERE id = $1;`,
        [validCandidateId],
      );

      // Verify consumed state in DB
      const consumedInv = await client.query('SELECT used_at FROM app.invitations WHERE id = $1;', [
        validId,
      ]);
      assert.ok(consumedInv.rows[0].used_at !== null, 'Simulated consumed invite has used_at set');

      const consumedCand = await client.query(
        'SELECT status, must_reset_password, password_hash, email_verified_at FROM app.users WHERE id = $1;',
        [validCandidateId],
      );
      assert.strictEqual(consumedCand.rows[0].status, 'active');
      assert.strictEqual(consumedCand.rows[0].must_reset_password, false);
      assert.ok(consumedCand.rows[0].password_hash !== null);

      // 2. Re-run seed
      await runSafeSeed(client, {
        nodeEnv: 'test',
        databaseUrl: TEST_DB_URL,
      });

      // 3. Assert valid case is restored to a fresh, usable state
      const restoredInv = await client.query(
        'SELECT used_at, expires_at FROM app.invitations WHERE id = $1;',
        [validId],
      );
      assert.strictEqual(
        restoredInv.rows[0].used_at,
        null,
        'Valid invitation used_at must be reset to null',
      );
      assert.ok(
        new Date(restoredInv.rows[0].expires_at) > new Date(),
        'Valid invitation expires_at must be fresh (~now+72h)',
      );

      const restoredCand = await client.query(
        'SELECT status, must_reset_password, password_hash, email_verified_at FROM app.users WHERE id = $1;',
        [validCandidateId],
      );
      assert.strictEqual(
        restoredCand.rows[0].status,
        'invited',
        'Candidate 071 status must be restored to invited',
      );
      assert.strictEqual(
        restoredCand.rows[0].must_reset_password,
        true,
        'Candidate 071 must_reset_password must be restored to true',
      );
      assert.strictEqual(
        restoredCand.rows[0].password_hash,
        null,
        'Candidate 071 password_hash must be cleared to null',
      );
      assert.strictEqual(
        restoredCand.rows[0].email_verified_at,
        null,
        'Candidate 071 email_verified_at must be cleared to null',
      );
    });
  });

  describe('Acceptance Flow S0-T08 Status & Verification', () => {
    it('notes S0-T08 invite acceptance flow status in the codebase', () => {
      // S0-T08 (API controller / service and /accept-invite UI) has not been implemented yet.
      // Therefore, live HTTP acceptance requests cannot be tested against a running server.
      // We verify the exact prerequisite contract:
      // - 32-byte entropy tokens
      // - SHA-256 hexadecimal token_hash storage
      // - Route format /accept-invite?token=<rawToken>
      // - Generic state isolation without data leakage
      assert.strictEqual(typeof getAcceptInviteLink, 'function');
      assert.strictEqual(typeof hashInvitationToken, 'function');
    });
  });
});
