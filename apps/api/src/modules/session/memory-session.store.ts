import type {
  IdempotencyRecord,
  IdempotencyStore,
  SessionRecord,
  SessionStore,
} from './session.types.js';

function purgeExpired<T extends { expiresAt: number }>(map: Map<string, T>): void {
  const now = Date.now();
  for (const [key, value] of map) {
    if (value.expiresAt <= now) {
      map.delete(key);
    }
  }
}

export class MemorySessionStore implements SessionStore {
  private sessions = new Map<string, SessionRecord & { expiresAt: number }>();
  private userSessions = new Map<string, Set<string>>();

  async get(tokenHash: string): Promise<SessionRecord | null> {
    purgeExpired(this.sessions);
    const row = this.sessions.get(tokenHash);
    const now = Date.now();
    if (!row || row.expiresAt <= now || now >= row.absoluteExpiresAt) {
      if (row) {
        this.sessions.delete(tokenHash);
      }
      return null;
    }
    return {
      id: row.id,
      sessionId: row.sessionId,
      user: row.user,
      userId: row.userId,
      orgId: row.orgId,
      role: row.role,
      email: row.email,
      createdAt: row.createdAt,
      lastSeenAt: row.lastSeenAt,
      absoluteExpiresAt: row.absoluteExpiresAt,
      ip: row.ip,
      userAgent: row.userAgent,
      mfaVerified: row.mfaVerified,
    };
  }

  async set(tokenHash: string, record: SessionRecord, ttlSeconds: number): Promise<void> {
    this.sessions.set(tokenHash, {
      ...record,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async delete(tokenHash: string): Promise<void> {
    const existing = this.sessions.get(tokenHash);
    if (existing) {
      const set = this.userSessions.get(existing.userId);
      if (set) {
        set.delete(tokenHash);
        if (set.size === 0) {
          this.userSessions.delete(existing.userId);
        }
      }
    }
    this.sessions.delete(tokenHash);
  }

  async registerAndEnforceCap(
    userId: string,
    tokenHash: string,
    record: SessionRecord,
    maxSessions: number,
    ttlSeconds: number,
  ): Promise<{ evictedRecords: SessionRecord[] }> {
    const set = this.userSessions.get(userId) ?? new Set<string>();
    const now = Date.now();
    const validSessions: Array<{ tokenHash: string; record: SessionRecord }> = [];

    for (const hash of set) {
      const row = this.sessions.get(hash);
      if (!row || row.expiresAt <= now || now >= row.absoluteExpiresAt) {
        set.delete(hash);
        this.sessions.delete(hash);
      } else {
        validSessions.push({ tokenHash: hash, record: row });
      }
    }

    const evictedRecords: SessionRecord[] = [];
    if (validSessions.length >= maxSessions) {
      validSessions.sort((a, b) => a.record.createdAt - b.record.createdAt);
      const toEvictCount = validSessions.length - maxSessions + 1;
      const toEvict = validSessions.slice(0, toEvictCount);

      for (const item of toEvict) {
        this.sessions.delete(item.tokenHash);
        set.delete(item.tokenHash);
        evictedRecords.push(item.record);
      }
    }

    this.sessions.set(tokenHash, {
      ...record,
      expiresAt: now + ttlSeconds * 1000,
    });
    set.add(tokenHash);
    this.userSessions.set(userId, set);

    return { evictedRecords };
  }

  async getUserSessions(
    userId: string,
  ): Promise<Array<{ tokenHash: string; record: SessionRecord }>> {
    const set = this.userSessions.get(userId);
    if (!set) {
      return [];
    }
    const now = Date.now();
    const result: Array<{ tokenHash: string; record: SessionRecord }> = [];

    for (const hash of Array.from(set)) {
      const row = this.sessions.get(hash);
      if (!row || row.expiresAt <= now || now >= row.absoluteExpiresAt) {
        set.delete(hash);
        this.sessions.delete(hash);
      } else {
        result.push({ tokenHash: hash, record: row });
      }
    }

    if (set.size === 0) {
      this.userSessions.delete(userId);
    }

    result.sort((a, b) => b.record.createdAt - a.record.createdAt);
    return result;
  }

  async revokeSessionByPublicId(
    userId: string,
    sessionId: string,
  ): Promise<SessionRecord | null> {
    const sessions = await this.getUserSessions(userId);
    const target = sessions.find(
      (s) => s.record.sessionId === sessionId || s.record.id === sessionId,
    );
    if (!target) {
      return null;
    }
    await this.delete(target.tokenHash);
    return target.record;
  }

  async revokeAllForUser(userId: string): Promise<SessionRecord[]> {
    const sessions = await this.getUserSessions(userId);
    const revoked = sessions.map((s) => s.record);
    for (const s of sessions) {
      this.sessions.delete(s.tokenHash);
    }
    this.userSessions.delete(userId);
    return revoked;
  }

  async revokeOtherSessionsForUser(
    userId: string,
    exceptTokenHash: string,
  ): Promise<SessionRecord[]> {
    const sessions = await this.getUserSessions(userId);
    const revoked: SessionRecord[] = [];
    const set = this.userSessions.get(userId) ?? new Set<string>();

    for (const s of sessions) {
      if (s.tokenHash !== exceptTokenHash) {
        this.sessions.delete(s.tokenHash);
        set.delete(s.tokenHash);
        revoked.push(s.record);
      }
    }
    return revoked;
  }
}

export class MemoryIdempotencyStore implements IdempotencyStore {
  private records = new Map<string, IdempotencyRecord>();

  async get(key: string): Promise<IdempotencyRecord | null> {
    purgeExpired(this.records);
    const row = this.records.get(key);
    if (!row || row.expiresAt <= Date.now()) {
      this.records.delete(key);
      return null;
    }
    return row;
  }

  async set(key: string, record: IdempotencyRecord, _ttlSeconds: number): Promise<void> {
    this.records.set(key, record);
  }
}
