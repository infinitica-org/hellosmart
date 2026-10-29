import type { IdempotencyRecord, IdempotencyStore, SessionRecord, SessionStore } from './session.types.js';

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

  async get(sessionId: string): Promise<SessionRecord | null> {
    purgeExpired(this.sessions);
    const row = this.sessions.get(sessionId);
    if (!row || row.expiresAt <= Date.now()) {
      this.sessions.delete(sessionId);
      return null;
    }
    return { id: row.id, user: row.user, createdAt: row.createdAt, lastSeenAt: row.lastSeenAt };
  }

  async set(sessionId: string, record: SessionRecord, ttlSeconds: number): Promise<void> {
    this.sessions.set(sessionId, {
      ...record,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    for (const [userId, ids] of this.userSessions) {
      if (ids.delete(sessionId) && ids.size === 0) {
        this.userSessions.delete(userId);
      }
    }
  }

  async registerUserSession(userId: string, sessionId: string, _ttlSeconds: number): Promise<void> {
    const set = this.userSessions.get(userId) ?? new Set<string>();
    set.add(sessionId);
    this.userSessions.set(userId, set);
  }

  async revokeAllForUser(userId: string): Promise<void> {
    const ids = this.userSessions.get(userId);
    if (!ids) {
      return;
    }
    for (const sessionId of ids) {
      this.sessions.delete(sessionId);
    }
    this.userSessions.delete(userId);
  }

  async revokeOtherSessionsForUser(userId: string, exceptSessionId?: string): Promise<void> {
    const ids = this.userSessions.get(userId);
    if (!ids) {
      return;
    }
    for (const sessionId of Array.from(ids)) {
      if (sessionId !== exceptSessionId) {
        this.sessions.delete(sessionId);
        ids.delete(sessionId);
      }
    }
    if (ids.size === 0) {
      this.userSessions.delete(userId);
    }
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
