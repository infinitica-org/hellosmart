import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { runSafeSeed, ensureInvitationsTable } from '../dist/lib/upsert.js';
import {
  INVITE_TTL_HOURS,
  DEV_INVITE_TOKEN_VALID,
  DEV_INVITE_TOKEN_EXPIRED,
  DEV_INVITE_TOKEN_USED,
  hashInvitationToken,
  getInvitations,
  getInvitationToken,
  getInvitationLink,
  validateInvitation,
  type InvitationLabel,
} from '../dist/entities/invitations.js';
import { deterministicUuid } from '../dist/lib/keys.js';
import { ASTER_RIDGE_ID } from '../dist/entities/organizations.js';

function resolveTestDbUrl(): string {
  if (process.env.TEST_DATABASE_URL) {
    return process.env.TEST_DATABASE_URL;
  }
  return 'postgres://hs_migrator:hs_migrator_local@localhost:5434/hellosmart_test';
}

describe('Candidate Invitation Tokens & First-Login Password Reset Fixtures ([6.3])', () => {
  const TEST_DB_URL = resolveTestDbUrl();
  let client: pg.Client | null = null;
  let dbAvailable = false;

  before(async () => {
    try {
      client = new pg.Client({ connectionString: TEST_DB_URL });
      client.on('error', () => {});
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

  describe('Entity Definitions & Timing Invariants', () => {
    it('TTL is configured as exactly 72 hours (INVITE_TTL_HOURS = 72)', () => {
      assert.strictEqual(INVITE_TTL_HOURS, 72);
    });

    it('generates exactly 3 invitation records (valid, expired, used) with relative timestamps', () => {
      const refDate = new Date();
      const invitations = getInvitations(refDate);

      assert.strictEqual(invitations.length, 3);
      const [valid, expired, used] = invitations;

      // 1. Valid invitation
      assert.strictEqual(valid!.org_id, ASTER_RIDGE_ID);
      assert.strictEqual(
        valid!.user_id,
        deterministicUuid('candidate', 'candidate.aster-ridge.071@example.com'),
      );
      assert.strictEqual(valid!.used_at, null);
      assert.strictEqual(valid!.raw_token, DEV_INVITE_TOKEN_VALID);
      assert.strictEqual(valid!.token_hash, hashInvitationToken(DEV_INVITE_TOKEN_VALID));
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
      assert.strictEqual(expired!.raw_token, DEV_INVITE_TOKEN_EXPIRED);
      assert.strictEqual(expired!.token_hash, hashInvitationToken(DEV_INVITE_TOKEN_EXPIRED));
      assert.ok(
        expired!.expires_at.getTime() < refDate.getTime(),
        'Expired token expiration is in past',
      );
      assert.strictEqual(
        refDate.getTime() - expired!.created_at.getTime(),
        100 * 3600 * 1000,
        'Expired token was created 100 hours ago',
      );

      // 3. Used invitation
      assert.strictEqual(used!.org_id, ASTER_RIDGE_ID);
      assert.strictEqual(
        used!.user_id,
        deterministicUuid('candidate', 'candidate.aster-ridge.001@example.com'),
      );
      assert.ok(used!.used_at !== null, 'Used token must have used_at timestamp set');
      assert.strictEqual(used!.raw_token, DEV_INVITE_TOKEN_USED);
      assert.strictEqual(used!.token_hash, hashInvitationToken(DEV_INVITE_TOKEN_USED));
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

    it('hashes tokens via SHA-256 and never matches raw token string', () => {
      const hash = hashInvitationToken(DEV_INVITE_TOKEN_VALID);
      assert.match(hash, /^[0-9a-f]{64}$/);
      assert.notStrictEqual(hash, DEV_INVITE_TOKEN_VALID);
    });
  });

  describe('Helper Functions & Route Generation', () => {
    it('getInvitationToken returns raw token constant for valid, expired, and used labels', () => {
      assert.strictEqual(getInvitationToken('valid'), DEV_INVITE_TOKEN_VALID);
      assert.strictEqual(getInvitationToken('expired'), DEV_INVITE_TOKEN_EXPIRED);
      assert.strictEqual(getInvitationToken('used'), DEV_INVITE_TOKEN_USED);
    });

    it('getInvitationToken throws a descriptive error on unknown label', () => {
      assert.throws(
        () => getInvitationToken('unknown' as InvitationLabel),
        /Unknown invitation label 'unknown'/,
      );
    });

    it('getInvitationLink builds full invite link matching app route', () => {
      const defaultValidLink = getInvitationLink('valid');
      assert.strictEqual(
        defaultValidLink,
        `http://localhost:3000/invite?token=${encodeURIComponent(DEV_INVITE_TOKEN_VALID)}`,
      );

      const customBase = 'https://hire.asterridge.com';
      const customExpiredLink = getInvitationLink('expired', customBase);
      assert.strictEqual(
        customExpiredLink,
        `https://hire.asterridge.com/invite?token=${encodeURIComponent(DEV_INVITE_TOKEN_EXPIRED)}`,
      );

      const customUsedLink = getInvitationLink('used', 'https://hellosmart.ai/');
      assert.strictEqual(
        customUsedLink,
        `https://hellosmart.ai/invite?token=${encodeURIComponent(DEV_INVITE_TOKEN_USED)}`,
      );
    });

    it('getInvitationLink respects APP_BASE_URL environment variable', () => {
      const originalEnv = process.env.APP_BASE_URL;
      try {
        process.env.APP_BASE_URL = 'http://127.0.0.1:4000';
        const link = getInvitationLink('valid');
        assert.strictEqual(
          link,
          `http://127.0.0.1:4000/invite?token=${encodeURIComponent(DEV_INVITE_TOKEN_VALID)}`,
        );
      } finally {
        if (originalEnv !== undefined) {
          process.env.APP_BASE_URL = originalEnv;
        } else {
          delete process.env.APP_BASE_URL;
        }
      }
    });

    it('validateInvitation evaluates validity, expiration, and prior usage accurately', () => {
      const now = new Date();
      const [validFixture, expiredFixture, usedFixture] = getInvitations(now);

      // Valid token passes
      const validResult = validateInvitation(validFixture!, now);
      assert.strictEqual(validResult.valid, true);
      assert.strictEqual(validResult.reason, undefined);

      // Expired token is rejected
      const expiredResult = validateInvitation(expiredFixture!, now);
      assert.strictEqual(expiredResult.valid, false);
      assert.strictEqual(expiredResult.reason, 'expired');

      // Used token is rejected
      const usedResult = validateInvitation(usedFixture!, now);
      assert.strictEqual(usedResult.valid, false);
      assert.strictEqual(usedResult.reason, 'already_used');
    });
  });

  describe('Database Seeding & State Assertions', () => {
    it('After seeding, DB contains exactly one valid, one expired, and one used invitation', async (t) => {
      if (!dbAvailable || !client) {
        return t.skip('Postgres test database not available');
      }

      const seedNow = new Date();
      await runSafeSeed(client, {
        nodeEnv: 'test',
        databaseUrl: TEST_DB_URL,
        referenceDate: seedNow,
      });

      // 1. Total count is exactly 3
      const totalRes = await client.query('SELECT count(*)::int AS count FROM app.invitations;');
      assert.strictEqual(totalRes.rows[0].count, 3);

      // 2. Exactly one valid invitation (expires_at > now AND used_at IS NULL)
      const validRes = await client.query(
        'SELECT * FROM app.invitations WHERE expires_at > now() AND used_at IS NULL;',
      );
      assert.strictEqual(validRes.rows.length, 1);
      const validRow = validRes.rows[0];
      assert.strictEqual(validRow.token_hash, hashInvitationToken(DEV_INVITE_TOKEN_VALID));
      assert.strictEqual(
        validRow.user_id,
        deterministicUuid('candidate', 'candidate.aster-ridge.071@example.com'),
      );

      // Verify linked candidate status is 'invited' and must_reset_password is true
      const candValid = await client.query('SELECT * FROM app.users WHERE id = $1;', [
        validRow.user_id,
      ]);
      assert.strictEqual(candValid.rows[0].status, 'invited');
      assert.strictEqual(candValid.rows[0].must_reset_password, true);

      // 3. Exactly one expired invitation (expires_at < now AND used_at IS NULL)
      const expiredRes = await client.query(
        'SELECT * FROM app.invitations WHERE expires_at < now() AND used_at IS NULL;',
      );
      assert.strictEqual(expiredRes.rows.length, 1);
      const expiredRow = expiredRes.rows[0];
      assert.strictEqual(expiredRow.token_hash, hashInvitationToken(DEV_INVITE_TOKEN_EXPIRED));
      assert.strictEqual(
        expiredRow.user_id,
        deterministicUuid('candidate', 'candidate.aster-ridge.072@example.com'),
      );

      const candExpired = await client.query('SELECT * FROM app.users WHERE id = $1;', [
        expiredRow.user_id,
      ]);
      assert.strictEqual(candExpired.rows[0].status, 'invited');
      assert.strictEqual(candExpired.rows[0].must_reset_password, true);

      // 4. Exactly one used invitation (used_at IS NOT NULL)
      const usedRes = await client.query(
        'SELECT * FROM app.invitations WHERE used_at IS NOT NULL;',
      );
      assert.strictEqual(usedRes.rows.length, 1);
      const usedRow = usedRes.rows[0];
      assert.strictEqual(usedRow.token_hash, hashInvitationToken(DEV_INVITE_TOKEN_USED));
      assert.strictEqual(
        usedRow.user_id,
        deterministicUuid('candidate', 'candidate.aster-ridge.001@example.com'),
      );

      // Verify linked candidate is active and completed onboarding
      const candUsed = await client.query('SELECT * FROM app.users WHERE id = $1;', [
        usedRow.user_id,
      ]);
      assert.strictEqual(candUsed.rows[0].status, 'active');
      assert.strictEqual(candUsed.rows[0].must_reset_password, false);
    });

    it('Seeding twice yields identical invitation row counts and used token remains used', async (t) => {
      if (!dbAvailable || !client) {
        return t.skip('Postgres test database not available');
      }

      // Record pre-rerun state of invitations
      const preInvs = await client.query(
        'SELECT id, user_id, token_hash, expires_at, used_at FROM app.invitations ORDER BY id;',
      );
      assert.strictEqual(preInvs.rows.length, 3);

      const usedPre = preInvs.rows.find((r) => r.used_at !== null);
      assert.ok(usedPre, 'Used invitation row exists');

      // Re-run seed
      await runSafeSeed(client, {
        nodeEnv: 'test',
        databaseUrl: TEST_DB_URL,
      });

      // Assert count is still exactly 3 (0 extra rows)
      const postInvs = await client.query(
        'SELECT id, user_id, token_hash, expires_at, used_at FROM app.invitations ORDER BY id;',
      );
      assert.strictEqual(postInvs.rows.length, 3, 'Must have exactly 3 invitations after re-seed');

      // Assert used token remained used (used_at was NOT overwritten to null)
      const usedPost = postInvs.rows.find((r) => r.id === usedPre.id);
      assert.ok(usedPost, 'Used invitation row still exists');
      assert.ok(usedPost.used_at !== null, 'used_at must not be overwritten to null');
      assert.strictEqual(
        new Date(usedPost.used_at).toISOString(),
        new Date(usedPre.used_at).toISOString(),
        'used_at timestamp must be preserved across seed runs',
      );
    });
  });
});
