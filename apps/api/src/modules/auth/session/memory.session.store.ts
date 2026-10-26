import { Injectable } from '@nestjs/common';
import type { Session, SessionStore } from './session.interface.js';

interface StoredSession {
  session: Session;
  expiresAt: number; // epoch ms
}

@Injectable()
export class MemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, StoredSession>();
  private readonly userSessions = new Map<string, Set<string>>();

  async createSession(session: Session, ttlSeconds: number): Promise<void> {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.sessions.set(session.id, { session: { ...session }, expiresAt });

    let userSet = this.userSessions.get(session.userId);
    if (!userSet) {
      userSet = new Set();
      this.userSessions.set(session.userId, userSet);
    }
    userSet.add(session.id);
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const entry = this.sessions.get(sessionId);
    if (!entry) {
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      await this.destroySession(sessionId);
      return null;
    }
    return { ...entry.session };
  }

  async touchSession(sessionId: string, ttlSeconds: number): Promise<void> {
    const entry = this.sessions.get(sessionId);
    if (entry) {
      entry.expiresAt = Date.now() + ttlSeconds * 1000;
      entry.session.lastActiveAt = Date.now();
    }
  }

  async destroySession(sessionId: string): Promise<void> {
    const entry = this.sessions.get(sessionId);
    if (entry) {
      this.sessions.delete(sessionId);
      const userSet = this.userSessions.get(entry.session.userId);
      if (userSet) {
        userSet.delete(sessionId);
        if (userSet.size === 0) {
          this.userSessions.delete(entry.session.userId);
        }
      }
    }
  }

  async destroyUserSessions(userId: string): Promise<void> {
    const userSet = this.userSessions.get(userId);
    if (userSet) {
      for (const sid of userSet) {
        this.sessions.delete(sid);
      }
      this.userSessions.delete(userId);
    }
  }

  async ping(): Promise<boolean> {
    return true;
  }

  clear(): void {
    this.sessions.clear();
    this.userSessions.clear();
  }
}

