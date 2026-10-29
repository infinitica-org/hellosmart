import { Inject, Injectable } from '@nestjs/common';
import type { UserContext } from '../../common/types/user-context.js';
import { SESSION_STORE } from './session.tokens.js';
import type { SessionRecord, SessionStore } from './session.types.js';

const SESSION_COOKIE = 'hs_session';
/** Rolling session TTL (S0-T03-4). */
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

@Injectable()
export class SessionService {
  constructor(@Inject(SESSION_STORE) private readonly store: SessionStore) {}

  static cookieName(): string {
    return SESSION_COOKIE;
  }

  async createSession(user: UserContext): Promise<{ sessionId: string; record: SessionRecord }> {
    const sessionId = crypto.randomUUID();
    const now = Date.now();
    const record: SessionRecord = {
      id: sessionId,
      user,
      createdAt: now,
      lastSeenAt: now,
    };
    await this.store.set(sessionId, record, SESSION_TTL_SECONDS);
    await this.store.registerUserSession(user.userId, sessionId, SESSION_TTL_SECONDS);
    return { sessionId, record };
  }

  async destroySession(sessionId: string): Promise<void> {
    await this.store.delete(sessionId);
  }

  async revokeAllSessionsForUser(userId: string): Promise<void> {
    await this.store.revokeAllForUser(userId);
  }

  async revokeOtherSessionsForUser(userId: string, exceptSessionId?: string): Promise<void> {
    await this.store.revokeOtherSessionsForUser(userId, exceptSessionId);
  }

  async resolveSession(sessionId: string | undefined): Promise<SessionRecord | null> {
    if (!sessionId) {
      return null;
    }
    const record = await this.store.get(sessionId);
    if (!record) {
      return null;
    }
    const refreshed: SessionRecord = { ...record, lastSeenAt: Date.now() };
    await this.store.set(sessionId, refreshed, SESSION_TTL_SECONDS);
    return refreshed;
  }
}
