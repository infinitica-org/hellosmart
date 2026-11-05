import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluatePassword,
  normalizePassword,
  mapServerError,
  COMMON_PASSWORDS_SET,
} from '../dist/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Shared Password Policy Unit Tests (S0-T17-1)', () => {
  describe('common-passwords.txt verification', () => {
    it('contains at least 10,000 common passwords matching COMMON_PASSWORDS_SET', () => {
      const txtPath = path.resolve(__dirname, '../src/data/common-passwords.txt');
      assert.ok(fs.existsSync(txtPath), 'common-passwords.txt must exist on disk');

      const fileContent = fs.readFileSync(txtPath, 'utf8');
      const lines = fileContent
        .split(/\r?\n/)
        .map((l) => l.trim().toLowerCase())
        .filter((l) => l.length > 0);

      assert.ok(
        lines.length >= 10000,
        `Expected at least 10,000 passwords in common list, found ${lines.length}`,
      );
      assert.ok(COMMON_PASSWORDS_SET.has('password'));
      assert.ok(COMMON_PASSWORDS_SET.has('123456'));
      assert.ok(COMMON_PASSWORDS_SET.has('qwerty'));
      assert.ok(COMMON_PASSWORDS_SET.size >= 10000);
    });
  });

  describe('normalizePassword', () => {
    it('normalizes Unicode with NFKC', () => {
      // Ligature fi (\uFB01) normalizes to 'fi'
      const ligature = '\uFB01refly';
      assert.equal(normalizePassword(ligature), 'firefly');

      // Full-width latin characters normalize to standard ASCII
      const fullwidth = '\uFF30\uFF41\uFF53\uFF53\uFF57\uFF4F\uFF52\uFF44'; // 'Ｐａｓｓｗｏｒｄ'
      assert.equal(normalizePassword(fullwidth), 'Password');
    });

    it('safely handles non-string and empty inputs', () => {
      assert.equal(normalizePassword(''), '');
      // @ts-expect-error test invalid types
      assert.equal(normalizePassword(null), '');
    });
  });

  describe('Length boundaries & role sensitivity', () => {
    it('rejects passwords shorter than 12 characters for regular users', () => {
      const res = evaluatePassword('Short12345!', { role: 'candidate' });
      assert.equal(res.ok, false);
      assert.ok(res.reasons.includes('too_short'));
      assert.equal(res.requirements.hasMinLength, false);
    });

    it('accepts 12-character strong passwords for regular users', () => {
      // 12-character strong passphrase with spaces and non-common words
      const res = evaluatePassword('coral ocean 9', { role: 'company_admin' });
      assert.ok(!res.reasons.includes('too_short'));
    });

    it('enforces 14-character minimum length for platform_admin', () => {
      // 13 characters: passes for regular, fails for platform_admin
      const pwd13 = 'galaxy cobalt';
      const regularRes = evaluatePassword(pwd13, { role: 'candidate' });
      assert.ok(!regularRes.reasons.includes('too_short'));

      const adminRes = evaluatePassword(pwd13, { role: 'platform_admin' });
      assert.equal(adminRes.ok, false);
      assert.ok(adminRes.reasons.includes('too_short'));
      assert.equal(adminRes.requirements.hasMinLength, false);
    });

    it('accepts 14+ characters for platform_admin', () => {
      const pwd14 = 'galaxy cobalt 7';
      const adminRes = evaluatePassword(pwd14, { role: 'platform_admin' });
      assert.ok(!adminRes.reasons.includes('too_short'));
    });

    it('rejects passwords exceeding 128 characters', () => {
      const tooLong = 'a'.repeat(129);
      const res = evaluatePassword(tooLong);
      assert.equal(res.ok, false);
      assert.ok(res.reasons.includes('too_long'));
    });

    it('accurately counts Unicode code points for length', () => {
      // Emojis consist of multiple UTF-16 code units (surrogate pairs)
      // "🚀" is 1 codepoint, but 2 UTF-16 code units
      const emojiPassphrase = '🚀'.repeat(12);
      assert.equal(Array.from(emojiPassphrase).length, 12);
      const res = evaluatePassword(emojiPassphrase);
      assert.ok(!res.reasons.includes('too_short'));
    });
  });

  describe('Common password rejection', () => {
    it('rejects passwords present in the top 10,000 common passwords corpus', () => {
      // 'unbelievable' is 12 chars and in the 10k common passwords list
      const common12 = 'unbelievable';
      const res12 = evaluatePassword(common12);
      assert.equal(res12.ok, false);
      assert.ok(res12.reasons.includes('common'));
      assert.equal(res12.requirements.isNotCommon, false);

      // 'password' is in the common list (triggers both common and too_short)
      const resShort = evaluatePassword('password');
      assert.equal(resShort.ok, false);
      assert.ok(resShort.reasons.includes('common'));
      assert.ok(resShort.reasons.includes('too_short'));
    });
  });

  describe('Personal and organization information containment', () => {
    const context = {
      email: 'alex.rivera@acmebiotech.com',
      name: 'Alex Rivera',
      companyName: 'Acme Biotech Inc',
    };

    it('rejects passwords containing email username or subparts', () => {
      const res1 = evaluatePassword('super-alex.rivera-key', context);
      assert.equal(res1.ok, false);
      assert.ok(res1.reasons.includes('contains_user_info'));

      const res2 = evaluatePassword('rivera-secure-vault-99', context);
      assert.equal(res2.ok, false);
      assert.ok(res2.reasons.includes('contains_user_info'));
    });

    it('rejects passwords containing user full name or tokens', () => {
      const res = evaluatePassword('my-Alex-vault-phrase-77', context);
      assert.equal(res.ok, false);
      assert.ok(res.reasons.includes('contains_user_info'));
      assert.equal(res.requirements.isNotRelated, false);
    });

    it('rejects passwords containing organization / company name', () => {
      const res = evaluatePassword('welcome-to-Acme-portal-99', context);
      assert.equal(res.ok, false);
      assert.ok(res.reasons.includes('contains_user_info'));
    });

    it('always rejects passwords containing "hellosmart"', () => {
      const res = evaluatePassword('welcome-to-hellosmart-2026', { email: 'user@example.com' });
      assert.equal(res.ok, false);
      assert.ok(res.reasons.includes('contains_user_info'));
    });

    it('does not reject harmless short character sequences (<3 chars)', () => {
      // User with short name like "Al" should not cause false positive on "valley"
      const shortContext = { email: 'al@company.com', name: 'Al' };
      const res = evaluatePassword('valley cobalt canyon 88', shortContext);
      assert.ok(!res.reasons.includes('contains_user_info'));
    });
  });

  describe('zxcvbn entropy scoring', () => {
    it('rejects passwords with score below 3', () => {
      // 12-char repeated characters have score 0 or 1
      const weak12 = 'aaaaaaaaaaaa';
      const res = evaluatePassword(weak12);
      assert.equal(res.ok, false);
      assert.ok(res.score < 3);
      assert.ok(res.reasons.includes('weak'));
    });

    it('accepts strong multi-word passphrases with score >= 3', () => {
      const strongPassphrase = 'correct horse battery staple 99!';
      const res = evaluatePassword(strongPassphrase);
      assert.equal(res.ok, true);
      assert.ok(res.score >= 3);
      assert.deepEqual(res.reasons, []);
      assert.equal(res.isValid, true);
    });
  });

  describe('Printable characters and spaces (no arbitrary rules)', () => {
    it('accepts spaces without requiring arbitrary numbers or symbols', () => {
      // Pure words and spaces with sufficient length and entropy
      const passphrase = 'thunder whispers through silent valleys';
      const res = evaluatePassword(passphrase);
      assert.equal(res.ok, true);
      assert.ok(res.score >= 3);
      assert.deepEqual(res.reasons, []);
    });
  });

  describe('mapServerError', () => {
    it('maps known reason codes to human friendly messages', () => {
      assert.equal(
        mapServerError('breached'),
        'This password was found in a known data breach. For your safety, choose a different one.',
      );
      assert.equal(
        mapServerError('reused'),
        'You cannot reuse a recent password. Please choose a new one.',
      );
      assert.equal(
        mapServerError('common'),
        'This password is too common and easily guessed. Please choose a more unique phrase.',
      );
    });

    it('returns null for empty codes and raw string for unknown codes', () => {
      assert.equal(mapServerError(null), null);
      assert.equal(mapServerError('custom_err'), 'custom_err');
    });
  });
});
