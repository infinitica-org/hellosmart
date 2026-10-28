/** Minimal surface used by session/idempotency stores and health checks. */
export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { EX: number }): Promise<unknown>;
  del(key: string): Promise<number>;
  incr(key: string): Promise<number>;
  sAdd(key: string, member: string): Promise<number>;
  sMembers(key: string): Promise<string[]>;
  expire(key: string, seconds: number): Promise<boolean>;
  ping(): Promise<string>;
  isOpen: boolean;
  quit(): Promise<string>;
}

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');
export type HelloRedisClient = RedisLike | null;
