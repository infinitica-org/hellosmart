import type { Pool } from 'pg';

export const PG_POOL = Symbol('PG_POOL');
export const PG_PLATFORM_POOL = Symbol('PG_PLATFORM_POOL');
export type PgPool = Pool;
