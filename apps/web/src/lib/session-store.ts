/**
 * Server-side session store for local development and testing.
 * INVARIANT: Never used in production. In production environments,
 * all sessions are cryptographically validated against the API backend / Redis.
 */
export interface DevSession {
  role: 'platform_admin' | 'company_admin' | 'candidate';
  email: string;
}

export const DEV_SESSION_STORE = new Map<string, DevSession>([
  ['sess_123_admin', { role: 'platform_admin', email: 'admin@hellosmart.ai' }],
  ['sess_123_company', { role: 'company_admin', email: 'company@example.com' }],
  ['sess_123_candidate', { role: 'candidate', email: 'candidate@example.com' }],
  ['sess_abc_candidate', { role: 'candidate', email: 'candidate@example.com' }],
]);

export interface PreAuthEntry {
  email: string;
  attempts: number;
  expiresAt: number;
}

export const MOCK_PREAUTH_STORE = new Map<string, PreAuthEntry>();

