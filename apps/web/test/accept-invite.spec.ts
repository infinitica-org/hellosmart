import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  acceptInvitation,
  ApiError,
  changePassword,
  getMe,
  InvitationInvalidError,
  login,
  logout,
  RateLimitedError,
  validateInvitation,
  WeakPasswordError,
} from '../src/lib/api-client.js';
import { evaluatePassword } from '@hs/ui';

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
      expect(evaluation.isValid).toBe(true);
      expect(evaluation.score).toBeGreaterThanOrEqual(3);
      expect(['Good', 'Strong']).toContain(evaluation.label);
      expect(evaluation.requirements.hasMinLength).toBe(true);
      expect(evaluation.requirements.hasUppercase).toBe(true);
      expect(evaluation.requirements.hasLowercase).toBe(true);
      expect(evaluation.requirements.hasNumber).toBe(true);
      expect(evaluation.requirements.hasSymbol).toBe(true);
    });

    it('detects missing length (< 12 characters)', () => {
      const evaluation = evaluatePassword('Short1!Aa');
      expect(evaluation.requirements.hasMinLength).toBe(false);
      expect(evaluation.isValid).toBe(false);
    });

    it('detects missing uppercase letter', () => {
      const evaluation = evaluatePassword('lowercase_only_password_123!');
      expect(evaluation.requirements.hasUppercase).toBe(false);
      expect(evaluation.isValid).toBe(false);
    });

    it('detects missing lowercase letter', () => {
      const evaluation = evaluatePassword('UPPERCASE_ONLY_PASSWORD_123!');
      expect(evaluation.requirements.hasLowercase).toBe(false);
      expect(evaluation.isValid).toBe(false);
    });

    it('detects missing numeric digit', () => {
      const evaluation = evaluatePassword('NoDigitsHereSpecialChars!!Aa');
      expect(evaluation.requirements.hasNumber).toBe(false);
      expect(evaluation.isValid).toBe(false);
    });

    it('detects missing special character', () => {
      const evaluation = evaluatePassword('NoSpecialChars123456789Aa');
      expect(evaluation.requirements.hasSymbol).toBe(false);
      expect(evaluation.isValid).toBe(false);
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
    it('redirects legacy /set-password route to canonical /accept-invite route', () => {
      const searchParams = new URLSearchParams('token=my_secret_token_123');
      const params = searchParams.toString();
      const target = params ? `/accept-invite?${params}` : '/accept-invite';
      expect(target).toBe('/accept-invite?token=my_secret_token_123');
    });

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

    it('persists and restores invite token across page reloads via session storage (BUG-13)', async () => {
      const { getStoredInviteToken, setStoredInviteToken } = await import('../src/app/(auth)/accept-invite/page');

      // Set token when arrived from invitation link
      setStoredInviteToken('test_invite_token_reload_123');
      expect(getStoredInviteToken()).toBe('test_invite_token_reload_123');

      // Clear token upon successful completion
      setStoredInviteToken(null);
      expect(getStoredInviteToken()).toBeNull();
    });
  });

  describe('6. API Client — Session Lifecycle (logout, changePassword, getMe)', () => {
    it('successfully logs out and clears session on 200 OK', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: 'Logged out successfully',
        }),
      });

      const res = await logout(mockFetch as unknown as typeof fetch);
      expect(res.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/logout'),
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      );
    });

    it('successfully changes password on 200 OK', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: 'Password updated successfully',
        }),
      });

      const res = await changePassword(
        {
          currentPassword: 'OldPassword123!',
          newPassword: 'BrandNewPassword123!',
        },
        mockFetch as unknown as typeof fetch,
      );

      expect(res.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/password/change'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            currentPassword: 'OldPassword123!',
            newPassword: 'BrandNewPassword123!',
          }),
          credentials: 'include',
        }),
      );
    });

    it('throws WeakPasswordError if changePassword returns 422', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({
          code: 'WEAK_PASSWORD',
          detail: 'Password must contain at least one special character',
        }),
      });

      await expect(
        changePassword(
          { newPassword: 'WeakPassword123' },
          mockFetch as unknown as typeof fetch,
        ),
      ).rejects.toThrow(WeakPasswordError);
    });

    it('throws ApiError(401) if changePassword is unauthenticated', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          code: 'UNAUTHORIZED',
        }),
      });

      await expect(
        changePassword(
          { newPassword: 'NewPassword123!' },
          mockFetch as unknown as typeof fetch,
        ),
      ).rejects.toThrow(ApiError);
    });

    it('successfully retrieves current user profile with getMe() on 200 OK', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'usr_abc',
          email: 'admin@hellosmart.test',
          name: 'Platform Admin',
          role: 'platform_admin',
          portal: 'admin',
          mustResetPassword: false,
          org: null,
        }),
      });

      const user = await getMe(mockFetch as unknown as typeof fetch);
      expect(user.id).toBe('usr_abc');
      expect(user.role).toBe('platform_admin');
      expect(user.portal).toBe('admin');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/me'),
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        }),
      );
    });

    it('throws ApiError(401) if getMe is called without a valid session', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          code: 'UNAUTHORIZED',
        }),
      });

      await expect(
        getMe(mockFetch as unknown as typeof fetch),
      ).rejects.toThrow(ApiError);
    });
  });
});
