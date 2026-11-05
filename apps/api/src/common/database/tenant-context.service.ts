import { Injectable, Logger } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import type pg from 'pg';

export interface TenantContext {
  orgId?: string | null;
  role: string;
  userId?: string | null;
}

export interface TenantContextStore extends TenantContext {
  client?: pg.PoolClient | any;
  inTransaction?: boolean;
}

@Injectable()
export class TenantContextService {
  private readonly logger = new Logger(TenantContextService.name);
  private readonly als = new AsyncLocalStorage<TenantContextStore>();

  /**
   * Sets database-level session variables inside an active transaction.
   * Enforces SET LOCAL app.current_org_id and app.current_role before any subsequent query.
   * Fail closed: if parameters are missing or setting fails, an exception is thrown.
   */
  async setTenantContext(client: pg.PoolClient | any, context: TenantContext): Promise<void> {
    try {
      if (context.role === 'platform_admin') {
        await client.query(`SELECT set_config('app.current_role', $1, true)`, ['platform_admin']);
        await client.query(`SELECT set_config('app.is_platform', $1, true)`, ['true']);
      } else {
        if (!context.orgId) {
          throw new Error('Tenant context required: orgId cannot be null for non-platform role');
        }
        await client.query(`SELECT set_config('app.current_org_id', $1, true)`, [context.orgId]);
        await client.query(`SELECT set_config('app.org_id', $1, true)`, [context.orgId]);
        await client.query(`SELECT set_config('app.current_role', $1, true)`, [context.role]);
      }
    } catch (err: any) {
      this.logger.error(`Failed to set tenant context in transaction: ${err.message}`);
      throw err;
    }
  }

  /**
   * Runs an operation with the given tenant context store using AsyncLocalStorage.
   */
  runWithContext<T>(store: TenantContextStore, fn: () => T): T {
    return this.als.run(store, fn);
  }

  /**
   * Gets the current tenant context store from AsyncLocalStorage.
   */
  getContext(): TenantContextStore | undefined {
    return this.als.getStore();
  }

  /**
   * Gets the active database client/transaction from the current execution context.
   */
  getCurrentClient(): pg.PoolClient | any | undefined {
    return this.als.getStore()?.client;
  }

  /**
   * Executes a callback within a managed tenant-isolated database transaction.
   */
  async withTenantTransaction<T>(
    client: pg.PoolClient | any,
    context: TenantContext,
    fn: (txClient: pg.PoolClient | any) => Promise<T>,
  ): Promise<T> {
    await client.query('BEGIN');
    try {
      await this.setTenantContext(client, context);
      const result = await this.runWithContext(
        {
          ...context,
          client,
          inTransaction: true,
        },
        () => fn(client),
      );
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  }
}
