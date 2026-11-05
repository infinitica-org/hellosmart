import { describe, it, expect } from 'vitest';
import {
  sanitizeRedirectPath,
  isValidPortalPath,
  getSafeRedirectUrl,
  getDefaultPortal,
} from '../lib/safe-redirect';

describe('Safe Redirect & Open-Redirect Defense (S0-T14-2)', () => {
  describe('sanitizeRedirectPath', () => {
    it('returns null for null, undefined, and non-string inputs', () => {
      expect(sanitizeRedirectPath(null)).toBeNull();
      expect(sanitizeRedirectPath(undefined)).toBeNull();
      expect(sanitizeRedirectPath('')).toBeNull();
      expect(sanitizeRedirectPath('   ')).toBeNull();
    });

    it('rejects absolute URLs with external schemes', () => {
      expect(sanitizeRedirectPath('https://evil.com')).toBeNull();
      expect(sanitizeRedirectPath('http://evil.com/login')).toBeNull();
      expect(sanitizeRedirectPath('javascript:alert(1)')).toBeNull();
      expect(sanitizeRedirectPath('data:text/html,<script>alert(1)</script>')).toBeNull();
      expect(sanitizeRedirectPath('file:///etc/passwd')).toBeNull();
    });

    it('rejects protocol-relative URLs', () => {
      expect(sanitizeRedirectPath('//evil.com')).toBeNull();
      expect(sanitizeRedirectPath('///evil.com')).toBeNull();
      expect(sanitizeRedirectPath('//evil.com/admin')).toBeNull();
    });

    it('rejects backslash evasion attempts', () => {
      expect(sanitizeRedirectPath('\\evil.com')).toBeNull();
      expect(sanitizeRedirectPath('/\\evil.com')).toBeNull();
      expect(sanitizeRedirectPath('\\\\evil.com')).toBeNull();
      expect(sanitizeRedirectPath('/evil.com\\test')).toBeNull();
    });

    it('rejects dangerous encoded characters', () => {
      expect(sanitizeRedirectPath('/%5cevil.com')).toBeNull();
      expect(sanitizeRedirectPath('/%00evil.com')).toBeNull();
      expect(sanitizeRedirectPath('/%0d%0aevil.com')).toBeNull();
      expect(sanitizeRedirectPath('/test%0dSet-Cookie:bad')).toBeNull();
    });

    it('rejects ASCII control characters', () => {
      expect(sanitizeRedirectPath('/test\x00path')).toBeNull();
      expect(sanitizeRedirectPath('/test\x1Fpath')).toBeNull();
      expect(sanitizeRedirectPath('/test\x7Fpath')).toBeNull();
    });

    it('rejects percent-encoded slashes and backslashes', () => {
      expect(sanitizeRedirectPath('/%2fevil.com')).toBeNull();
      expect(sanitizeRedirectPath('/%2Fevil.com')).toBeNull();
      expect(sanitizeRedirectPath('/%252fevil.com')).toBeNull();
      expect(sanitizeRedirectPath('/%5cevil.com')).toBeNull();
    });

    it('rejects path traversal attempts', () => {
      expect(sanitizeRedirectPath('/company/../admin')).toBeNull();
      expect(sanitizeRedirectPath('/candidate/..')).toBeNull();
      expect(sanitizeRedirectPath('/admin/./secret')).toBeNull();
    });

    it('allows valid relative paths within the application', () => {
      expect(sanitizeRedirectPath('/candidate')).toBe('/candidate');
      expect(sanitizeRedirectPath('/company/assessments')).toBe('/company/assessments');
      expect(sanitizeRedirectPath('/admin/organizations/123')).toBe('/admin/organizations/123');
    });

    it('preserves query strings and hash fragments on valid paths', () => {
      expect(sanitizeRedirectPath('/company/candidates?page=2&sort=name#list')).toBe(
        '/company/candidates?page=2&sort=name#list',
      );
      expect(sanitizeRedirectPath('/candidate/tests/456?view=summary')).toBe(
        '/candidate/tests/456?view=summary',
      );
    });
  });

  describe('getDefaultPortal', () => {
    it('returns role-based portal roots', () => {
      expect(getDefaultPortal('platform_admin')).toBe('/admin');
      expect(getDefaultPortal('company_admin')).toBe('/company');
      expect(getDefaultPortal('candidate')).toBe('/candidate');
    });

    it('prefers explicit portal identifier if valid', () => {
      expect(getDefaultPortal(undefined, 'admin')).toBe('/admin');
      expect(getDefaultPortal(undefined, 'company')).toBe('/company');
      expect(getDefaultPortal(undefined, 'candidate')).toBe('/candidate');
    });

    it('falls back to /login for unknown role', () => {
      expect(getDefaultPortal('unknown_role')).toBe('/login');
      expect(getDefaultPortal(null, null)).toBe('/login');
    });
  });

  describe('isValidPortalPath', () => {
    it('validates exact portal roots', () => {
      expect(isValidPortalPath('/admin', 'platform_admin')).toBe(true);
      expect(isValidPortalPath('/company', 'company_admin')).toBe(true);
      expect(isValidPortalPath('/candidate', 'candidate')).toBe(true);
    });

    it('validates authorized subpaths, query strings, and hashes', () => {
      expect(isValidPortalPath('/company/assessments', 'company_admin')).toBe(true);
      expect(isValidPortalPath('/company?tab=active', 'company_admin')).toBe(true);
      expect(isValidPortalPath('/company#profile', 'company_admin')).toBe(true);
      expect(isValidPortalPath('/candidate/profile', 'candidate')).toBe(true);
      expect(isValidPortalPath('/admin/tenants/new', 'platform_admin')).toBe(true);
    });

    it('rejects subpath boundary bypass attempts (e.g. /company-evil)', () => {
      expect(isValidPortalPath('/company-evil', 'company_admin')).toBe(false);
      expect(isValidPortalPath('/company_phish', 'company_admin')).toBe(false);
      expect(isValidPortalPath('/candidate-malicious', 'candidate')).toBe(false);
      expect(isValidPortalPath('/admin-secret', 'platform_admin')).toBe(false);
    });

    it('rejects cross-portal unauthorized access', () => {
      expect(isValidPortalPath('/admin', 'candidate')).toBe(false);
      expect(isValidPortalPath('/company', 'candidate')).toBe(false);
      expect(isValidPortalPath('/admin', 'company_admin')).toBe(false);
      expect(isValidPortalPath('/company', 'platform_admin')).toBe(false);
    });
  });

  describe('getSafeRedirectUrl', () => {
    it('returns default portal when from parameter is missing', () => {
      expect(getSafeRedirectUrl(null, 'candidate')).toBe('/candidate');
      expect(getSafeRedirectUrl(undefined, 'company_admin')).toBe('/company');
      expect(getSafeRedirectUrl('', 'platform_admin')).toBe('/admin');
    });

    it('neutralizes open-redirect attacks by falling back to user portal', () => {
      expect(getSafeRedirectUrl('https://evil.com', 'candidate')).toBe('/candidate');
      expect(getSafeRedirectUrl('//evil.com', 'company_admin')).toBe('/company');
      expect(getSafeRedirectUrl('/\\evil.com', 'platform_admin')).toBe('/admin');
      expect(getSafeRedirectUrl('\\evil.com', 'candidate')).toBe('/candidate');
      expect(getSafeRedirectUrl('javascript:alert(1)', 'company_admin')).toBe('/company');
    });

    it('prevents cross-portal escalation via from parameter', () => {
      // Candidate attempting to access /admin via from parameter must be contained in /candidate
      expect(getSafeRedirectUrl('/admin', 'candidate')).toBe('/candidate');
      expect(getSafeRedirectUrl('/company/candidates', 'candidate')).toBe('/candidate');

      // Company admin attempting to access /admin must stay in /company
      expect(getSafeRedirectUrl('/admin/organizations', 'company_admin')).toBe('/company');
    });

    it('neutralizes boundary bypasses', () => {
      expect(getSafeRedirectUrl('/company-evil/page', 'company_admin')).toBe('/company');
      expect(getSafeRedirectUrl('/candidate_evil', 'candidate')).toBe('/candidate');
    });

    it('preserves valid, authorized destination with query parameters and hash', () => {
      expect(
        getSafeRedirectUrl('/company/assessments/123?edit=true#rubric', 'company_admin'),
      ).toBe('/company/assessments/123?edit=true#rubric');

      expect(
        getSafeRedirectUrl('/candidate/workspaces/session-456', 'candidate'),
      ).toBe('/candidate/workspaces/session-456');

      expect(
        getSafeRedirectUrl('/admin/organizations?status=active', 'platform_admin'),
      ).toBe('/admin/organizations?status=active');
    });
  });
});

