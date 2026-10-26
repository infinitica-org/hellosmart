import { describe, it, expect } from 'vitest';
import { MfaService } from '../src/modules/auth/mfa.service.js';

describe('MfaService: RFC 6238 TOTP Implementation', () => {
  const mfaService = new MfaService();
  const testSecretBase32 = 'JBSWY3DPEHPK3PXP'; // Base32 representation of 'Hello!\xde\xad\xbe\xef'

  it('decodes valid RFC 4648 Base32 strings', () => {
    const decoded = mfaService.decodeBase32('JBSWY3DPEHPK3PXP');
    expect(decoded.length).toBe(10);
  });

  it('throws on invalid Base32 characters (fails closed)', () => {
    expect(() => mfaService.decodeBase32('INVALID-89!')).toThrow('Invalid Base32 character');
    expect(() => mfaService.decodeBase32('')).toThrow('Base32 secret is empty');
  });

  it('generates 6-digit numeric TOTP code', () => {
    const code = mfaService.generateTotp(testSecretBase32);
    expect(code).toMatch(/^[0-9]{6}$/);
  });

  it('verifies genuine TOTP code within standard time step', () => {
    const code = mfaService.generateTotp(testSecretBase32);
    expect(mfaService.verifyTotp(code, testSecretBase32)).toBe(true);
  });

  it('tolerates +/- 30s clock drift window', () => {
    const driftPastCode = mfaService.generateTotp(testSecretBase32, 30, -30);
    const driftFutureCode = mfaService.generateTotp(testSecretBase32, 30, 30);
    expect(mfaService.verifyTotp(driftPastCode, testSecretBase32)).toBe(true);
    expect(mfaService.verifyTotp(driftFutureCode, testSecretBase32)).toBe(true);

    // Beyond 30s drift (+/- 60s) is rejected
    const tooOldCode = mfaService.generateTotp(testSecretBase32, 30, -65);
    // Unless by coincidence it matches current window, it should be rejected
    const currentCode = mfaService.generateTotp(testSecretBase32, 30, 0);
    if (tooOldCode !== currentCode) {
      expect(mfaService.verifyTotp(tooOldCode, testSecretBase32)).toBe(false);
    }
  });

  it('rejects invalid or hardcoded codes', () => {
    const currentCode = mfaService.generateTotp(testSecretBase32);
    const hardcoded = currentCode === '123456' ? '000000' : '123456';
    expect(mfaService.verifyTotp(hardcoded, testSecretBase32)).toBe(false);
    expect(mfaService.verifyTotp('abcdef', testSecretBase32)).toBe(false);
    expect(mfaService.verifyTotp('', testSecretBase32)).toBe(false);
    expect(mfaService.verifyTotp('12345', testSecretBase32)).toBe(false);
    expect(mfaService.verifyTotp('1234567', testSecretBase32)).toBe(false);
  });

  it('rejects verification if secret is corrupt or invalid base32', () => {
    expect(mfaService.verifyTotp('123456', 'corrupt-secret-89')).toBe(false);
  });
});
