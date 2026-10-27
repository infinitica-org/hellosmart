import { Inject, Injectable } from '@nestjs/common';
import { problem } from '../../common/errors/app-http.exception.js';
import { REDIS_CLIENT, type HelloRedisClient } from '../redis/redis.tokens.js';

const FAIL_PREFIX = 'hs:login-fail:';
const LOCK_PREFIX = 'hs:login-lock:';
const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 15 * 60;

interface MemoryLockState {
  failures: number;
  windowStart: number;
  lockedUntil: number;
}

@Injectable()
export class LoginLockoutService {
  private readonly memory = new Map<string, MemoryLockState>();

  constructor(@Inject(REDIS_CLIENT) private readonly redis: HelloRedisClient) {}

  async assertNotLocked(email: string): Promise<void> {
    const normalized = normalizeEmail(email);
    if (this.redis?.isOpen) {
      const locked = await this.redis.get(LOCK_PREFIX + normalized);
      if (locked) {
        throw lockoutError();
      }
      return;
    }
    const state = this.memory.get(normalized);
    if (state && state.lockedUntil > Date.now()) {
      throw lockoutError();
    }
  }

  async recordFailure(email: string): Promise<void> {
    const normalized = normalizeEmail(email);
    if (this.redis?.isOpen) {
      const failKey = FAIL_PREFIX + normalized;
      const count = await this.redis.incr(failKey);
      if (count === 1) {
        await this.redis.expire(failKey, WINDOW_SECONDS);
      }
      if (count >= MAX_ATTEMPTS) {
        await this.redis.set(LOCK_PREFIX + normalized, '1', { EX: WINDOW_SECONDS });
        await this.redis.del(failKey);
      }
      return;
    }
    const now = Date.now();
    let state = this.memory.get(normalized);
    if (!state || now - state.windowStart > WINDOW_SECONDS * 1000) {
      state = { failures: 0, windowStart: now, lockedUntil: 0 };
    }
    state.failures += 1;
    if (state.failures >= MAX_ATTEMPTS) {
      state.lockedUntil = now + WINDOW_SECONDS * 1000;
      state.failures = 0;
    }
    this.memory.set(normalized, state);
  }

  async clearFailures(email: string): Promise<void> {
    const normalized = normalizeEmail(email);
    if (this.redis?.isOpen) {
      await this.redis.del(FAIL_PREFIX + normalized);
      await this.redis.del(LOCK_PREFIX + normalized);
      return;
    }
    this.memory.delete(normalized);
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function lockoutError(): never {
  throw problem({
    title: 'Too Many Requests',
    status: 429,
    detail: 'Too many failed login attempts. Try again later.',
    code: 'LOGIN_LOCKED',
  });
}
