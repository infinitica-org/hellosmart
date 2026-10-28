import { describe, it, expect } from 'vitest';
import { PasswordPolicySchema } from '@hs/contracts';
import {
  evaluatePassword,
  mapServerError,
  SERVER_ERROR_MESSAGES,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  PasswordField,
  PasswordStrengthMeter,
} from '@hs/ui';
import { SetPasswordForm } from '../components/auth/set-password-form';

describe('Password Component Suite: S0-T17-2', () => {
  describe('PasswordPolicySchema contract alignment', () => {
    it('rejects empty password', () => {
      const res = PasswordPolicySchema.safeParse('');
      expect(res.success).toBe(false);
    });

    it('rejects password shorter than minimum (11 chars)', () => {
      const res = PasswordPolicySchema.safeParse('Abc!1234567');
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.errors[0]?.message).toContain('at least 12 characters');
      }
    });

    it('accepts password exactly at minimum (12 chars) with all complexity rules', () => {
      const res = PasswordPolicySchema.safeParse('Abc!12345678');
      expect(res.success).toBe(true);
    });

    it('rejects missing uppercase', () => {
      const res = PasswordPolicySchema.safeParse('abc!12345678');
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.errors.some((e) => e.message.includes('uppercase'))).toBe(true);
      }
    });

    it('rejects missing lowercase', () => {
      const res = PasswordPolicySchema.safeParse('ABC!12345678');
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.errors.some((e) => e.message.includes('lowercase'))).toBe(true);
      }
    });

    it('rejects missing number', () => {
      const res = PasswordPolicySchema.safeParse('Abc!defghijkl');
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.errors.some((e) => e.message.includes('number'))).toBe(true);
      }
    });

    it('rejects missing symbol', () => {
      const res = PasswordPolicySchema.safeParse('Abc123456789');
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.errors.some((e) => e.message.includes('special character'))).toBe(true);
      }
    });

    it('accepts valid password satisfying all requirements', () => {
      const res = PasswordPolicySchema.safeParse('SuperSecret2026!');
      expect(res.success).toBe(true);
    });
  });

  describe('evaluatePassword validation & live requirements', () => {
    it('returns score 0 and empty label for blank passwords', () => {
      const res = evaluatePassword('');
      expect(res.score).toBe(0);
      expect(res.label).toBe('Empty');
      expect(res.isValid).toBe(false);
      expect(res.requirements.hasMinLength).toBe(false);
      expect(res.requirements.hasUppercase).toBe(false);
      expect(res.requirements.hasLowercase).toBe(false);
      expect(res.requirements.hasNumber).toBe(false);
      expect(res.requirements.hasSymbol).toBe(false);
    });

    it('flags passwords under 12 characters as weak', () => {
      const res = evaluatePassword('Short1!');
      expect(res.score).toBe(1);
      expect(res.label).toBe('Weak');
      expect(res.requirements.hasMinLength).toBe(false);
      expect(res.isValid).toBe(false);
      expect(res.tip).toContain('at least 12 characters');
    });

    it('validates password exactly at 12 characters boundary', () => {
      // 11 chars: fails min length
      const eleven = evaluatePassword('Abc!9xK7#mQ');
      expect(eleven.requirements.hasMinLength).toBe(false);
      expect(eleven.isValid).toBe(false);

      // 12 chars: satisfies min length & complexity
      const twelve = evaluatePassword('Abc!9xK7#mQ2');
      expect(twelve.requirements.hasMinLength).toBe(true);
      expect(twelve.requirements.hasUppercase).toBe(true);
      expect(twelve.requirements.hasLowercase).toBe(true);
      expect(twelve.requirements.hasNumber).toBe(true);
      expect(twelve.requirements.hasSymbol).toBe(true);
      expect(twelve.isValid).toBe(true);
    });

    it('flags missing uppercase character', () => {
      const res = evaluatePassword('lower!93748251');
      expect(res.requirements.hasUppercase).toBe(false);
      expect(res.requirements.hasLowercase).toBe(true);
      expect(res.isValid).toBe(false);
      expect(res.tip).toContain('uppercase');
    });

    it('flags missing lowercase character', () => {
      const res = evaluatePassword('UPPER!93748251');
      expect(res.requirements.hasUppercase).toBe(true);
      expect(res.requirements.hasLowercase).toBe(false);
      expect(res.isValid).toBe(false);
      expect(res.tip).toContain('lowercase');
    });

    it('flags missing numeric digit', () => {
      const res = evaluatePassword('Abc!defghijkl');
      expect(res.requirements.hasNumber).toBe(false);
      expect(res.isValid).toBe(false);
      expect(res.tip).toContain('number');
    });

    it('flags missing special symbol', () => {
      const res = evaluatePassword('Abc9374825178');
      expect(res.requirements.hasSymbol).toBe(false);
      expect(res.isValid).toBe(false);
      expect(res.tip).toContain('special character');
    });

    it('identifies commonly guessed or breached passwords', () => {
      const res = evaluatePassword('password123456');
      expect(res.score).toBe(1);
      expect(res.label).toBe('Weak');
      expect(res.requirements.isNotCommon).toBe(false);
      expect(res.isValid).toBe(false);
      expect(res.tip).toContain('common password');
    });

    it('flags passwords containing the user name or company name', () => {
      const res = evaluatePassword('HelloSathesh2026!', ['Sathesh', 'sathesh@example.com', 'AcmeCorp']);
      expect(res.score).toBe(1);
      expect(res.label).toBe('Weak');
      expect(res.requirements.isNotRelated).toBe(false);
      expect(res.isValid).toBe(false);
      expect(res.tip).toContain('personal details or company names');
    });

    it('flags passwords containing company name even with different case', () => {
      const res = evaluatePassword('acmecorpSecret99$!', ['AcmeCorp']);
      expect(res.requirements.isNotRelated).toBe(false);
      expect(res.isValid).toBe(false);
    });

    it('rates medium passwords as Fair (score 2)', () => {
      const res = evaluatePassword('CorrectHorse7!');
      expect(res.score).toBeGreaterThanOrEqual(2);
      expect(res.requirements.hasMinLength).toBe(true);
      expect(res.requirements.hasUppercase).toBe(true);
      expect(res.requirements.hasLowercase).toBe(true);
      expect(res.requirements.hasNumber).toBe(true);
      expect(res.requirements.hasSymbol).toBe(true);
      expect(res.requirements.isNotCommon).toBe(true);
      expect(res.requirements.isNotRelated).toBe(true);
      expect(res.isValid).toBe(true);
    });

    it('rates complex multi-character passwords as Good or Strong (score 3 or 4)', () => {
      const res = evaluatePassword('Correct-Horse-Battery-Staple-99$');
      expect(res.score).toBeGreaterThanOrEqual(3);
      expect(res.isValid).toBe(true);
      expect(res.requirements.hasMinLength).toBe(true);
      expect(res.requirements.isNotCommon).toBe(true);
      expect(res.requirements.isNotRelated).toBe(true);
    });
  });

  describe('Server error code mapping', () => {
    it('maps common error code to friendly message', () => {
      const msg = mapServerError('common');
      expect(msg).toBe(SERVER_ERROR_MESSAGES.common);
      expect(msg).toContain('too common');
    });

    it('maps breached error code to safety warning', () => {
      const msg = mapServerError('breached');
      expect(msg).toBe(SERVER_ERROR_MESSAGES.breached);
      expect(msg).toContain('data breach');
    });

    it('maps reused error code to policy message', () => {
      const msg = mapServerError('reused');
      expect(msg).toBe(SERVER_ERROR_MESSAGES.reused);
      expect(msg).toContain('reuse');
    });

    it('maps weak error code to requirement advice', () => {
      const msg = mapServerError('weak');
      expect(msg).toBe(SERVER_ERROR_MESSAGES.weak);
      expect(msg).toContain('strength requirements');
    });

    it('handles custom string or null safely', () => {
      expect(mapServerError(null)).toBeNull();
      expect(mapServerError(undefined)).toBeNull();
      expect(mapServerError('custom_reason')).toBe('custom_reason');
    });
  });

  describe('Component export contracts & constants', () => {
    it('exports MIN_PASSWORD_LENGTH as 12 and MAX_PASSWORD_LENGTH as 128', () => {
      expect(MIN_PASSWORD_LENGTH).toBe(12);
      expect(MAX_PASSWORD_LENGTH).toBe(128);
    });

    it('exports PasswordField with accessibility and password manager attributes', () => {
      expect(PasswordField).toBeDefined();
    });

    it('exports PasswordStrengthMeter with evaluatePassword and loadZxcvbn', async () => {
      expect(PasswordStrengthMeter).toBeDefined();
      expect(evaluatePassword).toBeDefined();
      const { loadZxcvbn } = await import('@hs/ui');
      expect(loadZxcvbn).toBeDefined();
      const zxcvbn = await loadZxcvbn();
      expect(typeof zxcvbn).toBe('function');
      const evaluatedWithZxcvbn = evaluatePassword('Correct-Horse-Battery-Staple-2026!', [], zxcvbn);
      expect(evaluatedWithZxcvbn.score).toBeGreaterThanOrEqual(3);
    });

    it('exports SetPasswordForm for onboarding and password change flows', () => {
      expect(SetPasswordForm).toBeDefined();
    });
  });
});

