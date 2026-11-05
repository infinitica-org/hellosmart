import { HttpException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { LoginLockoutService } from '../src/modules/auth/login-lockout.service.js';

function expectLocked(err: unknown): void {
  expect(err).toBeInstanceOf(HttpException);
  const body = (err as HttpException).getResponse() as { code?: string };
  expect(body.code).toBe('LOGIN_LOCKED');
}

describe('LoginLockoutService', () => {
  it('locks an email+ip pair after 5 failures without locking another IP', async () => {
    const lockout = new LoginLockoutService(null);
    const email = 'admin@example.test';
    for (let i = 0; i < 5; i += 1) {
      await lockout.recordFailure(email, '1.1.1.1');
    }
    try {
      await lockout.assertNotLocked(email, '1.1.1.1');
      expect.unreachable('expected lockout');
    } catch (err) {
      expectLocked(err);
    }
    await expect(lockout.assertNotLocked(email, '8.8.8.8')).resolves.toBeUndefined();
    await lockout.clearFailures(email, '1.1.1.1');
    await expect(lockout.assertNotLocked(email, '1.1.1.1')).resolves.toBeUndefined();
  });

  it('locks the email globally after 20 failures across IPs', async () => {
    const lockout = new LoginLockoutService(null);
    const email = 'wide@example.test';
    for (let i = 0; i < 20; i += 1) {
      await lockout.recordFailure(email, `10.0.0.${i}`);
    }
    try {
      await lockout.assertNotLocked(email, '1.2.3.4');
      expect.unreachable('expected lockout');
    } catch (err) {
      expectLocked(err);
    }
  });
});
