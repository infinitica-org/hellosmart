import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { tap } from 'rxjs';
import type { Observable } from 'rxjs';
import { REQUEST_USER_KEY, type AuthenticatedRequest } from '../guards/session.guard.js';

export const AUDIT_ACTION_KEY = 'audit_action';

export interface AuditActionMeta {
  action: string;
  entity: string;
}

/**
 * Marks a route whose success should be visible to operators.
 * The durable BR-31 write still happens inside the service transaction via AuditService.record.
 * This interceptor only attaches the intended action to the request so logs and tests can see it
 * without opening a second transaction after the handler has already committed.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.getAllAndOverride<AuditActionMeta | undefined>(AUDIT_ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!meta) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest & { auditAction?: AuditActionMeta }>();
    request.auditAction = meta;
    const actor = request[REQUEST_USER_KEY];

    return next.handle().pipe(
      tap(() => {
        request.auditAction = {
          action: meta.action,
          entity: meta.entity,
          ...(actor?.userId ? {} : {}),
        };
      }),
    );
  }
}
