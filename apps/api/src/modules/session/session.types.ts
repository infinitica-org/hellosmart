import type { UserContext, UserRole } from '../../common/types/user-context.js';

export interface SessionRecord {
  id: string; // Public sessionId (UUID)
  sessionId: string; // Alias matching id
  user: UserContext;
  userId: string;
  orgId: string | null;
  role: UserRole;
  email: string;
  createdAt: number; // Unix ms
  lastSeenAt: number; // Unix ms
  absoluteExpiresAt: number; // Unix ms
  idleTimeoutMs?: number | undefined;
  ip?: string | null | undefined;
  userAgent?: string | null | undefined;
  mfaVerified?: boolean | undefined;
}

export interface RoleSessionLimits {
  idleTimeoutSeconds: number;
  absoluteLifetimeSeconds: number;
  maxConcurrentSessions: number;
}

export const ROLE_SESSION_LIMITS: Record<UserRole, RoleSessionLimits> = {
  platform_admin: {
    idleTimeoutSeconds: 15 * 60, // 15 minutes
    absoluteLifetimeSeconds: 8 * 60 * 60, // 8 hours
    maxConcurrentSessions: 2,
  },
  company_admin: {
    idleTimeoutSeconds: 30 * 60, // 30 minutes
    absoluteLifetimeSeconds: 12 * 60 * 60, // 12 hours
    maxConcurrentSessions: 5,
  },
  candidate: {
    idleTimeoutSeconds: 30 * 60, // 30 minutes
    absoluteLifetimeSeconds: 12 * 60 * 60, // 12 hours
    maxConcurrentSessions: 5,
  },
};

export interface SessionStore {
  get(tokenHash: string): Promise<SessionRecord | null>;
  set(tokenHash: string, record: SessionRecord, ttlSeconds: number): Promise<void>;
  delete(tokenHash: string): Promise<void>;
  registerAndEnforceCap(
    userId: string,
    tokenHash: string,
    record: SessionRecord,
    maxSessions: number,
    ttlSeconds: number,
  ): Promise<{ evictedRecords: SessionRecord[] }>;
  getUserSessions(userId: string): Promise<Array<{ tokenHash: string; record: SessionRecord }>>;
  revokeSessionByPublicId(userId: string, sessionId: string): Promise<SessionRecord | null>;
  revokeAllForUser(userId: string): Promise<SessionRecord[]>;
  revokeOtherSessionsForUser(userId: string, exceptTokenHash: string): Promise<SessionRecord[]>;
}

export interface IdempotencyRecord {
  statusCode: number;
  body: string;
  contentType: string;
  expiresAt: number;
}

export interface IdempotencyStore {
  get(key: string): Promise<IdempotencyRecord | null>;
  set(key: string, record: IdempotencyRecord, ttlSeconds: number): Promise<void>;
}
