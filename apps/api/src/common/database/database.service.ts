import { Inject, Injectable, Logger, Optional, type OnModuleDestroy } from '@nestjs/common';
import pg from 'pg';
import { PG_POOL, type PgPool } from '../../modules/database/database.tokens.js';
import { ProblemDetailsException } from '../exceptions/problem-details.exception.js';

export interface AccountStatusResult {
  userStatus: string | null;
  orgStatus: string | null;
  mustResetPassword?: boolean;
}

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: pg.Pool | null = null;
  private customStatusChecker:
    | ((userId: string, orgId: string | null) => Promise<AccountStatusResult>)
    | null = null;

  constructor(@Optional() @Inject(PG_POOL) pool?: PgPool) {
    this.pool = pool ?? null;
  }

  setStatusChecker(
    checker: ((userId: string, orgId: string | null) => Promise<AccountStatusResult>) | null = null,
  ): void {
    this.customStatusChecker = checker;
  }

  setPool(pool: pg.Pool | null): void {
    this.pool = pool;
  }

  getPool(): pg.Pool | null {
    return this.pool;
  }

  async getClient(): Promise<pg.PoolClient | null> {
    if (!this.pool) {
      return null;
    }
    return this.pool.connect();
  }

  async checkAccountStatus(userId: string, orgId: string | null): Promise<AccountStatusResult> {
    if (this.customStatusChecker) {
      return this.customStatusChecker(userId, orgId);
    }

    if (!this.pool) {
      throw ProblemDetailsException.serviceUnavailable(
        'Account status verification is currently unavailable.',
        'ACCOUNT_CHECK_UNAVAILABLE',
      );
    }

    try {
      const res = await this.pool.query(
        `SELECT
           u.status AS user_status,
           u.org_status,
           u.must_reset_password
         FROM app.find_user_by_id($1) AS u
         LIMIT 1`,
        [userId],
      );

      if (res.rowCount === 0 || !res.rows[0]?.user_status) {
        return { userStatus: null, orgStatus: null, mustResetPassword: false };
      }

      const row = res.rows[0] as {
        user_status: string;
        org_status: string | null;
        must_reset_password: boolean | null;
      };
      return {
        userStatus: row.user_status,
        orgStatus: row.org_status ?? null,
        mustResetPassword: Boolean(row.must_reset_password),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to check account status for user ${userId}: ${message}`);
      throw err;
    }
  }

  async onModuleDestroy(): Promise<void> {
    // Pool lifecycle is owned by DatabaseModule / PG_POOL.
  }
}
