import { Inject, Injectable } from '@nestjs/common';
import { problem } from '../../common/errors/app-http.exception.js';
import { REDIS_CLIENT, type HelloRedisClient } from '../redis/redis.tokens.js';

const FAIL_PREFIX = 'hs:login-fail:';
const LOCK_PREFIX = 'hs:login-lock:';
const IP_FAIL_PREFIX = 'hs:login-fail-ip:';
const IP_LOCK_PREFIX = 'hs:login-lock-ip:';
const MAX_ATTEMPTS_PER_IP = 5;
const MAX_ATTEMPTS_PER_EMAIL = 20;
const WINDOW_SECONDS = 15 * 60;

const RECORD_FAILURE_LUA = `
local failKey = KEYS[1]
local lockKey = KEYS[2]
local maxAttempts = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local count = redis.call('INCR', failKey)
if count == 1 then
  redis.call('EXPIRE', failKey, window)
end
if count >= maxAttempts then
  redis.call('SET', lockKey, '1', 'EX', window)
  redis.call('DEL', failKey)
end
return count
`;

interface MemoryLockState {
  failures: number;
  windowStart: number;
  lockedUntil: number;
}

@Injectable()
export class LoginLockoutService {
  private readonly memory = new Map<string, MemoryLockState>();

  constructor(@Inject(REDIS_CLIENT) private readonly redis: HelloRedisClient) {}

  async assertNotLocked(email: string, ip?: string): Promise<void> {
    const normalized = normalizeEmail(email);
    if (this.redis?.isOpen) {
      const emailLocked = await this.redis.get(LOCK_PREFIX + normalized);
      if (emailLocked) {
        throw lockoutError();
      }
      if (ip) {
        const ipLocked = await this.redis.get(IP_LOCK_PREFIX + `${normalized}:${normalizeIp(ip)}`);
        if (ipLocked) {
          throw lockoutError();
        }
      }
      return;
    }
    if (this.memoryLocked(normalized) || (ip && this.memoryLocked(`${normalized}:${normalizeIp(ip)}`))) {
      throw lockoutError();
    }
  }

  async recordFailure(email: string, ip?: string): Promise<void> {
    const normalized = normalizeEmail(email);
    if (this.redis?.isOpen) {
      await this.redis.eval(RECORD_FAILURE_LUA, {
        keys: [FAIL_PREFIX + normalized, LOCK_PREFIX + normalized],
        arguments: [String(MAX_ATTEMPTS_PER_EMAIL), String(WINDOW_SECONDS)],
      });
      if (ip) {
        const ipKey = `${normalized}:${normalizeIp(ip)}`;
        await this.redis.eval(RECORD_FAILURE_LUA, {
          keys: [IP_FAIL_PREFIX + ipKey, IP_LOCK_PREFIX + ipKey],
          arguments: [String(MAX_ATTEMPTS_PER_IP), String(WINDOW_SECONDS)],
        });
      }
      return;
    }
    this.memoryRecord(normalized, MAX_ATTEMPTS_PER_EMAIL);
    if (ip) {
      this.memoryRecord(`${normalized}:${normalizeIp(ip)}`, MAX_ATTEMPTS_PER_IP);
    }
  }

  async clearFailures(email: string, ip?: string): Promise<void> {
    const normalized = normalizeEmail(email);
    if (this.redis?.isOpen) {
      const keys = [FAIL_PREFIX + normalized, LOCK_PREFIX + normalized];
      if (ip) {
        const ipKey = `${normalized}:${normalizeIp(ip)}`;
        keys.push(IP_FAIL_PREFIX + ipKey, IP_LOCK_PREFIX + ipKey);
      }
      await this.redis.del(keys);
      return;
    }
    for (const key of [...this.memory.keys()]) {
      if (key === normalized || key.startsWith(`${normalized}:`)) {
        this.memory.delete(key);
      }
    }
  }

  private memoryLocked(key: string): boolean {
    const state = this.memory.get(key);
    return Boolean(state && state.lockedUntil > Date.now());
  }

  private memoryRecord(key: string, maxAttempts: number): void {
    const now = Date.now();
    let state = this.memory.get(key);
    if (!state || now - state.windowStart > WINDOW_SECONDS * 1000) {
      state = { failures: 0, windowStart: now, lockedUntil: 0 };
    }
    state.failures += 1;
    if (state.failures >= maxAttempts) {
      state.lockedUntil = now + WINDOW_SECONDS * 1000;
      state.failures = 0;
    }
    this.memory.set(key, state);
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeIp(ip: string): string {
  return ip.trim().toLowerCase();
}

function lockoutError(): never {
  throw problem({
    title: 'Too Many Requests',
    status: 429,
    detail: 'Too many failed login attempts. Try again later.',
    code: 'LOGIN_LOCKED',
  });
}
