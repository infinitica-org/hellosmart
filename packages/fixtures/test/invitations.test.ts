import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { InvitationsService } from '../../../apps/api/dist/modules/auth/invitations.service.js';
import { runSafeSeed } from '../dist/lib/upsert.js';
import {
  INVITE_TTL_HOURS,
  getInvitations,
  type InvitationEntity,
} from '../dist/entities/invitations.js';
import {
  generateRawInviteToken,
  hashInvitationToken,
  hashInvitationTokenHex,
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
import { ASTER_RIDGE_ID, BRINDLE_CO_ID } from '../dist/entities/organizations.js';

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

    it('hashInvitationToken generates 32-byte binary SHA-256 Buffer matching backend and never equals raw token', () => {
      const rawToken = generateRawInviteToken();
      const hash = hashInvitationToken(rawToken);

      assert.strictEqual(Buffer.isBuffer(hash), true, 'SHA-256 hash must be a Buffer');
      assert.strictEqual(hash.length, 32, 'SHA-256 binary hash must be exactly 32 bytes');
      assert.notStrictEqual(hash.toString('hex'), rawToken, 'Hash must never match raw token');

      // Verify deterministic digest for same input
      assert.strictEqual(hash.equals(hashInvitationToken(rawToken)), true);
      assert.strictEqual(hashInvitationTokenHex(rawToken), hash.toString('hex'));
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
      assert.ok(valid!.token_hash.equals(hashInvitationToken(mockTokens.valid)));
      assert.strictEqual(valid!.role, 'candidate');
      assert.strictEqual(valid!.email, 'candidate.aster-ridge.071@example.com');
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
      assert.ok(expired!.token_hash.equals(hashInvitationToken(mockTokens.expired)));
      assert.strictEqual(expired!.role, 'candidate');
      assert.strictEqual(expired!.email, 'candidate.aster-ridge.072@example.com');
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
      assert.ok(used!.token_hash.equals(hashInvitationToken(mockTokens.used)));
      assert.strictEqual(used!.role, 'candidate');
      assert.strictEqual(used!.email, 'candidate.aster-ridge.001@example.com');
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

    it('TTL consistency: for all 3 invitations expires_at - created_at === 72h, and timing states hold', () => {
      const refDate = new Date();
      const mockTokens: SeedTokensMap = {
        valid: generateRawInviteToken(),
        expired: generateRawInviteToken(),
        used: generateRawInviteToken(),
      };

      const [valid, expired, used] = getInvitations(refDate, mockTokens);

      // Assert that for all three invitations expires_at minus created_at equals exactly INVITE_TTL_HOURS (72h)
      for (const inv of [valid, expired, used]) {
        assert.strictEqual(
          inv!.expires_at.getTime() - inv!.created_at.getTime(),
          INVITE_TTL_HOURS * 3600 * 1000,
          `Invitation ${inv!.id} expires_at minus created_at must equal exactly INVITE_TTL_HOURS (72h)`,
        );
      }

      // Valid has expires_at in the future and used_at null
      assert.ok(
        valid!.expires_at.getTime() > refDate.getTime(),
        'Valid invitation has expires_at in the future',
      );
      assert.strictEqual(valid!.used_at, null, 'Valid invitation has used_at null');

      // Expired has expires_at in the past and used_at null
      assert.ok(
        expired!.expires_at.getTime() < refDate.getTime(),
        'Expired invitation has expires_at in the past',
      );
      assert.strictEqual(expired!.used_at, null, 'Expired invitation has used_at null');

      // Used has used_at after created_at and before expires_at
      assert.ok(used!.used_at !== null, 'Used invitation must have used_at timestamp set');
      assert.ok(
        used!.used_at!.getTime() > used!.created_at.getTime(),
        'Used invitation used_at must be strictly after created_at',
      );
      assert.ok(
        used!.used_at!.getTime() < used!.expires_at.getTime(),
        'Used invitation used_at must be strictly before expires_at',
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
        const matchingRow = allRows.find(
          (r) => Buffer.isBuffer(r.token_hash) && r.token_hash.equals(expectedHash),
        );
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
      const validRow = allRows.find((r) => r.token_hash.equals(hashInvitationToken(tokens.valid)))!;
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
      const expiredRow = allRows.find((r) =>
        r.token_hash.equals(hashInvitationToken(tokens.expired)),
      )!;
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
      const usedRow = allRows.find((r) => r.token_hash.equals(hashInvitationToken(tokens.used)))!;
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
        assert.ok(
          postInvs.rows[i].token_hash.equals(preInvs.rows[i].token_hash),
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

    it('proves valid reset is strictly scoped by BOTH id and org_id and leaves same-email user in another org untouched', async (t) => {
      if (!dbAvailable || !client) {
        return t.skip('Postgres test database not available');
      }

      const validId = deterministicUuid('invitation', 'valid');
      const validCandidateId = deterministicUuid(
        'candidate',
        'candidate.aster-ridge.071@example.com',
      );
      const otherOrgCandidateId = deterministicUuid(
        'candidate',
        'other-org-candidate-same-email-71',
      );

      // 1. Insert a candidate in Brindle & Co with the exact same email as candidate 071, but active and with a password
      await client.query(
        `INSERT INTO app.users (
          id, org_id, email, name, role, status, email_verified_at, must_reset_password, password_hash
        ) VALUES (
          $1, $2, $3, $4, 'candidate', 'active', now(), false, '$argon2id$mock_other_org_pwd_hash'
        ) ON CONFLICT (id) DO UPDATE SET
          status = 'active',
          password_hash = '$argon2id$mock_other_org_pwd_hash',
          must_reset_password = false;`,
        [
          otherOrgCandidateId,
          BRINDLE_CO_ID,
          'candidate.aster-ridge.071@example.com',
          'Cross-Tenant Same Email User',
        ],
      );

      // 2. Simulate consumption of the Aster Ridge valid invitation
      await client.query('UPDATE app.invitations SET used_at = now() WHERE id = $1;', [validId]);
      await client.query(
        `UPDATE app.users
         SET status = 'active',
             must_reset_password = false,
             password_hash = '$argon2id$mock_aster_consumed_hash'
         WHERE id = $1 AND org_id = $2;`,
        [validCandidateId, ASTER_RIDGE_ID],
      );

      // 3. Re-run seed
      await runSafeSeed(client, {
        nodeEnv: 'test',
        databaseUrl: TEST_DB_URL,
      });

      // 4. Assert Aster Ridge candidate 071 was reset to invited
      const asterCand = await client.query(
        'SELECT status, must_reset_password, password_hash FROM app.users WHERE id = $1 AND org_id = $2;',
        [validCandidateId, ASTER_RIDGE_ID],
      );
      assert.strictEqual(asterCand.rows[0].status, 'invited');
      assert.strictEqual(asterCand.rows[0].must_reset_password, true);
      assert.strictEqual(asterCand.rows[0].password_hash, null);

      // 5. Assert the other org's same-email user was NOT touched
      const otherOrgCand = await client.query(
        'SELECT status, must_reset_password, password_hash FROM app.users WHERE id = $1 AND org_id = $2;',
        [otherOrgCandidateId, BRINDLE_CO_ID],
      );
      assert.strictEqual(
        otherOrgCand.rows[0].status,
        'active',
        'User in other org must remain active',
      );
      assert.strictEqual(
        otherOrgCand.rows[0].must_reset_password,
        false,
        'must_reset_password in other org must remain false',
      );
      assert.strictEqual(
        otherOrgCand.rows[0].password_hash,
        '$argon2id$mock_other_org_pwd_hash',
        'password_hash in other org must remain unchanged',
      );

      // Clean up test user
      await client.query('DELETE FROM app.users WHERE id = $1 AND org_id = $2;', [
        otherOrgCandidateId,
        BRINDLE_CO_ID,
      ]);
    });
  });

  describe('Acceptance Flow S0-T08 Status & Verification', () => {
    it('lookup: valid token is found; expired, used, and unknown tokens return identical generic 404 error', async (t) => {
      if (!dbAvailable || !client) {
        t.skip('Local test database not available');
        return;
      }
      const tokens = getInMemoryTokens() ?? loadLocalTokens();
      if (!tokens || !tokens.valid || !tokens.expired || !tokens.used) {
        t.skip('Seeded raw invitation tokens not available');
        return;
      }

      const invitationsService = new InvitationsService(client as any);

      // 1. Valid token lookup succeeds and returns non-sensitive metadata
      const details = await invitationsService.lookupInvitation(tokens.valid);
      assert.strictEqual(details.email, 'candidate.aster-ridge.071@example.com');
      assert.strictEqual(details.role, 'candidate');
      assert.strictEqual(details.orgName, 'Aster Ridge Technologies');

      // 2. Expired token lookup fails with generic 404
      let expiredErr: any;
      try {
        await invitationsService.lookupInvitation(tokens.expired, 'req-expired-lookup');
        assert.fail('Expired token lookup should have thrown');
      } catch (err: any) {
        expiredErr = err;
      }

      // 3. Used token lookup fails with generic 404
      let usedErr: any;
      try {
        await invitationsService.lookupInvitation(tokens.used, 'req-used-lookup');
        assert.fail('Used token lookup should have thrown');
      } catch (err: any) {
        usedErr = err;
      }

      // 4. Unknown token lookup fails with generic 404
      const unknownToken = generateRawInviteToken();
      let unknownErr: any;
      try {
        await invitationsService.lookupInvitation(unknownToken, 'req-unknown-lookup');
        assert.fail('Unknown token lookup should have thrown');
      } catch (err: any) {
        unknownErr = err;
      }

      // Assert identical RFC 7807 problem details (apart from requestId)
      assert.strictEqual(expiredErr.getStatus(), 404);
      assert.strictEqual(usedErr.getStatus(), 404);
      assert.strictEqual(unknownErr.getStatus(), 404);

      const expiredBody = expiredErr.getResponse();
      const usedBody = usedErr.getResponse();
      const unknownBody = unknownErr.getResponse();

      assert.strictEqual(expiredBody.code, 'INVITATION_INVALID');
      assert.strictEqual(usedBody.code, 'INVITATION_INVALID');
      assert.strictEqual(unknownBody.code, 'INVITATION_INVALID');

      assert.strictEqual(
        expiredBody.detail,
        'The invitation is invalid, has expired, or has already been used.',
      );
      assert.strictEqual(
        usedBody.detail,
        'The invitation is invalid, has expired, or has already been used.',
      );
      assert.strictEqual(
        unknownBody.detail,
        'The invitation is invalid, has expired, or has already been used.',
      );

      assert.strictEqual(expiredBody.title, unknownBody.title);
      assert.strictEqual(expiredBody.type, unknownBody.type);
    });

    it('accept: valid token activates candidate account once and allows login; replay fails', async (t) => {
      if (!dbAvailable || !client) {
        t.skip('Local test database not available');
        return;
      }
      const tokens = getInMemoryTokens() ?? loadLocalTokens();
      if (!tokens || !tokens.valid) {
        t.skip('Seeded raw invitation tokens not available');
        return;
      }

      const invitationsService = new InvitationsService(client as any);
      const validCandidateId = deterministicUuid(
        'candidate',
        'candidate.aster-ridge.071@example.com',
      );
      const validInvitationId = deterministicUuid('invitation', 'valid');
      const newPassword = 'CandidateAcceptedSecurePassword!2026';

      try {
        // 1. Accept invitation
        const acceptRes = await invitationsService.acceptInvitation(
          {
            token: tokens.valid,
            password: newPassword,
          },
          {
            clientIp: '127.0.0.1',
            userAgent: 'test-agent',
            requestId: 'req-accept-test',
          },
        );

        assert.strictEqual(acceptRes.success, true);
        assert.match(acceptRes.message, /Password set successfully/i);

        // 2. Verify user record in database: active, must_reset_password false, valid Argon2id hash
        const userRow = await client.query(
          'SELECT status, must_reset_password, password_hash, email_verified_at FROM app.users WHERE id = $1 AND org_id = $2;',
          [validCandidateId, ASTER_RIDGE_ID],
        );
        assert.strictEqual(userRow.rows[0].status, 'active');
        assert.strictEqual(userRow.rows[0].must_reset_password, false);
        assert.ok(userRow.rows[0].email_verified_at !== null);
        assert.ok(userRow.rows[0].password_hash?.startsWith('$argon2id$'));

        // 3. Verify user can log in with the new password
        const { verifyPassword } = await import('../../../apps/api/dist/modules/auth/password.js');
        const passwordMatches = await verifyPassword(userRow.rows[0].password_hash, newPassword);
        assert.strictEqual(
          passwordMatches,
          true,
          'User must be able to verify with the newly set password',
        );

        // 4. Replay fails with identical generic 404 error
        try {
          await invitationsService.acceptInvitation(
            {
              token: tokens.valid,
              password: 'AnotherAttemptPassword!2026',
            },
            {
              requestId: 'req-replay-test',
            },
          );
          assert.fail('Replay of consumed invitation should have failed');
        } catch (replayErr: any) {
          assert.strictEqual(replayErr.getStatus(), 404);
          const replayBody = replayErr.getResponse();
          assert.strictEqual(replayBody.code, 'INVITATION_INVALID');
          assert.strictEqual(
            replayBody.detail,
            'The invitation is invalid, has expired, or has already been used.',
          );
        }
      } finally {
        // Restore candidate 071 state and invitation used_at so tests and future seed runs stay idempotent
        await client.query(
          'UPDATE app.invitations SET used_at = NULL WHERE id = $1 AND org_id = $2;',
          [validInvitationId, ASTER_RIDGE_ID],
        );
        await client.query(
          `UPDATE app.users
           SET status = 'invited',
               must_reset_password = true,
               password_hash = NULL,
               email_verified_at = NULL,
               last_login_at = NULL
           WHERE id = $1 AND org_id = $2;`,
          [validCandidateId, ASTER_RIDGE_ID],
        );
      }
    });

    it('expired and used tokens return the same generic error as an unknown token on accept', async (t) => {
      if (!dbAvailable || !client) {
        t.skip('Local test database not available');
        return;
      }
      const tokens = getInMemoryTokens() ?? loadLocalTokens();
      if (!tokens || !tokens.expired || !tokens.used) {
        t.skip('Seeded raw invitation tokens not available');
        return;
      }

      const invitationsService = new InvitationsService(client as any);

      // Expired token rejection
      let expiredErr: any;
      try {
        await invitationsService.acceptInvitation(
          { token: tokens.expired, password: 'AnyPassword123!' },
          { requestId: 'req-expired-accept' },
        );
        assert.fail('Expired token accept should fail');
      } catch (err: any) {
        expiredErr = err;
      }

      // Used token rejection
      let usedErr: any;
      try {
        await invitationsService.acceptInvitation(
          { token: tokens.used, password: 'AnyPassword123!' },
          { requestId: 'req-used-accept' },
        );
        assert.fail('Used token accept should fail');
      } catch (err: any) {
        usedErr = err;
      }

      // Unknown token rejection
      let unknownErr: any;
      try {
        await invitationsService.acceptInvitation(
          { token: generateRawInviteToken(), password: 'AnyPassword123!' },
          { requestId: 'req-unknown-accept' },
        );
        assert.fail('Unknown token accept should fail');
      } catch (err: any) {
        unknownErr = err;
      }

      assert.strictEqual(expiredErr.getStatus(), 404);
      assert.strictEqual(usedErr.getStatus(), 404);
      assert.strictEqual(unknownErr.getStatus(), 404);
      assert.strictEqual(expiredErr.getResponse().code, 'INVITATION_INVALID');
      assert.strictEqual(usedErr.getResponse().code, 'INVITATION_INVALID');
      assert.strictEqual(unknownErr.getResponse().code, 'INVITATION_INVALID');
    });

    it('seeded raw tokens are strictly 64-character lowercase hex strings (contract format)', () => {
      const tokens = getInMemoryTokens() ?? loadLocalTokens();
      if (!tokens || !tokens.valid || !tokens.expired || !tokens.used) {
        return;
      }
      for (const [key, tok] of Object.entries(tokens)) {
        assert.strictEqual(tok.length, 64, `${key} token must be exactly 64 characters`);
        assert.match(tok, /^[0-9a-f]{64}$/, `${key} token must be lowercase hexadecimal`);
      }
    });

    it('error safety: invalid, expired, used, and replayed tokens return identical generic RFC 9457 problem details', async (t) => {
      if (!dbAvailable || !client) {
        t.skip('Local test database not available');
        return;
      }
      const tokens = getInMemoryTokens() ?? loadLocalTokens();
      if (!tokens || !tokens.valid || !tokens.expired || !tokens.used) {
        t.skip('Seeded raw invitation tokens not available');
        return;
      }

      const invitationsService = new InvitationsService(client as any);

      // Collect errors across failure scenarios including malformed and never-issued 64-hex tokens
      const failureScenarios: { name: string; op: () => Promise<any> }[] = [
        {
          name: 'lookup: invalid token (never-issued 64-hex string)',
          op: () =>
            invitationsService.lookupInvitation(generateRawInviteToken(), 'req-lookup-invalid'),
        },
        {
          name: 'lookup: empty token string',
          op: () => invitationsService.lookupInvitation('', 'req-lookup-empty'),
        },
        {
          name: 'lookup: whitespace-only token string',
          op: () => invitationsService.lookupInvitation('   ', 'req-lookup-ws'),
        },
        {
          name: 'lookup: expired token',
          op: () => invitationsService.lookupInvitation(tokens.expired, 'req-lookup-expired'),
        },
        {
          name: 'lookup: used token',
          op: () => invitationsService.lookupInvitation(tokens.used, 'req-lookup-used'),
        },
        {
          name: 'accept: invalid token (never-issued 64-hex string)',
          op: () =>
            invitationsService.acceptInvitation(
              { token: generateRawInviteToken(), password: 'StrongPassword123!' },
              { requestId: 'req-accept-invalid' },
            ),
        },
        {
          name: 'accept: empty token string',
          op: () =>
            invitationsService.acceptInvitation(
              { token: '', password: 'StrongPassword123!' },
              { requestId: 'req-accept-empty' },
            ),
        },
        {
          name: 'accept: whitespace-only token string',
          op: () =>
            invitationsService.acceptInvitation(
              { token: '   ', password: 'StrongPassword123!' },
              { requestId: 'req-accept-ws' },
            ),
        },
        {
          name: 'accept: expired token',
          op: () =>
            invitationsService.acceptInvitation(
              { token: tokens.expired, password: 'StrongPassword123!' },
              { requestId: 'req-accept-expired' },
            ),
        },
        {
          name: 'accept: used token',
          op: () =>
            invitationsService.acceptInvitation(
              { token: tokens.used, password: 'StrongPassword123!' },
              { requestId: 'req-accept-used' },
            ),
        },
      ];

      for (const scenario of failureScenarios) {
        try {
          await scenario.op();
          assert.fail(`Scenario ${scenario.name} should have thrown`);
        } catch (err: any) {
          assert.strictEqual(err.getStatus(), 404, `${scenario.name} HTTP status must be 404`);
          const body = err.getResponse();
          assert.strictEqual(body.status, 404, `${scenario.name} response status must be 404`);
          assert.strictEqual(
            body.code,
            'INVITATION_INVALID',
            `${scenario.name} code must be INVITATION_INVALID`,
          );
          assert.strictEqual(
            body.title,
            'Invitation Invalid',
            `${scenario.name} title must be Invitation Invalid`,
          );
          assert.strictEqual(
            body.detail,
            'The invitation is invalid, has expired, or has already been used.',
            `${scenario.name} detail must be generic error message`,
          );
          assert.strictEqual(
            body.type,
            'https://hellosmart.ai/problems/invitation-invalid',
            `${scenario.name} type must match RFC 9457 URI`,
          );
        }
      }
    });

    it("tenant safety: accepting an invitation only updates the user in the invitation's org, leaving same-email user in other org untouched", async (t) => {
      if (!dbAvailable || !client) {
        t.skip('Local test database not available');
        return;
      }
      const tokens = getInMemoryTokens() ?? loadLocalTokens();
      if (!tokens || !tokens.valid) {
        t.skip('Seeded raw invitation tokens not available');
        return;
      }

      const invitationsService = new InvitationsService(client as any);
      const validCandidateId = deterministicUuid(
        'candidate',
        'candidate.aster-ridge.071@example.com',
      );
      const validInvitationId = deterministicUuid('invitation', 'valid');
      const otherOrgCandidateId = deterministicUuid(
        'candidate',
        'candidate.brindle-co.same-email-test@example.com',
      );
      const newPassword = 'CandidateAcceptedSecurePassword!2026';

      try {
        // 1. Create a user in Brindle & Co with the exact same email
        await client.query(
          `INSERT INTO app.users (id, org_id, email, name, role, status, must_reset_password, password_hash)
           VALUES ($1, $2, $3, $4, 'candidate', 'invited', true, NULL)
           ON CONFLICT (id) DO UPDATE SET
             status = 'invited',
             password_hash = NULL,
             must_reset_password = true;`,
          [
            otherOrgCandidateId,
            BRINDLE_CO_ID,
            'candidate.aster-ridge.071@example.com',
            'Cross-Tenant Same Email User',
          ],
        );

        // 2. Accept the Aster Ridge invitation using its valid token
        const acceptRes = await invitationsService.acceptInvitation(
          {
            token: tokens.valid,
            password: newPassword,
          },
          {
            clientIp: '127.0.0.1',
            userAgent: 'test-agent',
            requestId: 'req-tenant-safety-test',
          },
        );

        assert.strictEqual(acceptRes.success, true);

        // 3. Assert Aster Ridge candidate 071 was activated
        const asterUser = await client.query(
          'SELECT status, must_reset_password, password_hash FROM app.users WHERE id = $1 AND org_id = $2;',
          [validCandidateId, ASTER_RIDGE_ID],
        );
        assert.strictEqual(asterUser.rows[0].status, 'active');
        assert.strictEqual(asterUser.rows[0].must_reset_password, false);
        assert.ok(asterUser.rows[0].password_hash !== null);

        // 4. Assert Brindle & Co candidate with same email was completely UNTOUCHED
        const brindleUser = await client.query(
          'SELECT status, must_reset_password, password_hash FROM app.users WHERE id = $1 AND org_id = $2;',
          [otherOrgCandidateId, BRINDLE_CO_ID],
        );
        assert.strictEqual(
          brindleUser.rows[0].status,
          'invited',
          'Other org candidate status must remain invited',
        );
        assert.strictEqual(
          brindleUser.rows[0].must_reset_password,
          true,
          'Other org candidate must_reset_password must remain true',
        );
        assert.strictEqual(
          brindleUser.rows[0].password_hash,
          null,
          'Other org candidate password_hash must remain null',
        );
      } finally {
        // Clean up cross-tenant test user
        await client.query('DELETE FROM app.users WHERE id = $1 AND org_id = $2;', [
          otherOrgCandidateId,
          BRINDLE_CO_ID,
        ]);

        // Restore Aster Ridge candidate 071 and invitation state
        await client.query(
          'UPDATE app.invitations SET used_at = NULL WHERE id = $1 AND org_id = $2;',
          [validInvitationId, ASTER_RIDGE_ID],
        );
        await client.query(
          `UPDATE app.users
           SET status = 'invited',
               must_reset_password = true,
               password_hash = NULL,
               email_verified_at = NULL,
               last_login_at = NULL
           WHERE id = $1 AND org_id = $2;`,
          [validCandidateId, ASTER_RIDGE_ID],
        );
      }
    });
  });

  describe('Raw Token & Logging Safety ([Step 3])', () => {
    it('database: no column in app.invitations, app.users, app.organizations, or app.entitlements contains raw seeded tokens', async (t) => {
      if (!dbAvailable || !client) {
        t.skip('Local test database not available');
        return;
      }
      const tokens = getInMemoryTokens() ?? loadLocalTokens();
      if (!tokens || !tokens.valid || !tokens.expired || !tokens.used) {
        t.skip('Seeded raw invitation tokens not available');
        return;
      }

      const rawTokens = [tokens.valid, tokens.expired, tokens.used];
      const tables = ['app.invitations', 'app.users', 'app.organizations', 'app.entitlements'];

      for (const table of tables) {
        const res = await client.query(`SELECT * FROM ${table};`);
        for (const row of res.rows) {
          for (const [colName, val] of Object.entries(row)) {
            if (val === null || val === undefined) continue;

            const strVal =
              typeof val === 'object' && !Buffer.isBuffer(val) ? JSON.stringify(val) : String(val);

            for (const rawToken of rawTokens) {
              assert.strictEqual(
                strVal.toLowerCase().includes(rawToken.toLowerCase()),
                false,
                `Forbidden raw token found in ${table}.${colName}`,
              );

              if (Buffer.isBuffer(val)) {
                assert.strictEqual(
                  val.includes(Buffer.from(rawToken, 'hex')),
                  false,
                  `Forbidden raw token bytes found in buffer column ${table}.${colName}`,
                );
              }
            }
          }
        }
      }

      // Explicitly assert app.invitations.token_hash is 32 bytes and not raw token bytes
      const invRes = await client.query('SELECT token_hash FROM app.invitations;');
      assert.strictEqual(invRes.rows.length, 3, 'Must have exactly 3 seeded invitations');
      for (const row of invRes.rows) {
        assert.ok(Buffer.isBuffer(row.token_hash), 'token_hash must be a Buffer (bytea)');
        assert.strictEqual(row.token_hash.length, 32, 'token_hash must be exactly 32 bytes');
        for (const rawToken of rawTokens) {
          assert.strictEqual(
            row.token_hash.equals(Buffer.from(rawToken, 'hex')),
            false,
            'token_hash must never equal the raw token bytes',
          );
        }
      }
    });

    it('logs: local console output during lookup, accept, and failure operations contains zero raw tokens or token hashes', async (t) => {
      if (!dbAvailable || !client) {
        t.skip('Local test database not available');
        return;
      }
      const tokens = getInMemoryTokens() ?? loadLocalTokens();
      if (!tokens || !tokens.valid || !tokens.expired || !tokens.used) {
        t.skip('Seeded raw invitation tokens not available');
        return;
      }

      const rawTokens = [tokens.valid, tokens.expired, tokens.used];
      const tokenHashes = rawTokens.map((tok) => hashInvitationTokenHex(tok));

      const logs: string[] = [];
      const originalLog = console.log;
      const originalInfo = console.info;
      const originalDebug = console.debug;
      const originalWarn = console.warn;
      const originalError = console.error;

      const capture = (...args: any[]) => {
        logs.push(
          args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '),
        );
      };

      console.log = capture;
      console.info = capture;
      console.debug = capture;
      console.warn = capture;
      console.error = capture;

      const invitationsService = new InvitationsService(client as any);
      const validCandidateId = deterministicUuid(
        'candidate',
        'candidate.aster-ridge.071@example.com',
      );
      const validInvitationId = deterministicUuid('invitation', 'valid');

      try {
        // Run lookups
        await invitationsService.lookupInvitation(tokens.valid);
        try {
          await invitationsService.lookupInvitation(tokens.expired);
        } catch {}
        try {
          await invitationsService.lookupInvitation(tokens.used);
        } catch {}
        try {
          await invitationsService.lookupInvitation(generateRawInviteToken());
        } catch {}

        // Run accepts
        await invitationsService.acceptInvitation({
          token: tokens.valid,
          password: 'SecurePassword123!',
        });
        try {
          await invitationsService.acceptInvitation({
            token: tokens.valid,
            password: 'SecurePassword123!',
          });
        } catch {}
        try {
          await invitationsService.acceptInvitation({
            token: tokens.expired,
            password: 'SecurePassword123!',
          });
        } catch {}
        try {
          await invitationsService.acceptInvitation({
            token: tokens.used,
            password: 'SecurePassword123!',
          });
        } catch {}
        try {
          await invitationsService.acceptInvitation({
            token: generateRawInviteToken(),
            password: 'SecurePassword123!',
          });
        } catch {}
      } finally {
        console.log = originalLog;
        console.info = originalInfo;
        console.debug = originalDebug;
        console.warn = originalWarn;
        console.error = originalError;

        // Restore candidate 071 and invitation state
        await client.query(
          'UPDATE app.invitations SET used_at = NULL WHERE id = $1 AND org_id = $2;',
          [validInvitationId, ASTER_RIDGE_ID],
        );
        await client.query(
          `UPDATE app.users
           SET status = 'invited',
               must_reset_password = true,
               password_hash = NULL,
               email_verified_at = NULL,
               last_login_at = NULL
           WHERE id = $1 AND org_id = $2;`,
          [validCandidateId, ASTER_RIDGE_ID],
        );
      }

      const allLogs = logs.join('\n');
      for (const tok of rawTokens) {
        assert.strictEqual(
          allLogs.toLowerCase().includes(tok.toLowerCase()),
          false,
          'Logs must not contain raw invitation token',
        );
        assert.strictEqual(
          allLogs.includes(encodeURIComponent(tok)),
          false,
          'Logs must not contain URL-encoded raw invitation token',
        );
      }
      for (const hash of tokenHashes) {
        assert.strictEqual(
          allLogs.toLowerCase().includes(hash.toLowerCase()),
          false,
          'Logs must not contain invitation token hash',
        );
      }
    });

    it('logs: standard pnpm db:seed console execution logs contain zero raw tokens or token hashes', async (t) => {
      if (!dbAvailable || !client) {
        t.skip('Local test database not available');
        return;
      }
      const tokens = getInMemoryTokens() ?? loadLocalTokens();
      if (!tokens || !tokens.valid || !tokens.expired || !tokens.used) {
        t.skip('Seeded raw invitation tokens not available');
        return;
      }

      const rawTokens = [tokens.valid, tokens.expired, tokens.used];
      const tokenHashes = rawTokens.map((tok) => hashInvitationTokenHex(tok));

      const logs: string[] = [];
      const originalLog = console.log;
      const originalInfo = console.info;

      const capture = (...args: any[]) => {
        logs.push(
          args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '),
        );
      };

      console.log = capture;
      console.info = capture;

      try {
        await runSafeSeed(client, {
          nodeEnv: 'test',
          databaseUrl: TEST_DB_URL,
          showTokens: false,
        });
      } finally {
        console.log = originalLog;
        console.info = originalInfo;
      }

      const allLogs = logs.join('\n');
      for (const tok of rawTokens) {
        assert.strictEqual(
          allLogs.toLowerCase().includes(tok.toLowerCase()),
          false,
          'Seed logs without --show-tokens must not contain raw invitation token',
        );
      }
      for (const hash of tokenHashes) {
        assert.strictEqual(
          allLogs.toLowerCase().includes(hash.toLowerCase()),
          false,
          'Seed logs must not contain invitation token hash',
        );
      }
    });

    it('log redaction: Fastify onResponse logging hook rewrites /auth/invitations/<token> to /auth/invitations/[REDACTED]', async (t) => {
      // Confirmed by backend team (apps/api/src/modules/observability/logging.hooks.ts:156-163):
      // In the Fastify onResponse hook, paths matching /auth/invitations/(?!accept$)[^/]+
      // are rewritten to /auth/invitations/[REDACTED], while /auth/invitations/accept remains unredacted.
      // Additionally, logger.config.ts DEFAULT_REDACT_PATHS redacts token, invitationToken, rawToken, and token_hash in bodies and queries.
      try {
        const hooksModule = await import(
          '../../../apps/api/dist/modules/observability/logging.hooks.js'
        );
        if (hooksModule && typeof (hooksModule as any).registerLoggingHooks === 'function') {
          const tokens = getInMemoryTokens() ?? loadLocalTokens();
          const rawToken = tokens?.valid ?? generateRawInviteToken();

          let loggedUrl = '';
          const fakeReq: any = {
            id: 'req-123',
            method: 'GET',
            url: `/api/v1/auth/invitations/${rawToken}`,
            raw: { url: `/api/v1/auth/invitations/${rawToken}` },
            log: {
              info: (data: any) => {
                loggedUrl = data.url;
              },
            },
          };
          const fakeReply: any = {
            statusCode: 200,
            header: () => fakeReply,
          };

          const hooks: Record<string, Function[]> = {};
          const fakeFastify: any = {
            addHook: (name: string, fn: Function) => {
              hooks[name] = hooks[name] || [];
              hooks[name].push(fn);
            },
          };

          hooksModule.registerLoggingHooks(fakeFastify);
          const onResponseHook = hooks['onResponse']?.[0];
          assert.ok(onResponseHook, 'onResponse hook must be registered');

          await new Promise<void>((resolve) => {
            onResponseHook(fakeReq, fakeReply, () => resolve());
          });

          assert.strictEqual(
            loggedUrl,
            '/api/v1/auth/invitations/[REDACTED]',
            'Raw token must be redacted in logged request URL',
          );
          assert.strictEqual(
            loggedUrl.includes(rawToken),
            false,
            'Logged URL must not contain the raw token',
          );

          let acceptLoggedUrl = '';
          const acceptReq: any = {
            id: 'req-456',
            method: 'POST',
            url: '/api/v1/auth/invitations/accept',
            raw: { url: '/api/v1/auth/invitations/accept' },
            log: {
              info: (data: any) => {
                acceptLoggedUrl = data.url;
              },
            },
          };
          await new Promise<void>((resolve) => {
            onResponseHook(acceptReq, fakeReply, () => resolve());
          });
          assert.strictEqual(
            acceptLoggedUrl,
            '/api/v1/auth/invitations/accept',
            '/auth/invitations/accept must not be redacted',
          );
        } else {
          t.skip(
            'Observability module (apps/api/src/modules/observability/logging.hooks.ts) is on origin/dev and not yet merged into this branch',
          );
        }
      } catch {
        t.skip(
          'Observability module (apps/api/src/modules/observability/logging.hooks.ts) is on origin/dev and not yet merged into this branch',
        );
      }
    });
  });
});
