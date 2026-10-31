import { deepFreeze } from './deep-freeze';

export const PLATFORM_DEFAULTS = deepFreeze({
  CURRENCY: 'USD',
  TIMEZONE: 'UTC',
  RETENTION_DAYS: 90,
  WORKSPACE_MODE: 'cloud',
  AI_POLICY: {
    ENABLED: true,
    MODEL: 'gemini-1.5-pro',
    ON_CAP: 'warn_then_block',
    DEFAULT_RPM: 60,
  },
  TIMING: {
    DEFAULT_DURATION_MINUTES: 120,
    PAUSE_TIMER_ON_DISCONNECT: false,
  },
  RELEASE_RESULTS_DEFAULT: false,
} as const);

export type PlatformDefaultsConfig = typeof PLATFORM_DEFAULTS;

