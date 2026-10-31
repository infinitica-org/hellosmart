import { deepFreeze } from './deep-freeze';
import { ROUTES } from './routes';
import { BRANDING } from './branding';
import { LIMITS, NUMBERS } from './numbers';
import { PLACEHOLDERS } from './placeholders';
import { UI_LABELS } from './labels';
import { ALERT_MESSAGES, MESSAGES } from './messages';
import { PLATFORM_DEFAULTS } from './defaults';
import {
  TEMPLATE_CATEGORIES,
  TEMPLATE_DIFFICULTIES,
  DIFFICULTY_BADGE_CONFIG,
  WORKSPACE_MODE_CONFIG,
} from './template-categories';
import {
  PAGINATION_PAGE_SIZE,
  MAX_CSV_UPLOAD_ROWS,
  MAX_FILE_SIZE_BYTES,
  AUTOSAVE_INTERVAL_MS,
  COUNTDOWN_WARNING_MINUTES,
  INVITE_TOKEN_EXPIRY_DAYS,
  DEFAULT_TEST_DURATION_MINUTES,
  RUBRIC_WEIGHT_TOTAL,
  SHARED_NUMBERS,
  SHARED_PLACEHOLDERS,
  SHARED_BUTTONS,
  SHARED_STATUS_BADGES,
  SHARED_ALERT_MESSAGES,
  SHARED_BRANDING,
  SHARED_PLATFORM_DEFAULTS,
} from '@hs/contracts';

export * from './deep-freeze';
export * from './routes';
export * from './branding';
export * from './numbers';
export * from './placeholders';
export * from './labels';
export * from './messages';
export * from './defaults';
export * from './template-categories';

export {
  PAGINATION_PAGE_SIZE,
  MAX_CSV_UPLOAD_ROWS,
  MAX_FILE_SIZE_BYTES,
  AUTOSAVE_INTERVAL_MS,
  COUNTDOWN_WARNING_MINUTES,
  INVITE_TOKEN_EXPIRY_DAYS,
  DEFAULT_TEST_DURATION_MINUTES,
  RUBRIC_WEIGHT_TOTAL,
  SHARED_NUMBERS,
  SHARED_PLACEHOLDERS,
  SHARED_BUTTONS,
  SHARED_STATUS_BADGES,
  SHARED_ALERT_MESSAGES,
  SHARED_BRANDING,
  SHARED_PLATFORM_DEFAULTS,
};

/**
 * Top-level master CONSTANTS object providing typed, autocompleted,
 * and deeply frozen access to all platform constants.
 */
export const CONSTANTS = deepFreeze({
  ROUTES,
  BRANDING,
  LIMITS,
  NUMBERS,
  PLACEHOLDERS,
  UI_LABELS,
  ALERT_MESSAGES,
  MESSAGES,
  PLATFORM_DEFAULTS,
  TEMPLATES: {
    CATEGORIES: TEMPLATE_CATEGORIES,
    DIFFICULTIES: TEMPLATE_DIFFICULTIES,
    DIFFICULTY_BADGES: DIFFICULTY_BADGE_CONFIG,
    WORKSPACE_MODES: WORKSPACE_MODE_CONFIG,
  },
  SHARED: {
    NUMBERS: SHARED_NUMBERS,
    PLACEHOLDERS: SHARED_PLACEHOLDERS,
    BUTTONS: SHARED_BUTTONS,
    STATUS_BADGES: SHARED_STATUS_BADGES,
    ALERT_MESSAGES: SHARED_ALERT_MESSAGES,
    BRANDING: SHARED_BRANDING,
    DEFAULTS: SHARED_PLATFORM_DEFAULTS,
  },
} as const);

export type PlatformConstants = typeof CONSTANTS;
