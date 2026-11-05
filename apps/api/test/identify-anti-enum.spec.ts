import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../src/modules/auth/auth.service.js';

describe('POST /auth/identify anti-enumeration', () => {
  it('returns a constant shape for any email and never looks up the user', async () => {
    const auth = Object.create(AuthService.prototype) as AuthService;
    const spy = vi.fn();
    (auth as unknown as { findUserByEmail: typeof spy }).findUserByEmail = spy;

    await expect(auth.identifyLoginEmail('known@example.test')).resolves.toEqual({
      recognized: true,
    });
    await expect(auth.identifyLoginEmail('unknown@example.test')).resolves.toEqual({
      recognized: true,
    });
    expect(spy).not.toHaveBeenCalled();
  });
});
