import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import pg from 'pg';

export interface AccountStatusResult {
  userStatus: string | null;
  orgStatus: string | null;
}

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: pg.Pool | null = null;
  private customStatusChecker: ((userId: string, orgId: string | null) => Promise<AccountStatusResult>) | null = null;

  constructor() {
    const databaseUrl = process.env.DATABASE_URL;
    if (databaseUrl) {
      try {
        this.pool = new pg.Pool({
          connectionString: databaseUrl,
          max: 10,
          idleTimeoutMillis: 30000,
        });
        this.pool.on('error', (err) => {
          this.logger.error(`Postgres pool error: ${err.message}`);
        });
      } catch (err: any) {
        this.logger.error(`Failed to initialize Postgres pool: ${err.message}`);
      }
    }
  }

  /**
   * For testing or injecting a mock status checker.
   */
  setStatusChecker(checker: ((userId: string, orgId: string | null) => Promise<AccountStatusResult>) | null = null): void {
    this.customStatusChecker = checker;
  }

  /**
   * For testing or injecting a mock pool.
   */
  setPool(pool: pg.Pool | null): void {
    this.pool = pool;
  }

  /**
   * Returns the underlying Postgres pool.
   */
  getPool(): pg.Pool | null {
    return this.pool;
  }

  /**
   * Checks out a client from the pool.
   */
  async getClient(): Promise<pg.PoolClient | null> {
    if (!this.pool) {
      return null;
    }
    return this.pool.connect();
  }

  /**
   * Checks whether the user and their associated organization are active or suspended.
   * Uses a single query for maximum performance.
   */
  async checkAccountStatus(userId: string, orgId: string | null): Promise<AccountStatusResult> {
    if (this.customStatusChecker) {
      return this.customStatusChecker(userId, orgId);
    }

    if (!this.pool) {
      // In dev or environments without direct DB connection, default to active
      return { userStatus: 'active', orgStatus: orgId ? 'trial_active' : null };
    }

    try {
      const res = await this.pool.query(
        `SELECT 
           u.status AS user_status,
           o.status AS org_status
         FROM app.users u
         LEFT JOIN app.organizations o ON u.org_id = o.id
         WHERE u.id = $1 AND u.deleted_at IS NULL`,
        [userId],
      );

      if (res.rowCount === 0) {
        return { userStatus: null, orgStatus: null };
      }

      const row = res.rows[0];
      return {
        userStatus: row.user_status,
        orgStatus: row.org_status,
      };
    } catch (err: any) {
      this.logger.error(`Failed to check account status for user ${userId}: ${err.message}`);
      throw err;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
  }
}
