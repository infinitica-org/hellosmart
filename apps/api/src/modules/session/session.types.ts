import type { UserContext } from '../../common/types/user-context.js';

export interface SessionRecord {
  id: string;
  user: UserContext;
  createdAt: number;
  lastSeenAt: number;
}

export interface SessionStore {
  get(sessionId: string): Promise<SessionRecord | null>;
  set(sessionId: string, record: SessionRecord, ttlSeconds: number): Promise<void>;
  delete(sessionId: string): Promise<void>;
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
