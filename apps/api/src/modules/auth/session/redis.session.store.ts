import { Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import type { Session, SessionStore } from './session.interface.js';
import { MAX_SESSION_TTL_SECONDS } from './session.interface.js';

@Injectable()
export class RedisSessionStore implements SessionStore {
  private readonly logger = new Logger(RedisSessionStore.name);
  private readonly redis: Redis;

  constructor(redisOrUrl: Redis | string) {
    if (typeof redisOrUrl === 'string') {
      this.redis = new Redis(redisOrUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
      });
      this.redis.on('error', (err) => {
        this.logger.error(`Redis session store error: ${err.message}`);
      });
    } else {
      this.redis = redisOrUrl;
    }
  }

  async createSession(session: Session, ttlSeconds: number): Promise<void> {
    const sessionKey = `hs_session:${session.id}`;
    const userSessionsKey = `hs_user_sessions:${session.userId}`;

    const pipeline = this.redis.pipeline();
    pipeline.set(sessionKey, JSON.stringify(session), 'EX', ttlSeconds);
    pipeline.sadd(userSessionsKey, session.id);
    pipeline.expire(userSessionsKey, MAX_SESSION_TTL_SECONDS);
    await pipeline.exec();
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const sessionKey = `hs_session:${sessionId}`;
    const raw = await this.redis.get(sessionKey);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as Session;
    } catch {
      this.logger.warn(`Corrupt session JSON for ${sessionId}, cleaning up`);
      await this.redis.del(sessionKey);
      return null;
    }
  }

  async touchSession(sessionId: string, ttlSeconds: number): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return;
    }
    session.lastActiveAt = Date.now();
    const sessionKey = `hs_session:${sessionId}`;
    await this.redis.set(sessionKey, JSON.stringify(session), 'EX', ttlSeconds);
  }

  async destroySession(sessionId: string): Promise<void> {
    const sessionKey = `hs_session:${sessionId}`;
    const raw = await this.redis.get(sessionKey);
    let userId: string | null = null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { userId?: string };
        userId = parsed.userId ?? null;
      } catch {
        // Ignore corrupt JSON during deletion
      }
    }

    const pipeline = this.redis.pipeline();
    pipeline.del(sessionKey);
    if (userId) {
      pipeline.srem(`hs_user_sessions:${userId}`, sessionId);
    }
    await pipeline.exec();
  }

  async destroyUserSessions(userId: string): Promise<void> {
    const userSessionsKey = `hs_user_sessions:${userId}`;
    const sessionIds = await this.redis.smembers(userSessionsKey);

    const pipeline = this.redis.pipeline();
    if (sessionIds.length > 0) {
      const keys = sessionIds.map((id) => `hs_session:${id}`);
      pipeline.del(...keys);
    }
    pipeline.del(userSessionsKey);
    await pipeline.exec();
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (err: unknown) {
      this.logger.warn(`Redis ping failed: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  get client(): Redis {
    return this.redis;
  }
}

