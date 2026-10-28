import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_SESSION_PREFIX, SessionData } from '../constants/auth.constants.js';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      try {
        this.client = new Redis(redisUrl, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          enableReadyCheck: false,
          retryStrategy: () => null, // Fail fast on connection loss
        });
        this.client.on('error', (err) => {
          this.logger.error(`Redis connection error: ${err.message}`);
        });
      } catch (err: any) {
        this.logger.error(`Failed to initialize Redis client: ${err.message}`);
      }
    }
  }

  /**
   * For testing or injecting a mock client.
   */
  setClient(client: Redis | null): void {
    this.client = client;
  }

  /**
   * Retrieves session data for the given token.
   * Throws on Redis error so callers can fail closed.
   */
  async getSession(token: string): Promise<SessionData | null> {
    if (!this.client) {
      throw new Error('Redis client not configured or connected');
    }

    const key = `${REDIS_SESSION_PREFIX}${token}`;
    const raw = await this.client.get(key);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as SessionData;
    } catch {
      return null;
    }
  }

  /**
   * Stores session data with an optional TTL in seconds.
   */
  async setSession(token: string, session: SessionData, ttlSeconds = 1800): Promise<void> {
    if (!this.client) {
      throw new Error('Redis client not configured or connected');
    }

    const key = `${REDIS_SESSION_PREFIX}${token}`;
    await this.client.set(key, JSON.stringify(session), 'EX', ttlSeconds);
  }

  /**
   * Deletes a session.
   */
  async deleteSession(token: string): Promise<void> {
    if (!this.client) {
      return;
    }
    const key = `${REDIS_SESSION_PREFIX}${token}`;
    await this.client.del(key);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        this.client.disconnect();
      }
    }
  }
}

