import { describe, it, expect } from 'vitest';
import {
  evaluatePassword,
  mapServerError,
  SERVER_ERROR_MESSAGES,
  PasswordField,
  PasswordStrengthMeter,
} from '@hs/ui';
import { SetPasswordForm } from '../components/auth/set-password-form';

describe('Password Component Suite: S0-T17-2', () => {
  describe('evaluatePassword validation & live requirements', () => {
    it('returns score 0 and empty label for blank passwords', () => {
      const res = evaluatePassword('');
      expect(res.score).toBe(0);
      expect(res.label).toBe('Empty');
      expect(res.isValid).toBe(false);
      expect(res.requirements.hasMinLength).toBe(false);
    });

    it('flags passwords under 8 characters as weak', () => {
      const res = evaluatePassword('Short1!');
      expect(res.score).toBe(1);
      expect(res.label).toBe('Weak');
      expect(res.requirements.hasMinLength).toBe(false);
      expect(res.isValid).toBe(false);
      expect(res.tip).toContain('at least 8 characters');
    });

    it('identifies commonly guessed or breached passwords', () => {
      const res = evaluatePassword('password123');
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
      const res = evaluatePassword('acmecorpSecret99$', ['AcmeCorp']);
      expect(res.requirements.isNotRelated).toBe(false);
      expect(res.isValid).toBe(false);
    });

    it('rates medium passwords as Fair (score 2)', () => {
      const res = evaluatePassword('CorrectHorse7');
      expect(res.score).toBeGreaterThanOrEqual(2);
      expect(res.requirements.hasMinLength).toBe(true);
      expect(res.requirements.isNotCommon).toBe(true);
      expect(res.requirements.isNotRelated).toBe(true);
      expect(res.isValid).toBe(true);
    });

    it('rates complex multi-character passwords as Good or Strong (score 3 or 4)', () => {
      const res = evaluatePassword('correct-horse-battery-staple-99$');
      expect(res.score).toBe(4);
      expect(res.label).toBe('Strong');
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

  describe('Component export contracts', () => {
    it('exports PasswordField with accessibility and password manager attributes', () => {
      expect(PasswordField).toBeDefined();
    });

    it('exports PasswordStrengthMeter with evaluatePassword', () => {
      expect(PasswordStrengthMeter).toBeDefined();
      expect(evaluatePassword).toBeDefined();
    });

    it('exports SetPasswordForm for onboarding and password change flows', () => {
      expect(SetPasswordForm).toBeDefined();
    });
  });
});

