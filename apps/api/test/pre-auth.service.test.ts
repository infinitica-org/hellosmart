import { describe, expect, it } from 'vitest';
import { PreAuthService, MAX_MFA_ATTEMPTS } from '../src/modules/auth/pre-auth.service.js';

describe('PreAuthService', () => {
  it('burns preAuthToken after MAX_MFA_ATTEMPTS failed MFA tries', async () => {
    const service = new PreAuthService(null);
    const token = await service.issue('11111111-1111-4111-8111-111111111111');

    for (let i = 1; i < MAX_MFA_ATTEMPTS; i += 1) {
      await service.recordFailedAttempt(token);
      expect(await service.get(token)).not.toBeNull();
    }

    try {
      await service.recordFailedAttempt(token);
      throw new Error('expected MFA_LOCKED');
    } catch (err) {
      const body = (err as { getResponse: () => unknown }).getResponse() as { code: string };
      expect(body.code).toBe('MFA_LOCKED');
    }
    expect(await service.get(token)).toBeNull();
  });
});
