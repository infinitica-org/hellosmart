import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PasswordPolicyService } from '../src/modules/auth/password-policy.service.js';
import { hashPassword } from '../src/modules/auth/password.js';
import type { Config } from '../src/config/config.js';

describe('PasswordPolicyService (unit)', () => {
  let service: PasswordPolicyService;
  let mockPool: { query: ReturnType<typeof vi.fn> };
  let mockConfig: Config;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    mockPool = {
      query: vi.fn(),
    };
    mockConfig = {
      NODE_ENV: 'test',
      PORT: 4000,
      DATABASE_URL: 'postgres://localhost:5432/test',
      SESSION_SECRET: 'test-session-secret-32-bytes-minimum!!',
      CORS_ORIGINS: ['http://localhost:3000'],
      PAYMENT_GATEWAY: 'fake',
      EMAIL_PROVIDER: 'fake',
      WORKSPACE_RUNTIME: 'fake',
      HIBP_FAIL_OPEN: true,
    };
    service = new PasswordPolicyService(mockPool as any, mockConfig);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('evaluateLocal', () => {
    it('evaluates strong password successfully', () => {
      const result = service.evaluateLocal('K9#mQ!vL2$xP8*zR', {
        role: 'company_admin',
        email: 'user@example.com',
        name: 'Jane Doe',
      });
      expect(result.ok).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(3);
      expect(result.reasons).toHaveLength(0);
    });

    it('rejects passwords shorter than 12 characters for normal users', () => {
      const result = service.evaluateLocal('Short1!Ab', {
        role: 'company_admin',
      });
      expect(result.ok).toBe(false);
      expect(result.reasons).toContain('too_short');
    });

    it('enforces 14 character minimum for platform_admin', () => {
      const result12 = service.evaluateLocal('ValidTwelve1!', {
        role: 'platform_admin',
      });
      expect(result12.ok).toBe(false);
      expect(result12.reasons).toContain('too_short');

      const result14 = service.evaluateLocal('ValidFourteen1!Ab', {
        role: 'platform_admin',
      });
      expect(result14.ok).toBe(true);
    });

    it('rejects passwords containing user info or company name', () => {
      const result = service.evaluateLocal('AsterRidge2026!Secure', {
        role: 'company_admin',
        companyName: 'AsterRidge',
      });
      expect(result.ok).toBe(false);
      expect(result.reasons).toContain('contains_user_info');
    });
  });

  describe('checkBreached (HIBP k-anonymity)', () => {
    it('detects a breached password when suffix matches', async () => {
      // SHA-1 of "password123": CBFDAC6008F9CAB4083784CBD1874F76618D2A97
      // prefix: CBFDA, suffix: C6008F9CAB4083784CBD1874F76618D2A97
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => '0018A44455FF:2\r\nC6008F9CAB4083784CBD1874F76618D2A97:18534\r\nFEEDBEEF:1',
      } as any);

      const res = await service.checkBreached('password123');
      expect(res.breached).toBe(true);
      expect(res.count).toBe(18534);
    });

    it('passes when suffix is not in HIBP response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => '0018A44455FF:2\r\n112233445566:5',
      } as any);

      const res = await service.checkBreached('UniqueUnbreachedP@ssword2026!!');
      expect(res.breached).toBe(false);
    });

    it('fails open when HIBP times out and HIBP_FAIL_OPEN is true', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network timeout'));

      mockConfig.HIBP_FAIL_OPEN = true;
      const res = await service.checkBreached('AnyPassword123!');
      expect(res.breached).toBe(false);
      expect(res.error).toBe('Network timeout');
    });

    it('fails closed when HIBP times out and HIBP_FAIL_OPEN is false', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network timeout'));

      mockConfig.HIBP_FAIL_OPEN = false;
      const res = await service.checkBreached('AnyPassword123!');
      expect(res.breached).toBe(true);
      expect(res.error).toBe('Network timeout');
    });
  });

  describe('checkHistory', () => {
    it('detects reuse when candidate matches current password hash', async () => {
      const currentHash = await hashPassword('CurrentP@ssword123!');
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ password_hash: currentHash }] }) // app.users
        .mockResolvedValueOnce({ rows: [] }); // app.password_history

      const res = await service.checkHistory('user-1', 'CurrentP@ssword123!');
      expect(res.reused).toBe(true);
    });

    it('detects reuse when candidate matches one of last 5 history hashes', async () => {
      const oldHash1 = await hashPassword('OldPassword1!');
      const oldHash2 = await hashPassword('OldPassword2!');
      const currentHash = await hashPassword('CurrentPassword3!');

      mockPool.query
        .mockResolvedValueOnce({ rows: [{ password_hash: currentHash }] })
        .mockResolvedValueOnce({
          rows: [{ password_hash: oldHash2 }, { password_hash: oldHash1 }],
        });

      const res = await service.checkHistory('user-1', 'OldPassword1!');
      expect(res.reused).toBe(true);
    });

    it('allows candidate password that does not match any history hash', async () => {
      const oldHash = await hashPassword('OldPassword1!');
      const currentHash = await hashPassword('CurrentPassword2!');

      mockPool.query
        .mockResolvedValueOnce({ rows: [{ password_hash: currentHash }] })
        .mockResolvedValueOnce({ rows: [{ password_hash: oldHash }] });

      const res = await service.checkHistory('user-1', 'BrandNewUnusedPassword123!');
      expect(res.reused).toBe(false);
    });
  });

  describe('recordPasswordHistory', () => {
    it('inserts new hash and deletes records beyond top 5', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rowCount: 1 }),
      };

      await service.recordPasswordHistory('user-1', 'argon2id-hash', mockClient as any);

      expect(mockClient.query).toHaveBeenCalledTimes(2);
      expect(mockClient.query).toHaveBeenNthCalledWith(
        1,
        'INSERT INTO app.password_history (user_id, password_hash) VALUES ($1, $2)',
        ['user-1', 'argon2id-hash'],
      );
      expect(mockClient.query.mock.calls[1][0]).toContain('DELETE FROM app.password_history');
      expect(mockClient.query.mock.calls[1][0]).toContain('LIMIT 5');
    });
  });
});
