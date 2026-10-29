import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkEnvironmentSafety,
  assertEnvironmentSafe,
  LOCAL_ALLOWED_HOSTS,
} from '../dist/lib/guard.js';
import { maskConnectionString, maskSensitiveData, safeStringify } from '../dist/lib/masker.js';

describe('Safety Guard Unit Tests ([6.2])', () => {
  const localUrl = 'postgres://hs_migrator:dev_password@localhost:5432/hellosmart_test';
  const remoteUrl = 'postgres://hs_app:super_secret_pw@db.prod.example.com:5432/hellosmart';
  const lookalikeUrl = 'postgres://user:pw@localhost.evil.com:5432/db';

  it('blocks execution when NODE_ENV is production even with a local URL', () => {
    const res = checkEnvironmentSafety('production', localUrl);
    assert.strictEqual(res.safe, false);
    assert.match(res.error!, /strictly forbidden.*production/i);

    assert.throws(
      () => assertEnvironmentSafe('production', localUrl),
      /strictly forbidden.*production/i,
    );
  });

  it('blocks execution when NODE_ENV is prod (shortened production)', () => {
    const res = checkEnvironmentSafety('prod', localUrl);
    assert.strictEqual(res.safe, false);
    assert.match(res.error!, /strictly forbidden.*prod/i);
  });

  it('blocks execution when NODE_ENV is development with a remote database URL', () => {
    const res = checkEnvironmentSafety('development', remoteUrl);
    assert.strictEqual(res.safe, false);
    assert.strictEqual(res.hostname, 'db.prod.example.com');
    assert.match(res.error!, /non-local/i);

    assert.throws(() => assertEnvironmentSafe('development', remoteUrl), /non-local/i);
  });

  it('blocks execution when NODE_ENV is production AND database is remote (simulated prod)', () => {
    const res = checkEnvironmentSafety('production', remoteUrl);
    assert.strictEqual(res.safe, false);
    assert.match(res.error!, /strictly forbidden/i);
  });

  it('blocks look-alike host spoofing (localhost.evil.com)', () => {
    const res = checkEnvironmentSafety('development', lookalikeUrl);
    assert.strictEqual(res.safe, false);
    assert.strictEqual(res.hostname, 'localhost.evil.com');
    assert.match(res.error!, /localhost\.evil\.com/);
  });

  it('blocks execution when DATABASE_URL is missing, empty, or whitespace', () => {
    assert.strictEqual(checkEnvironmentSafety('development', undefined).safe, false);
    assert.strictEqual(checkEnvironmentSafety('development', '').safe, false);
    assert.strictEqual(checkEnvironmentSafety('development', '   ').safe, false);

    assert.throws(() => assertEnvironmentSafe('development', undefined), /missing or empty/i);
  });

  it('blocks execution when DATABASE_URL is malformed or invalid URL', () => {
    const malformed = 'not-a-valid-connection-string';
    const res = checkEnvironmentSafety('development', malformed);
    assert.strictEqual(res.safe, false);
    assert.match(res.error!, /malformed or unparseable/i);

    assert.throws(
      () => assertEnvironmentSafe('development', malformed),
      /malformed or unparseable/i,
    );
  });

  it('allows execution when NODE_ENV is development with localhost, 127.0.0.1, or ::1', () => {
    const hosts = ['localhost', '127.0.0.1', '::1', 'postgres'];
    for (const host of hosts) {
      const hostPart = host.includes(':') ? `[${host}]` : host;
      const url = `postgres://hs_migrator:localpw@${hostPart}:5432/hellosmart_dev`;
      const res = checkEnvironmentSafety('development', url);
      assert.strictEqual(res.safe, true, `Host ${host} should be safe`);
      assert.doesNotThrow(() => assertEnvironmentSafe('development', url));
    }
  });

  it('ensures error messages never contain database password', () => {
    const sensitiveUrl =
      'postgres://hs_migrator:VERY_SENSITIVE_PASSWORD_123@remote.host.com:5432/db';
    const res = checkEnvironmentSafety('development', sensitiveUrl);
    assert.strictEqual(res.safe, false);
    assert.doesNotMatch(res.error!, /VERY_SENSITIVE_PASSWORD_123/);
    assert.match(res.error!, /remote\.host\.com/);

    try {
      assertEnvironmentSafe('development', sensitiveUrl);
      assert.fail('Should have thrown error');
    } catch (err: any) {
      assert.doesNotMatch(err.message, /VERY_SENSITIVE_PASSWORD_123/);
    }
  });
});

describe('Secret Masking Unit Tests ([6.2])', () => {
  it('masks connection string credentials properly', () => {
    const raw = 'postgres://admin:SuperSecretPassword!@localhost:5432/hellosmart';
    const masked = maskConnectionString(raw);
    assert.strictEqual(masked, 'postgres://admin:***@localhost:5432/hellosmart');
    assert.doesNotMatch(masked, /SuperSecretPassword!/);
  });

  it('redacts sensitive keys including password and hash in nested objects and arrays', () => {
    const sample = {
      username: 'admin@asterridge.com',
      password: 'MockSecretPassword456!',
      password_hash: '$argon2id$v=19$m=19456,t=2,p=1$secretHash',
      token: 'jwt.token.secret',
      api_key: 'sk_live_12345',
      mfa_secret: 'base32secretmfa',
      nested: {
        hash: 'sha256hashvalue',
        connection: 'postgres://user:pw123@localhost:5432/db',
      },
      list: [{ apiKey: 'secret_key_in_list' }, { plainField: 'safeValue' }],
      safeField: 'This is visible',
    };

    const masked = maskSensitiveData(sample);

    assert.strictEqual(masked.password, '***REDACTED***');
    assert.strictEqual(masked.password_hash, '***REDACTED***');
    assert.strictEqual(masked.token, '***REDACTED***');
    assert.strictEqual(masked.api_key, '***REDACTED***');
    assert.strictEqual(masked.mfa_secret, '***REDACTED***');
    assert.strictEqual(masked.nested.hash, '***REDACTED***');
    assert.strictEqual(masked.nested.connection, 'postgres://user:***@localhost:5432/db');
    assert.strictEqual(masked.list[0].apiKey, '***REDACTED***');
    assert.strictEqual(masked.list[1].plainField, 'safeValue');
    assert.strictEqual(masked.safeField, 'This is visible');

    const json = safeStringify(sample);
    assert.doesNotMatch(json, /MockSecretPassword456!/);
    assert.doesNotMatch(json, /secretHash/);
    assert.doesNotMatch(json, /jwt\.token\.secret/);
    assert.doesNotMatch(json, /pw123/);
  });
});
