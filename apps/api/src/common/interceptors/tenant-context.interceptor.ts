import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, from, throwError } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import type pg from 'pg';
import { DatabaseService } from '../database/database.service.js';
import { TenantContextService } from '../database/tenant-context.service.js';
import { AuthenticatedUser } from '../constants/auth.constants.js';
import { ProblemDetailsException } from '../exceptions/problem-details.exception.js';

export type ClientFactory = () => Promise<pg.PoolClient | any>;

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TenantContextInterceptor.name);
  private customClientFactory: ClientFactory | null = null;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  /**
   * For testing or injecting a mock pool client.
   */
  setClientFactory(factory: ClientFactory | null): void {
    this.customClientFactory = factory;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<any>();
    const user: AuthenticatedUser | undefined = req.user;

    // Public / unauthenticated route: pass through without database transaction
    if (!user) {
      return next.handle();
    }

    const isPlatform = user.role === 'platform_admin';

    // Non-platform roles strictly require an organization context (fail-closed)
    if (!isPlatform && !user.orgId) {
      throw ProblemDetailsException.forbidden(
        'Tenant context required for non-platform role.',
        'TENANT_REQUIRED',
      );
    }

    const tenantContext = {
      orgId: user.orgId || null,
      role: user.role,
      userId: user.userId,
    };

    // Obtain a client from the custom factory or database pool
    return from(this.acquireClient()).pipe(
      switchMap((client) => {
        if (!client) {
          // No direct pool available: run in-memory context store (e.g. dev mock)
          return new Observable((subscriber) => {
            this.tenantContextService.runWithContext(
              {
                ...tenantContext,
                inTransaction: false,
              },
              () => {
                const sub = next.handle().subscribe(subscriber);
                return () => sub.unsubscribe();
              },
            );
          });
        }

        // Active database transaction execution with fail-closed tenant context
        return from(this.setupTransaction(client, tenantContext)).pipe(
          switchMap(() => {
            req.dbClient = client;
            req.tenantContext = tenantContext;

            return new Observable((subscriber) => {
              this.tenantContextService.runWithContext(
                {
                  ...tenantContext,
                  client,
                  inTransaction: true,
                },
                () => {
                  const sub = next.handle().subscribe({
                    next: (val) => subscriber.next(val),
                    error: async (err) => {
                      try {
                        await client.query('ROLLBACK');
                      } catch (rbErr) {
                        this.logger.error(`Failed to rollback transaction: ${(rbErr as Error).message}`);
                      } finally {
                        this.releaseClient(client);
                      }
                      subscriber.error(err);
                    },
                    complete: async () => {
                      try {
                        await client.query('COMMIT');
                      } catch (commitErr) {
                        this.logger.error(`Failed to commit transaction: ${(commitErr as Error).message}`);
                        subscriber.error(commitErr);
                        return;
                      } finally {
                        this.releaseClient(client);
                      }
                      subscriber.complete();
                    },
                  });

                  return () => sub.unsubscribe();
                },
              );
            });
          }),
        );
      }),
    );
  }

  private async acquireClient(): Promise<pg.PoolClient | any | null> {
    if (this.customClientFactory) {
      return this.customClientFactory();
    }
    const pool = this.databaseService.getPool();
    if (!pool) {
      return null;
    }
    return pool.connect();
  }

  private async setupTransaction(
    client: pg.PoolClient | any,
    context: { orgId: string | null; role: string; userId?: string | null },
  ): Promise<void> {
    try {
      await client.query('BEGIN');
      await this.tenantContextService.setTenantContext(client, context);
    } catch (err: any) {
      this.logger.error(`Fail-closed: tenant context setup failed: ${err.message}`);
      try {
        await client.query('ROLLBACK');
      } catch {}
      this.releaseClient(client);
      throw ProblemDetailsException.internalServerError(
        'TENANT_CONTEXT_FAILED',
        `Failed to establish tenant isolation context: ${err.message}`,
      );
    }
  }

  private releaseClient(client: pg.PoolClient | any): void {
    if (typeof client.release === 'function') {
      try {
        client.release();
      } catch (err) {
        this.logger.error(`Error releasing database client: ${(err as Error).message}`);
      }
    }
  }
}
