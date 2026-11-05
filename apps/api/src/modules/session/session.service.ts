import { Inject, Injectable, Optional } from '@nestjs/common';
import crypto from 'node:crypto';
import type { SessionPublicDto } from '@hs/contracts';
import type { UserContext } from '../../common/types/user-context.js';
import { AuditLogService } from '../../common/audit/audit-log.service.js';
import { SESSION_STORE } from './session.tokens.js';
import {
  COOKIE_HOST_SESSION_NAME,
  COOKIE_SESSION_NAME,
} from './session-cookie.js';
import {
  ROLE_SESSION_LIMITS,
  type SessionRecord,
  type SessionStore,
} from './session.types.js';

export { COOKIE_HOST_SESSION_NAME, COOKIE_SESSION_NAME } from './session-cookie.js';

/** Default fallback rolling session TTL (12h). */
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function maskIp(ip?: string | null): string {
  if (!ip) {
    return 'unknown';
  }
  const trimmed = ip.trim();
  if (!trimmed) {
    return 'unknown';
  }
  // IPv4 masking: 192.168.1.100 -> 192.168.1.xxx
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(trimmed)) {
    return trimmed.replace(/\.\d+$/, '.xxx');
  }
  // IPv6 masking: 2001:db8:85a3::8a2e:370:7334 -> 2001:db8:85a3::*
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    if (parts.length > 3) {
      return `${parts.slice(0, 3).join(':')}::*`;
    }
    return `${trimmed}:*`;
  }
  return trimmed;
}

export function parseDeviceSummary(userAgent?: string | null): string {
  if (!userAgent || typeof userAgent !== 'string' || userAgent.trim() === '') {
    return 'Unknown Device';
  }
  const ua = userAgent.trim();

  let browser = 'Browser';
  if (ua.includes('Edg/')) {
    browser = 'Edge';
  } else if (ua.includes('Chrome/') && !ua.includes('Chromium')) {
    browser = 'Chrome';
  } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    browser = 'Safari';
  } else if (ua.includes('Firefox/')) {
    browser = 'Firefox';
  } else if (ua.includes('curl/')) {
    browser = 'cURL';
  } else if (ua.includes('PostmanRuntime')) {
    browser = 'Postman';
  }

  let os = 'Unknown OS';
  if (ua.includes('Windows NT')) {
    os = 'Windows';
  } else if (ua.includes('Macintosh') || ua.includes('Mac OS X')) {
    os = 'macOS';
  } else if (ua.includes('iPhone') || ua.includes('iPad')) {
    os = 'iOS';
  } else if (ua.includes('Android')) {
    os = 'Android';
  } else if (ua.includes('Linux')) {
    os = 'Linux';
  }

  return `${browser} on ${os}`;
}

@Injectable()
export class SessionService {
  constructor(
    @Inject(SESSION_STORE) private readonly store: SessionStore,
    @Optional() @Inject(AuditLogService) private readonly auditLog?: AuditLogService,
  ) {}

  static cookieName(config?: { NODE_ENV?: string }): string {
    const isProd = config?.NODE_ENV === 'production';
    return isProd ? COOKIE_HOST_SESSION_NAME : COOKIE_SESSION_NAME;
  }

  async createSession(
    user: UserContext,
    meta?: {
      ip?: string | null | undefined;
      userAgent?: string | null | undefined;
      mfaVerified?: boolean | undefined;
    },
  ): Promise<{
    rawToken: string;
    sessionId: string;
    record: SessionRecord;
    cookieMaxAgeSeconds: number;
  }> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const sessionId = crypto.randomUUID();
    const tokenHash = hashToken(rawToken);
    const now = Date.now();

    const limits = ROLE_SESSION_LIMITS[user.role] ?? ROLE_SESSION_LIMITS.candidate;
    const idleTimeoutMs = limits.idleTimeoutSeconds * 1000;
    const absoluteExpiresAt = now + limits.absoluteLifetimeSeconds * 1000;
    const initialTtlSeconds = Math.min(
      limits.idleTimeoutSeconds,
      limits.absoluteLifetimeSeconds,
    );

    const record: SessionRecord = {
      id: sessionId,
      sessionId,
      user,
      userId: user.userId,
      orgId: user.orgId,
      role: user.role,
      email: user.email,
      createdAt: now,
      lastSeenAt: now,
      absoluteExpiresAt,
      idleTimeoutMs,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
      mfaVerified: meta?.mfaVerified ?? false,
    };

    const { evictedRecords } = await this.store.registerAndEnforceCap(
      user.userId,
      tokenHash,
      record,
      limits.maxConcurrentSessions,
      initialTtlSeconds,
    );

    // Audit concurrency evictions if any
    for (const evicted of evictedRecords) {
      await this.safeAuditLog({
        actorId: evicted.userId,
        actorRole: evicted.role,
        orgId: evicted.orgId,
        action: 'session.limit_exceeded',
        entity: 'session',
        entityId: evicted.sessionId,
        after: {
          sessionId: evicted.sessionId,
          reason: 'CONCURRENCY_LIMIT_EXCEEDED',
          maxConcurrentSessions: limits.maxConcurrentSessions,
        },
      });

      await this.safeAuditLog({
        actorId: evicted.userId,
        actorRole: evicted.role,
        orgId: evicted.orgId,
        action: 'session.revoked',
        entity: 'session',
        entityId: evicted.sessionId,
        after: {
          sessionId: evicted.sessionId,
          reason: 'CONCURRENCY_LIMIT_EXCEEDED',
        },
      });
    }

    // Audit session created
    await this.safeAuditLog({
      actorId: user.userId,
      actorRole: user.role,
      orgId: user.orgId,
      action: 'session.created',
      entity: 'session',
      entityId: sessionId,
      after: {
        sessionId,
        role: user.role,
        idleTimeoutSeconds: limits.idleTimeoutSeconds,
        absoluteLifetimeSeconds: limits.absoluteLifetimeSeconds,
      },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return {
      rawToken,
      sessionId,
      record,
      cookieMaxAgeSeconds: limits.absoluteLifetimeSeconds,
    };
  }

  async cacheAccountStatus(
    rawToken: string,
    status: {
      userStatus: string | null;
      orgStatus: string | null;
      mustResetPassword?: boolean;
    },
  ): Promise<void> {
    const tokenHash = hashToken(rawToken.trim());
    const record = await this.store.get(tokenHash);
    if (!record) {
      return;
    }
    const now = Date.now();
    const remainingAbsoluteSeconds = Math.max(
      1,
      Math.floor((record.absoluteExpiresAt - now) / 1000),
    );
    const limits = ROLE_SESSION_LIMITS[record.role] ?? ROLE_SESSION_LIMITS.candidate;
    const ttlSeconds = Math.min(limits.idleTimeoutSeconds, remainingAbsoluteSeconds);
    const refreshed: SessionRecord = {
      ...record,
      statusCachedAt: now,
      cachedUserStatus: status.userStatus ?? undefined,
      cachedOrgStatus: status.orgStatus,
      mustResetPassword: status.mustResetPassword,
    };
    await this.touch(tokenHash, refreshed, ttlSeconds);
  }

  async markMfaVerified(rawToken: string | undefined): Promise<void> {
    if (!rawToken?.trim()) {
      return;
    }
    const tokenHash = hashToken(rawToken.trim());
    const record = await this.store.get(tokenHash);
    if (!record) {
      return;
    }
    const now = Date.now();
    const remainingAbsoluteSeconds = Math.max(
      1,
      Math.floor((record.absoluteExpiresAt - now) / 1000),
    );
    const limits = ROLE_SESSION_LIMITS[record.role] ?? ROLE_SESSION_LIMITS.candidate;
    const ttlSeconds = Math.min(limits.idleTimeoutSeconds, remainingAbsoluteSeconds);
    await this.touch(tokenHash, { ...record, mfaVerified: true }, ttlSeconds);
  }

  private async touch(tokenHash: string, record: SessionRecord, ttlSeconds: number): Promise<void> {
    if (this.store.touch) {
      await this.store.touch(tokenHash, record, ttlSeconds);
      return;
    }
    await this.store.set(tokenHash, record, ttlSeconds);
  }

  async resolveSession(rawToken: string | undefined): Promise<SessionRecord | null> {
    if (!rawToken || typeof rawToken !== 'string' || rawToken.trim() === '') {
      return null;
    }
    const tokenHash = hashToken(rawToken.trim());
    const record = await this.store.get(tokenHash);
    if (!record) {
      return null;
    }

    const now = Date.now();

    // 1. Enforce absolute lifetime expiration
    if (now >= record.absoluteExpiresAt) {
      await this.store.delete(tokenHash);
      await this.safeAuditLog({
        actorId: record.userId,
        actorRole: record.role,
        orgId: record.orgId,
        action: 'session.expired',
        entity: 'session',
        entityId: record.sessionId,
        after: {
          sessionId: record.sessionId,
          reason: 'ABSOLUTE_LIFETIME_EXPIRED',
        },
      });
      return null;
    }

    // 2. Enforce role-based idle timeout
    const limits = ROLE_SESSION_LIMITS[record.role] ?? ROLE_SESSION_LIMITS.candidate;
    const idleTimeoutMs = record.idleTimeoutMs ?? limits.idleTimeoutSeconds * 1000;
    if (now - record.lastSeenAt >= idleTimeoutMs) {
      await this.store.delete(tokenHash);
      await this.safeAuditLog({
        actorId: record.userId,
        actorRole: record.role,
        orgId: record.orgId,
        action: 'session.expired',
        entity: 'session',
        entityId: record.sessionId,
        after: {
          sessionId: record.sessionId,
          reason: 'IDLE_TIMEOUT_EXPIRED',
        },
      });
      return null;
    }

    // 3. Sliding idle refresh throttled to at most once per 60s
    if (now - record.lastSeenAt >= 60_000) {
      const remainingAbsoluteSeconds = Math.max(
        1,
        Math.floor((record.absoluteExpiresAt - now) / 1000),
      );
      const ttlSeconds = Math.min(limits.idleTimeoutSeconds, remainingAbsoluteSeconds);

      const refreshed: SessionRecord = {
        ...record,
        lastSeenAt: now,
      };

      await this.touch(tokenHash, refreshed, ttlSeconds);
      return refreshed;
    }

    return record;
  }

  async destroySession(rawToken: string | undefined): Promise<void> {
    if (!rawToken || typeof rawToken !== 'string' || rawToken.trim() === '') {
      return;
    }
    const tokenHash = hashToken(rawToken.trim());
    const record = await this.store.get(tokenHash);
    await this.store.delete(tokenHash);

    if (record) {
      await this.safeAuditLog({
        actorId: record.userId,
        actorRole: record.role,
        orgId: record.orgId,
        action: 'session.revoked',
        entity: 'session',
        entityId: record.sessionId,
        after: {
          sessionId: record.sessionId,
          reason: 'USER_LOGOUT',
        },
      });
    }
  }

  async listUserSessions(
    userId: string,
    currentRawToken?: string,
  ): Promise<SessionPublicDto[]> {
    const entries = await this.store.getUserSessions(userId);
    const currentTokenHash = currentRawToken ? hashToken(currentRawToken.trim()) : undefined;

    return entries.map((entry) => ({
      sessionId: entry.record.sessionId || entry.record.id,
      device: parseDeviceSummary(entry.record.userAgent),
      ip: maskIp(entry.record.ip),
      createdAt: new Date(entry.record.createdAt).toISOString(),
      lastSeenAt: new Date(entry.record.lastSeenAt).toISOString(),
      current: currentTokenHash ? entry.tokenHash === currentTokenHash : false,
    }));
  }

  async revokeSessionByPublicId(userId: string, sessionId: string): Promise<boolean> {
    const revoked = await this.store.revokeSessionByPublicId(userId, sessionId);
    if (!revoked) {
      return false;
    }

    await this.safeAuditLog({
      actorId: userId,
      actorRole: revoked.role,
      orgId: revoked.orgId,
      action: 'session.revoked',
      entity: 'session',
      entityId: sessionId,
      after: {
        sessionId,
        reason: 'REVOKED_BY_USER',
      },
    });

    return true;
  }

  async revokeAllSessionsForUser(userId: string): Promise<number> {
    const revoked = await this.store.revokeAllForUser(userId);

    for (const record of revoked) {
      await this.safeAuditLog({
        actorId: userId,
        actorRole: record.role,
        orgId: record.orgId,
        action: 'session.revoked',
        entity: 'session',
        entityId: record.sessionId,
        after: {
          sessionId: record.sessionId,
          reason: 'LOGOUT_ALL',
        },
      });
    }

    return revoked.length;
  }

  /** Revoke all sessions except the one matching the current cookie token (e.g. after password change). */
  async revokeOtherSessionsForUser(userId: string, exceptRawToken?: string): Promise<number> {
    const exceptTokenHash = exceptRawToken?.trim()
      ? hashToken(exceptRawToken.trim())
      : '';
    const revoked = await this.store.revokeOtherSessionsForUser(userId, exceptTokenHash);

    for (const record of revoked) {
      await this.safeAuditLog({
        actorId: userId,
        actorRole: record.role,
        orgId: record.orgId,
        action: 'session.revoked',
        entity: 'session',
        entityId: record.sessionId,
        after: {
          sessionId: record.sessionId,
          reason: 'PASSWORD_CHANGE',
        },
      });
    }

    return revoked.length;
  }

  private async safeAuditLog(entry: {
    actorId?: string | null | undefined;
    actorRole: string;
    orgId?: string | null | undefined;
    action: string;
    entity: string;
    entityId?: string | null | undefined;
    after?: Record<string, any> | undefined;
    ip?: string | null | undefined;
    userAgent?: string | null | undefined;
  }): Promise<void> {
    if (!this.auditLog) {
      return;
    }
    try {
      await this.auditLog.log(entry);
    } catch {
      // Best-effort audit logging; avoid failing session operations
    }
  }
}
