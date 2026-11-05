import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyReply } from 'fastify';
import { createHash } from 'node:crypto';
import { Observable, of, tap, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { IS_PUBLIC_KEY } from '../constants/auth.constants.js';
import { problem } from '../errors/app-http.exception.js';
import { IDEMPOTENCY_STORE } from '../../modules/session/session.tokens.js';
import type { IdempotencyStore } from '../../modules/session/session.types.js';
import { REQUEST_USER_KEY, type AuthenticatedRequest } from '../guards/session.guard.js';
import { SKIP_IDEMPOTENCY_KEY } from '../decorators/skip-idempotency.decorator.js';

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;
const IN_FLIGHT_TTL_SECONDS = 60;

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    @Inject(IDEMPOTENCY_STORE) private readonly store: IdempotencyStore,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const reply = context.switchToHttp().getResponse<FastifyReply>();

    const method = request.method?.toUpperCase() ?? 'GET';
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return next.handle();
    }

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_IDEMPOTENCY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) {
      return next.handle();
    }

    const path = (request.url ?? '').split('?')[0] ?? '';
    if (path.includes('/auth/')) {
      return next.handle();
    }

    const user = request[REQUEST_USER_KEY];
    const requiresKey = user?.role === 'company_admin' || user?.role === 'platform_admin';
    const keyHeader = request.headers['idempotency-key'];
    const idempotencyKey = typeof keyHeader === 'string' ? keyHeader.trim() : '';

    if (!idempotencyKey) {
      if (requiresKey) {
        throw problem({
          title: 'Bad Request',
          status: 400,
          detail: 'Idempotency-Key is required for this request',
          code: 'IDEMPOTENCY_KEY_REQUIRED',
        });
      }
      return next.handle();
    }

    const orgPart = user?.orgId ?? 'platform';
    const userPart = user?.userId ?? 'anonymous';
    const fingerprint = createHash('sha256')
      .update(`${method}:${path}:${idempotencyKey}`)
      .digest('hex')
      .slice(0, 32);
    const cacheKey = `idem:${orgPart}:${userPart}:${fingerprint}`;

    const cached = await this.store.get(cacheKey);
    if (cached?.state === 'pending') {
      throw problem({
        title: 'Conflict',
        status: 409,
        detail: 'A request with this Idempotency-Key is already in progress',
        code: 'IDEMPOTENCY_IN_PROGRESS',
      });
    }
    if (cached && cached.statusCode < 500) {
      void reply
        .status(cached.statusCode)
        .header('content-type', cached.contentType)
        .header('x-idempotent-replayed', 'true')
        .send(cached.body);
      return of(undefined);
    }

    if (this.store.setNx) {
      const locked = await this.store.setNx(
        cacheKey,
        {
          state: 'pending',
          statusCode: 0,
          body: '',
          contentType: 'application/json',
          expiresAt: Date.now() + IN_FLIGHT_TTL_SECONDS * 1000,
        },
        IN_FLIGHT_TTL_SECONDS,
      );
      if (!locked) {
        const raced = await this.store.get(cacheKey);
        if (raced && raced.state !== 'pending' && raced.statusCode < 500) {
          void reply
            .status(raced.statusCode)
            .header('content-type', raced.contentType)
            .header('x-idempotent-replayed', 'true')
            .send(raced.body);
          return of(undefined);
        }
        throw problem({
          title: 'Conflict',
          status: 409,
          detail: 'A request with this Idempotency-Key is already in progress',
          code: 'IDEMPOTENCY_IN_PROGRESS',
        });
      }
    }

    return next.handle().pipe(
      tap((body) => {
        const statusCode = reply.statusCode || 200;
        if (statusCode >= 500) {
          void this.store.delete?.(cacheKey);
          return;
        }
        const contentType =
          (reply.getHeader('content-type') as string | undefined) ?? 'application/json';
        const serialized = typeof body === 'string' ? body : JSON.stringify(body ?? {});
        void this.store.set(
          cacheKey,
          {
            state: 'complete',
            statusCode,
            body: serialized,
            contentType,
            expiresAt: Date.now() + IDEMPOTENCY_TTL_SECONDS * 1000,
          },
          IDEMPOTENCY_TTL_SECONDS,
        );
      }),
      catchError((err) => {
        void this.store.delete?.(cacheKey);
        return throwError(() => err);
      }),
    );
  }
}
