import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword, verifyWithDummyTiming } from '../src/modules/auth/password.js';

describe('password helpers', () => {
  it('hashes and verifies passwords', async () => {
    const hash = await hashPassword('ChangeMe-Dev-Only-1');
    expect(await verifyPassword(hash, 'ChangeMe-Dev-Only-1')).toBe(true);
    expect(await verifyPassword(hash, 'wrong')).toBe(false);
  });

  it('dummy timing path always returns false', async () => {
    expect(await verifyWithDummyTiming('any-password')).toBe(false);
  });
});
