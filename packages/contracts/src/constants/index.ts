/**
 * Recursively deep-freezes an object structure to enforce runtime immutability.
 */
export function deepFreeze<T extends object>(obj: T): Readonly<T> {
  Object.freeze(obj);
  for (const key of Object.getOwnPropertyNames(obj)) {
    const val = (obj as Record<string, unknown>)[key];
    if (
      val !== null &&
      (typeof val === 'object' || typeof val === 'function') &&
      !Object.isFrozen(val)
    ) {
      deepFreeze(val as object);
    }
  }
  return obj;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Platform Numeric Constants & Limits
// ─────────────────────────────────────────────────────────────────────────────
export const PAGINATION_PAGE_SIZE = 10 as const;
export const MAX_CSV_UPLOAD_ROWS = 1000 as const;
export const MAX_FILE_SIZE_BYTES = 52428800 as const; // 50MB (50 * 1024 * 1024)
export const AUTOSAVE_INTERVAL_MS = 30000 as const; // 30s RPO (BR-11)
export const COUNTDOWN_WARNING_MINUTES = 10 as const;
export const INVITE_TOKEN_EXPIRY_DAYS = 7 as const;
export const DEFAULT_TEST_DURATION_MINUTES = 60 as const;
export const RUBRIC_WEIGHT_TOTAL = 100 as const;

export const SHARED_NUMBERS = deepFreeze({
  PAGINATION_PAGE_SIZE,
  MAX_CSV_UPLOAD_ROWS,
  MAX_FILE_SIZE_BYTES,
  AUTOSAVE_INTERVAL_MS,
  COUNTDOWN_WARNING_MINUTES,
  INVITE_TOKEN_EXPIRY_DAYS,
  DEFAULT_TEST_DURATION_MINUTES,
  RUBRIC_WEIGHT_TOTAL,
  MIN_PASSWORD_LENGTH: 12,
  MAX_PASSWORD_LENGTH: 128,
  LOCKOUT_DURATION_MINUTES: 15,
  MAX_LOGIN_ATTEMPTS: 5,
} as const);

// ─────────────────────────────────────────────────────────────────────────────
// Shared Placeholders
// ─────────────────────────────────────────────────────────────────────────────
export const SHARED_PLACEHOLDERS = deepFreeze({
  SEARCH_TEMPLATES: 'Search templates by role or tag...',
  UPLOAD_CSV: 'Upload or drag CSV file...',
  NOTES_TEXTAREA: 'Enter candidate solution notes...',
  ASSESSMENT_NAME: 'e.g. Senior Backend Engineer Take-Home',
  SEARCH_CANDIDATES: 'Search candidates by name or email...',
  SEARCH_ASSESSMENTS: 'Search assessments...',
  INPUT_EMAIL: 'name@company.com',
  INPUT_PASSWORD: 'Enter your password',
} as const);

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI Labels, Buttons & Badges
// ─────────────────────────────────────────────────────────────────────────────
export const SHARED_BUTTONS = deepFreeze({
  CREATE_ASSESSMENT: 'Create Assessment',
  PUBLISH_ASSESSMENT: 'Publish Assessment',
  SUBMIT_ASSESSMENT: 'Submit Assessment',
  CONFIRM_IMPORT: 'Confirm Import',
  RESEND_INVITE: 'Resend Invite',
  INVITE_CANDIDATE: 'Invite Candidate',
  SAVE_CHANGES: 'Save Changes',
  CANCEL: 'Cancel',
  DELETE: 'Delete',
  BROWSE_TEMPLATES: 'Browse Template Catalog',
} as const);

export const SHARED_STATUS_BADGES = deepFreeze({
  READY_TO_START: 'Ready to Start',
  IN_PROGRESS: 'In Progress',
  SUBMITTED: 'Submitted',
  EXPIRED: 'Expired',
  INVITED: 'Invited',
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  DELETED: 'Deleted',
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  CLOSED: 'Closed',
  ARCHIVED: 'Archived',
} as const);

// ─────────────────────────────────────────────────────────────────────────────
// Shared Alert Messages & Errors
// ─────────────────────────────────────────────────────────────────────────────
export const SHARED_ALERT_MESSAGES = deepFreeze({
  FILE_SIZE_EXCEEDS_50MB: 'File size exceeds allowed 50MB limit',
  INVALID_EMAIL_FORMAT_AT_ROW: (row: number) => `Invalid email format at row ${row}`,
  TOTAL_RUBRIC_WEIGHT_MUST_EQUAL_100: 'Total rubric weight must equal exactly 100%',
  ASSESSMENT_SUBMITTED_SUCCESS: 'Assessment has been submitted successfully',
  LOGIN_LOCKED: 'Too many failed login attempts. Try again later.',
  INVALID_CREDENTIALS: 'Invalid email or password.',
  SESSION_EXPIRED: 'Your session has expired. Please sign in again.',
} as const);

// ─────────────────────────────────────────────────────────────────────────────
// Shared Platform Defaults & Branding
// ─────────────────────────────────────────────────────────────────────────────
export const SHARED_BRANDING = deepFreeze({
  APP_NAME: 'HelloSmart.ai',
  SHORT_NAME: 'HelloSmart',
  TAGLINE: 'Hire by doing.',
  SUPPORT_EMAIL: 'support@hellosmart.ai',
  CAL_BOOKING_URL: 'https://cal.com/hellosmart',
  FALLBACK_AVATAR: '/avatars/default.png',
} as const);

export const SHARED_PLATFORM_DEFAULTS = deepFreeze({
  CURRENCY: 'USD',
  TIMEZONE: 'UTC',
  RETENTION_DAYS: 90,
  WORKSPACE_MODE: 'cloud',
  AUTOSAVE_INTERVAL_MS,
  PAGINATION_PAGE_SIZE,
  DEFAULT_TEST_DURATION_MINUTES,
  RUBRIC_WEIGHT_TOTAL,
} as const);

