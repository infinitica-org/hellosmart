export interface Session {
  id: string;               // 64-character hex string (32 bytes crypto random)
  userId: string;
  orgId: string | null;     // null for platform_admin
  email: string;
  name: string;
  role: 'platform_admin' | 'company_admin' | 'candidate';
  portal: 'admin' | 'company' | 'candidate';
  mustResetPassword: boolean;
  createdAt: number;        // epoch timestamp ms
  lastActiveAt: number;     // epoch timestamp ms
  ip?: string | undefined;
  userAgent?: string | undefined;
}

export interface CreateSessionInput {
  userId: string;
  orgId: string | null;
  email: string;
  name: string;
  role: 'platform_admin' | 'company_admin' | 'candidate';
  portal: 'admin' | 'company' | 'candidate';
  mustResetPassword: boolean;
  ip?: string | undefined;
  userAgent?: string | undefined;
}

export interface SessionStore {
  createSession(session: Session, ttlSeconds: number): Promise<void>;
  getSession(sessionId: string): Promise<Session | null>;
  touchSession(sessionId: string, ttlSeconds: number): Promise<void>;
  destroySession(sessionId: string): Promise<void>;
  destroyUserSessions(userId: string): Promise<void>;
  ping(): Promise<boolean>;
}

export const SESSION_STORE = 'SESSION_STORE';

export const SESSION_COOKIE_NAME = 'hs_session';
export const ROLE_COOKIE_NAME = 'hs_role';
export const MUST_RESET_COOKIE_NAME = 'hs_must_reset';

// Sliding window: max 7 days
export const MAX_SESSION_TTL_SECONDS = 7 * 24 * 3600; // 604,800 seconds

// Inactivity timeout: 30 minutes for normal users, 15 minutes for platform_admin
export const IDLE_TIMEOUT_SECONDS = 30 * 60; // 1,800 seconds
export const ADMIN_IDLE_TIMEOUT_SECONDS = 15 * 60; // 900 seconds
