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
