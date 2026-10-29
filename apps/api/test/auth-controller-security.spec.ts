import { describe, it, expect } from 'vitest';
import { AuthController } from '../src/modules/auth/auth.controller.js';

describe('AuthController Security & Throttling Verification (S0-T14-1)', () => {
  it('does NOT have class-level SkipThrottle on AuthController', () => {
    const classKeys = Reflect.getMetadataKeys(AuthController);
    // When @SkipThrottle() is present, it sets 'THROTTLER:SKIPdefault' or 'THROTTLER:SKIP'
    const hasSkip = classKeys.some((k: string) => String(k).includes('SKIP'));
    expect(hasSkip).toBe(false);
  });

  it('configures strict 5 rpm rate limit on login endpoint', () => {
    const method = AuthController.prototype.login;
    const limit = Reflect.getMetadata('THROTTLER:LIMITlogin', method);
    const ttl = Reflect.getMetadata('THROTTLER:TTLlogin', method);
    expect(limit).toBe(5);
    expect(ttl).toBe(60_000);
  });

  it('configures strict 5 rpm rate limit on mfa/verify endpoint', () => {
    const method = AuthController.prototype.mfaVerify;
    const limit = Reflect.getMetadata('THROTTLER:LIMITlogin', method);
    const ttl = Reflect.getMetadata('THROTTLER:TTLlogin', method);
    expect(limit).toBe(5);
    expect(ttl).toBe(60_000);
  });
});

