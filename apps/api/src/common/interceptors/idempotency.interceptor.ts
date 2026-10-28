import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Observable, of, tap } from 'rxjs';
import { IDEMPOTENCY_STORE } from '../../modules/session/session.tokens.js';
import type { IdempotencyStore } from '../../modules/session/session.types.js';
import { REQUEST_USER_KEY, type AuthenticatedRequest } from '../guards/session.guard.js';

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(@Inject(IDEMPOTENCY_STORE) private readonly store: IdempotencyStore) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const reply = context.switchToHttp().getResponse<FastifyReply>();

    const method = request.method?.toUpperCase() ?? 'GET';
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const keyHeader = request.headers['idempotency-key'];
    const idempotencyKey = typeof keyHeader === 'string' ? keyHeader : undefined;
    if (!idempotencyKey) {
      return next.handle();
    }

    const user = request[REQUEST_USER_KEY];
    const orgPart = user?.orgId ?? 'platform';
    const userPart = user?.userId ?? 'anonymous';
    const cacheKey = `idem:${orgPart}:${userPart}:${idempotencyKey}`;

    const cached = await this.store.get(cacheKey);
    if (cached) {
      void reply
        .status(cached.statusCode)
        .header('content-type', cached.contentType)
        .header('x-idempotent-replayed', 'true')
        .send(cached.body);
      return of(undefined);
    }

    return next.handle().pipe(
      tap((body) => {
        const statusCode = reply.statusCode || 200;
        const contentType =
          (reply.getHeader('content-type') as string | undefined) ?? 'application/json';
        const serialized = typeof body === 'string' ? body : JSON.stringify(body ?? {});
        void this.store.set(
          cacheKey,
          {
            statusCode,
            body: serialized,
            contentType,
            expiresAt: Date.now() + IDEMPOTENCY_TTL_SECONDS * 1000,
          },
          IDEMPOTENCY_TTL_SECONDS,
        );
      }),
    );
  }
}
