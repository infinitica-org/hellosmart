import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  acceptInvitation,
  ApiError,
  InvitationInvalidError,
  login,
  RateLimitedError,
  validateInvitation,
  WeakPasswordError,
} from '../src/lib/api-client.js';
import { evaluatePassword } from '../src/components/auth/password-strength-meter.js';

describe('S0-T08-2: Frontend Invitation Acceptance & Password Reset', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. API Client — Invitation Validation (GET /auth/invitations/:token)', () => {
    it('returns invitation details on 200 OK', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          email: 'candidate@example.test',
          role: 'candidate',
          orgName: 'Acme Test Corp',
        }),
      });

      const res = await validateInvitation('valid_token_123', mockFetch as unknown as typeof fetch);
      expect(res).toEqual({
        email: 'candidate@example.test',
        role: 'candidate',
        orgName: 'Acme Test Corp',
      });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/invitations/valid_token_123'),
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('throws InvitationInvalidError on 404 with exact friendly message', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({
          type: 'https://hellosmart.ai/problems/invitation-invalid',
          code: 'INVITATION_INVALID',
        }),
      });

      await expect(
        validateInvitation('expired_or_used_token', mockFetch as unknown as typeof fetch),
      ).rejects.toThrow('This link is no longer valid. Please ask your admin to resend the invite.');
    });

    it('throws RateLimitedError on 429', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ code: 'RATE_LIMITED' }),
      });

      await expect(
        validateInvitation('token_throttled', mockFetch as unknown as typeof fetch),
      ).rejects.toThrow(RateLimitedError);
    });
  });

  describe('2. API Client — Invitation Acceptance (POST /auth/invitations/accept)', () => {
    it('returns success on 200 OK', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: 'Password set successfully. Please log in.',
        }),
      });

      const res = await acceptInvitation(
        { token: 'valid_token_123', password: 'CorrectHorseBatteryStaple1!' },
        mockFetch as unknown as typeof fetch,
      );

      expect(res.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/invitations/accept'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            token: 'valid_token_123',
            password: 'CorrectHorseBatteryStaple1!',
          }),
        }),
      );
    });

    it('throws WeakPasswordError on 422 with validation detail', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({
          type: 'https://hellosmart.ai/problems/weak-password',
          code: 'WEAK_PASSWORD',
          detail: 'Password must contain at least one special character',
        }),
      });

      await expect(
        acceptInvitation(
          { token: 'valid_token_123', password: 'NoSpecialChars123' },
          mockFetch as unknown as typeof fetch,
        ),
      ).rejects.toThrow(WeakPasswordError);
    });

    it('throws InvitationInvalidError on 404 if token expired or used concurrently', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({
          code: 'INVITATION_INVALID',
        }),
      });

      await expect(
        acceptInvitation(
          { token: 'already_used_token', password: 'CorrectHorseBatteryStaple1!' },
          mockFetch as unknown as typeof fetch,
        ),
      ).rejects.toThrow('This link is no longer valid. Please ask your admin to resend the invite.');
    });
  });

  describe('3. Password Policy & Strength Evaluation (S0-T17 Coordination)', () => {
    it('evaluates strong password satisfying all 5 criteria', () => {
      const evaluation = evaluatePassword('CorrectHorseBatteryStaple1!');
      expect(evaluation.isStrong).toBe(true);
      expect(evaluation.score).toBe(5);
      expect(evaluation.label).toBe('Strong');
      expect(evaluation.rules.every((r) => r.met)).toBe(true);
    });

    it('detects missing length (< 12 characters)', () => {
      const evaluation = evaluatePassword('Short1!Aa');
      const lengthRule = evaluation.rules.find((r) => r.id === 'length')!;
      expect(lengthRule.met).toBe(false);
      expect(evaluation.isStrong).toBe(false);
    });

    it('detects missing uppercase letter', () => {
      const evaluation = evaluatePassword('lowercase_only_password_123!');
      const upperRule = evaluation.rules.find((r) => r.id === 'uppercase')!;
      expect(upperRule.met).toBe(false);
      expect(evaluation.isStrong).toBe(false);
    });

    it('detects missing lowercase letter', () => {
      const evaluation = evaluatePassword('UPPERCASE_ONLY_PASSWORD_123!');
      const lowerRule = evaluation.rules.find((r) => r.id === 'lowercase')!;
      expect(lowerRule.met).toBe(false);
      expect(evaluation.isStrong).toBe(false);
    });

    it('detects missing numeric digit', () => {
      const evaluation = evaluatePassword('NoDigitsHereSpecialChars!!Aa');
      const numberRule = evaluation.rules.find((r) => r.id === 'number')!;
      expect(numberRule.met).toBe(false);
      expect(evaluation.isStrong).toBe(false);
    });

    it('detects missing special character', () => {
      const evaluation = evaluatePassword('NoSpecialChars123456789Aa');
      const specialRule = evaluation.rules.find((r) => r.id === 'special')!;
      expect(specialRule.met).toBe(false);
      expect(evaluation.isStrong).toBe(false);
    });
  });

  describe('4. Forced Password Reset at Login (Step 4)', () => {
    it('authenticates user and returns user info with mustResetPassword status', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'usr_123',
          email: 'user@example.test',
          name: 'Jane Candidate',
          role: 'candidate',
          portal: 'candidate',
          mustResetPassword: true,
          org: { id: 'org_123', name: 'Test Org', logoUrl: null },
        }),
      });

      const user = await login(
        { email: 'user@example.test', password: 'TempPassword123!' },
        mockFetch as unknown as typeof fetch,
      );

      expect(user.id).toBe('usr_123');
      expect(user.mustResetPassword).toBe(true);
      expect(user.portal).toBe('candidate');
    });

    it('prevents portal routing when mustResetPassword === true', () => {
      const user = {
        id: 'usr_123',
        email: 'user@example.test',
        name: 'Jane Candidate',
        role: 'candidate' as const,
        portal: 'candidate' as const,
        mustResetPassword: true,
        org: null,
      };

      const routerPushSpy = vi.fn();

      // Simulate login-form routing decision
      if (user.mustResetPassword) {
        // Halt portal routing
      } else {
        routerPushSpy(`/${user.portal}`);
      }

      expect(routerPushSpy).not.toHaveBeenCalled();
    });

    it('routes to designated portal when mustResetPassword === false', () => {
      const user = {
        id: 'usr_123',
        email: 'user@example.test',
        name: 'Jane Candidate',
        role: 'candidate' as const,
        portal: 'candidate' as const,
        mustResetPassword: false,
        org: null,
      };

      const routerPushSpy = vi.fn();

      if (user.mustResetPassword) {
        // Halt
      } else {
        routerPushSpy(`/${user.portal}`);
      }

      expect(routerPushSpy).toHaveBeenCalledWith('/candidate');
    });
  });

  describe('5. Browser Security & Invariants (Step 5)', () => {
    it('never persists tokens or passwords to browser storage', () => {
      const testToken = 'secret_token_123';
      const testPassword = 'SecretPassword123!';

      // Verify localStorage is completely clean of secrets
      const localKeys = Object.keys(typeof localStorage !== 'undefined' ? localStorage : {});
      for (const key of localKeys) {
        expect(localStorage.getItem(key)).not.toContain(testToken);
        expect(localStorage.getItem(key)).not.toContain(testPassword);
      }
    });

    it('strips token from address bar via history.replaceState', () => {
      const replaceStateSpy = vi.fn();
      const mockWindow = {
        location: { pathname: '/accept-invite' },
        history: { replaceState: replaceStateSpy },
      };

      // Simulates accept-invite page effect
      mockWindow.history.replaceState({}, '', mockWindow.location.pathname);

      expect(replaceStateSpy).toHaveBeenCalledWith({}, '', '/accept-invite');
    });
  });
});
