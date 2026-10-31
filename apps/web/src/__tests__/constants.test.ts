import { describe, it, expect } from 'vitest';
import {
  CONSTANTS,
  ROUTES,
  BRANDING,
  LIMITS,
  NUMBERS,
  PLACEHOLDERS,
  UI_LABELS,
  ALERT_MESSAGES,
  MESSAGES,
  PLATFORM_DEFAULTS,
  TEMPLATE_CATEGORIES,
  TEMPLATE_DIFFICULTIES,
  DIFFICULTY_BADGE_CONFIG,
  WORKSPACE_MODE_CONFIG,
  deepFreeze,
} from '@/constants';

describe('Centralized Platform Constants & Variable Architecture (Stream 8.5)', () => {
  describe('Master CONSTANTS Structure & Exports', () => {
    it('exports all standard constant namespaces', () => {
      expect(CONSTANTS).toBeDefined();
      expect(CONSTANTS.ROUTES).toBe(ROUTES);
      expect(CONSTANTS.BRANDING).toBe(BRANDING);
      expect(CONSTANTS.LIMITS).toBe(LIMITS);
      expect(CONSTANTS.NUMBERS).toBe(NUMBERS);
      expect(CONSTANTS.PLACEHOLDERS).toBe(PLACEHOLDERS);
      expect(CONSTANTS.UI_LABELS).toBe(UI_LABELS);
      expect(CONSTANTS.ALERT_MESSAGES).toBe(ALERT_MESSAGES);
      expect(CONSTANTS.MESSAGES).toBe(MESSAGES);
      expect(CONSTANTS.PLATFORM_DEFAULTS).toBe(PLATFORM_DEFAULTS);
      expect(CONSTANTS.TEMPLATES.CATEGORIES).toBe(TEMPLATE_CATEGORIES);
      expect(CONSTANTS.TEMPLATES.DIFFICULTIES).toBe(TEMPLATE_DIFFICULTIES);
      expect(CONSTANTS.TEMPLATES.DIFFICULTY_BADGES).toBe(DIFFICULTY_BADGE_CONFIG);
      expect(CONSTANTS.TEMPLATES.WORKSPACE_MODES).toBe(WORKSPACE_MODE_CONFIG);
    });

    it('enforces runtime immutability on top-level and nested constant objects via Object.freeze', () => {
      expect(Object.isFrozen(CONSTANTS)).toBe(true);
      expect(Object.isFrozen(ROUTES)).toBe(true);
      expect(Object.isFrozen(ROUTES.AUTH)).toBe(true);
      expect(Object.isFrozen(ROUTES.COMPANY)).toBe(true);
      expect(Object.isFrozen(ROUTES.CANDIDATE)).toBe(true);
      expect(Object.isFrozen(ROUTES.ADMIN)).toBe(true);
      expect(Object.isFrozen(ROUTES.API)).toBe(true);
      expect(Object.isFrozen(BRANDING)).toBe(true);
      expect(Object.isFrozen(LIMITS)).toBe(true);
      expect(Object.isFrozen(LIMITS.PAGINATION)).toBe(true);
      expect(Object.isFrozen(LIMITS.CSV)).toBe(true);
      expect(Object.isFrozen(LIMITS.SECURITY)).toBe(true);
      expect(Object.isFrozen(PLACEHOLDERS)).toBe(true);
      expect(Object.isFrozen(UI_LABELS)).toBe(true);
      expect(Object.isFrozen(ALERT_MESSAGES)).toBe(true);
      expect(Object.isFrozen(PLATFORM_DEFAULTS)).toBe(true);
    });

    it('throws runtime TypeError when attempting to mutate frozen constant properties', () => {
      expect(() => {
        // @ts-expect-error mutating readonly property
        ROUTES.AUTH.LOGIN = '/tampered';
      }).toThrow(TypeError);

      expect(() => {
        // @ts-expect-error mutating readonly property
        LIMITS.CSV.MAX_ROWS = 999999;
      }).toThrow(TypeError);

      expect(() => {
        // @ts-expect-error mutating readonly property
        BRANDING.APP_NAME = 'FakeHiringApp';
      }).toThrow(TypeError);
    });
  });

  describe('deepFreeze Utility Function', () => {
    it('deeply freezes nested objects and returns the same reference', () => {
      const sample = {
        level1: {
          level2: {
            value: 42,
          },
        },
      };

      const frozen = deepFreeze(sample);
      expect(frozen).toBe(sample);
      expect(Object.isFrozen(frozen)).toBe(true);
      expect(Object.isFrozen(frozen.level1)).toBe(true);
      expect(Object.isFrozen(frozen.level1.level2)).toBe(true);
    });
  });

  describe('Route Definitions (ROUTES)', () => {
    it('defines correct paths for public, auth, and company portals', () => {
      expect(ROUTES.PUBLIC.HOME).toBe('/');
      expect(ROUTES.AUTH.LOGIN).toBe('/login');
      expect(ROUTES.AUTH.ACCEPT_INVITE).toBe('/accept-invite');
      expect(ROUTES.AUTH.SET_PASSWORD).toBe('/set-password');
      expect(ROUTES.AUTH.CHANGE_PASSWORD).toBe('/change-password');

      expect(ROUTES.COMPANY.DASHBOARD).toBe('/company');
      expect(ROUTES.COMPANY.TEMPLATES).toBe('/company/templates');
      expect(ROUTES.COMPANY.ASSESSMENTS).toBe('/company/assessments');
      expect(ROUTES.COMPANY.NEW_ASSESSMENT).toBe('/company/assessments/new');
      expect(ROUTES.COMPANY.CANDIDATES).toBe('/company/candidates');
      expect(ROUTES.COMPANY.ANALYTICS).toBe('/company/analytics');
      expect(ROUTES.COMPANY.SETTINGS).toBe('/company/settings');
      expect(ROUTES.COMPANY.RUBRIC('test-uuid-123')).toBe('/company/assessments/test-uuid-123/rubric');
    });

    it('defines correct paths for candidate, admin, and api routes', () => {
      expect(ROUTES.CANDIDATE.DASHBOARD).toBe('/candidate');
      expect(ROUTES.CANDIDATE.ASSESSMENTS).toBe('/candidate/assessments');
      expect(ROUTES.CANDIDATE.PROFILE).toBe('/candidate/profile');

      expect(ROUTES.ADMIN.DASHBOARD).toBe('/admin');
      expect(ROUTES.ADMIN.COMPANIES).toBe('/admin/companies');
      expect(ROUTES.ADMIN.AGENTS).toBe('/admin/agents');
      expect(ROUTES.ADMIN.AUDIT).toBe('/admin/audit');

      expect(ROUTES.API.AUTH_LOGIN).toBe('/api/auth/login');
      expect(ROUTES.API.AUTH_LOGOUT).toBe('/api/auth/logout');
      expect(ROUTES.API.AUTH_ME).toBe('/api/auth/me');
      expect(ROUTES.API.AUTH_IDENTIFY).toBe('/api/auth/identify');
      expect(ROUTES.API.CANDIDATES).toBe('/api/v1/candidates');
    });
  });

  describe('Branding Configuration (BRANDING)', () => {
    it('contains platform identity and branding assets', () => {
      expect(BRANDING.APP_NAME).toBe('HelloSmart.ai');
      expect(BRANDING.SHORT_NAME).toBe('HelloSmart');
      expect(BRANDING.TAGLINE).toBe('Hire by doing.');
      expect(BRANDING.SUPPORT_EMAIL).toBe('support@hellosmart.ai');
      expect(BRANDING.CAL_BOOKING_URL).toBe('https://cal.com/hellosmart');
      expect(BRANDING.POWERED_BY).toBe('Powered by hellosmart.ai');
      expect(BRANDING.COPYRIGHT).toContain('HelloSmart.ai');
    });
  });

  describe('Numeric Limits & Boundaries (LIMITS / NUMBERS)', () => {
    it('defines standard pagination defaults and options', () => {
      expect(LIMITS.PAGINATION.DEFAULT_PAGE).toBe(1);
      expect(LIMITS.PAGINATION.DEFAULT_LIMIT).toBe(10);
      expect(LIMITS.PAGINATION.MAX_PAGE_SIZE).toBe(100);
      expect(LIMITS.PAGINATION.PAGE_SIZE_OPTIONS).toEqual([10, 20, 50, 100]);
    });

    it('enforces core platform numeric constants from contracts spec', () => {
      expect(LIMITS.PAGINATION_PAGE_SIZE).toBe(10);
      expect(LIMITS.MAX_CSV_UPLOAD_ROWS).toBe(1000);
      expect(LIMITS.MAX_FILE_SIZE_BYTES).toBe(52428800);
      expect(LIMITS.AUTOSAVE_INTERVAL_MS).toBe(30000);
      expect(LIMITS.COUNTDOWN_WARNING_MINUTES).toBe(10);
      expect(LIMITS.INVITE_TOKEN_EXPIRY_DAYS).toBe(7);
      expect(LIMITS.DEFAULT_TEST_DURATION_MINUTES).toBe(60);
      expect(LIMITS.RUBRIC_WEIGHT_TOTAL).toBe(100);
    });

    it('enforces CSV upload row and byte constraints', () => {
      expect(LIMITS.CSV.MAX_ROWS).toBe(500);
      expect(LIMITS.CSV.MAX_SIZE_BYTES).toBe(2 * 1024 * 1024);
    });

    it('defines security and timeout constraints', () => {
      expect(LIMITS.TIMEOUTS.DEBOUNCE_SEARCH_MS).toBe(300);
      expect(LIMITS.TIMEOUTS.TOAST_DURATION_MS).toBe(4000);
      expect(LIMITS.TIMEOUTS.SESSION_BANNER_DISMISS_MS).toBe(3000);
      expect(LIMITS.TIMEOUTS.IDLE_TIMEOUT_MS).toBe(15 * 60 * 1000);
      expect(LIMITS.SECURITY.MAX_LOGIN_ATTEMPTS).toBe(5);
      expect(LIMITS.SECURITY.LOCKOUT_DURATION_MINUTES).toBe(15);
      expect(LIMITS.SECURITY.INVITE_TOKEN_EXPIRY_DAYS).toBe(7);
    });

    it('defines password and rubric constraints', () => {
      expect(LIMITS.PASSWORD.MIN_LENGTH).toBe(12);
      expect(LIMITS.RUBRIC.TOTAL_WEIGHT).toBe(100);
      expect(LIMITS.RUBRIC.MIN_ITEM_WEIGHT).toBe(5);
    });
  });

  describe('Placeholders & Inputs (PLACEHOLDERS)', () => {
    it('defines contextual search placeholders', () => {
      expect(PLACEHOLDERS.SEARCH.CANDIDATES).toBe('Search by name or email...');
      expect(PLACEHOLDERS.SEARCH.TEMPLATES).toBe('Search templates by role or tag...');
      expect(PLACEHOLDERS.SEARCH.ASSESSMENTS).toBe('Search assessments...');
      expect(PLACEHOLDERS.SEARCH.GLOBAL_ADMIN).toBe('Search organizations, templates, audits...');
    });

    it('defines exact spec placeholders for modal, notes, and assessment title', () => {
      expect(PLACEHOLDERS.MODALS.CSV_UPLOAD_DROPZONE).toBe('Upload or drag CSV file...');
      expect(PLACEHOLDERS.TEXTAREAS.NOTES).toBe('Enter candidate solution notes...');
      expect(PLACEHOLDERS.INPUTS.ASSESSMENT_TITLE).toBe('e.g. Senior Backend Engineer Take-Home');
    });

    it('defines form input placeholders', () => {
      expect(PLACEHOLDERS.INPUTS.EMAIL).toBe('name@company.com');
      expect(PLACEHOLDERS.INPUTS.PASSWORD).toBe('Enter your password');
      expect(PLACEHOLDERS.INPUTS.CANDIDATE_NAME).toBe('e.g. Jane Doe');
      expect(PLACEHOLDERS.INPUTS.CANDIDATE_EMAIL).toBe('e.g. jane.doe@example.com');
    });
  });

  describe('UI Labels & Headers (UI_LABELS)', () => {
    it('provides standard page titles and headers', () => {
      expect(UI_LABELS.PAGE_HEADERS.CANDIDATE_HUB_TITLE).toBe('Candidates');
      expect(UI_LABELS.PAGE_HEADERS.TEMPLATE_CATALOG_TITLE).toBe('Template Catalog');
      expect(UI_LABELS.PAGE_HEADERS.ASSESSMENT_HUB_TITLE).toBe('Assessments');
      expect(UI_LABELS.PAGE_HEADERS.NEW_ASSESSMENT_TITLE).toBe('Create New Assessment');
      expect(UI_LABELS.PAGE_HEADERS.ADMIN_COMPANIES_TITLE).toBe('Organizations & Tenants');
    });

    it('provides standard button and status labels', () => {
      expect(UI_LABELS.BUTTONS.CREATE_ASSESSMENT).toBe('Create Assessment');
      expect(UI_LABELS.BUTTONS.PUBLISH_ASSESSMENT).toBe('Publish Assessment');
      expect(UI_LABELS.BUTTONS.SUBMIT_ASSESSMENT).toBe('Submit Assessment');
      expect(UI_LABELS.BUTTONS.CONFIRM_IMPORT).toBe('Confirm Import');
      expect(UI_LABELS.BUTTONS.RESEND_INVITE).toBe('Resend Invite');
      expect(UI_LABELS.BUTTONS.INVITE_CANDIDATE).toBe('Invite Candidate');
      expect(UI_LABELS.BUTTONS.BULK_UPLOAD).toBe('Bulk Upload (CSV)');
      expect(UI_LABELS.BUTTONS.SAVE_CHANGES).toBe('Save Changes');
      expect(UI_LABELS.BUTTONS.CANCEL).toBe('Cancel');
      expect(UI_LABELS.BUTTONS.DELETE).toBe('Delete');

      expect(UI_LABELS.STATUS.READY_TO_START).toBe('Ready to Start');
      expect(UI_LABELS.STATUS.IN_PROGRESS).toBe('In Progress');
      expect(UI_LABELS.STATUS.SUBMITTED).toBe('Submitted');
      expect(UI_LABELS.STATUS.EXPIRED).toBe('Expired');
      expect(UI_LABELS.STATUS.ACTIVE).toBe('Active');
      expect(UI_LABELS.STATUS.INVITED).toBe('Invited');
      expect(UI_LABELS.STATUS.SUSPENDED).toBe('Suspended');
    });
  });

  describe('Alert Messages & Errors (ALERT_MESSAGES / MESSAGES)', () => {
    it('provides standard auth error messages', () => {
      expect(ALERT_MESSAGES.AUTH.INVALID_CREDENTIALS).toBe('Invalid email or password.');
      expect(ALERT_MESSAGES.AUTH.ACCOUNT_LOCKED).toBe('Too many failed login attempts. Try again later.');
      expect(ALERT_MESSAGES.AUTH.SESSION_EXPIRED).toBe('Your session has expired. Please sign in again.');
      expect(ALERT_MESSAGES.AUTH.UNAUTHORIZED).toBe('You do not have permission to access this resource.');
    });

    it('provides candidate lifecycle notification messages', () => {
      expect(ALERT_MESSAGES.CANDIDATES.INVITE_SUCCESS).toBe('Candidate invitation sent successfully.');
      expect(ALERT_MESSAGES.CANDIDATES.RESEND_SUCCESS).toBe('Candidate invite link refreshed and resent.');
      expect(ALERT_MESSAGES.CANDIDATES.UPDATE_SUCCESS).toBe('Candidate details updated successfully.');
      expect(ALERT_MESSAGES.CANDIDATES.DELETE_SUCCESS).toBe('Candidate removed from your organization.');
    });

    it('provides CSV error messages and specific spec alert strings', () => {
      expect(ALERT_MESSAGES.CSV.FILE_SIZE_EXCEEDS_50MB).toBe('File size exceeds allowed 50MB limit');
      expect(ALERT_MESSAGES.CSV.FILE_TOO_LARGE).toBe('File size exceeds 2 MB limit.');
      expect(ALERT_MESSAGES.CSV.TOO_MANY_ROWS).toBe('File contains more than 500 candidate rows.');
      expect(ALERT_MESSAGES.CSV.EMPTY_FILE).toBe('The selected CSV file is empty.');
      expect(ALERT_MESSAGES.CSV.INVALID_EMAIL_FORMAT_AT_ROW(5)).toBe('Invalid email format at row 5');
      expect(ALERT_MESSAGES.RUBRIC.TOTAL_WEIGHT_MUST_EQUAL_100).toBe('Total rubric weight must equal exactly 100%');
      expect(ALERT_MESSAGES.ASSESSMENTS.SUBMITTED_SUCCESS).toBe('Assessment has been submitted successfully');
    });
  });

  describe('Platform Defaults (PLATFORM_DEFAULTS)', () => {
    it('specifies core architectural defaults per BR-01 - BR-33', () => {
      expect(PLATFORM_DEFAULTS.CURRENCY).toBe('USD');
      expect(PLATFORM_DEFAULTS.TIMEZONE).toBe('UTC');
      expect(PLATFORM_DEFAULTS.RETENTION_DAYS).toBe(90);
      expect(PLATFORM_DEFAULTS.WORKSPACE_MODE).toBe('cloud');
      expect(PLATFORM_DEFAULTS.AI_POLICY.ENABLED).toBe(true);
      expect(PLATFORM_DEFAULTS.AI_POLICY.MODEL).toBe('gemini-1.5-pro');
      expect(PLATFORM_DEFAULTS.AI_POLICY.ON_CAP).toBe('warn_then_block');
      expect(PLATFORM_DEFAULTS.TIMING.PAUSE_TIMER_ON_DISCONNECT).toBe(false);
    });
  });
});

