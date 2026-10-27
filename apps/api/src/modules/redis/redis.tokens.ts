/** Minimal surface used by session/idempotency stores and health checks. */
export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { EX: number }): Promise<unknown>;
  del(key: string): Promise<number>;
  ping(): Promise<string>;
  isOpen: boolean;
  quit(): Promise<string>;
}

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');
export type HelloRedisClient = RedisLike | null;
