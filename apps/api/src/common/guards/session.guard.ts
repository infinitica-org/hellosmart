import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { problem } from '../errors/app-http.exception.js';
import type { UserContext } from '../types/user-context.js';
import { SessionService } from '../../modules/session/session.service.js';

export const REQUEST_USER_KEY = 'user';

export type AuthenticatedRequest = FastifyRequest & {
  [REQUEST_USER_KEY]: UserContext;
  requestId?: string;
};

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const sessionId = this.extractSessionId(request);
    const record = await this.sessions.resolveSession(sessionId);
    if (!record) {
      throw problem({
        title: 'Unauthorized',
        status: 401,
        detail: 'Valid session required',
        code: 'UNAUTHORIZED',
      });
    }
    request[REQUEST_USER_KEY] = record.user;
    return true;
  }

  private extractSessionId(request: FastifyRequest): string | undefined {
    const cookieName = SessionService.cookieName();
    const fromCookie = request.cookies?.[cookieName];
    if (typeof fromCookie === 'string' && fromCookie.length > 0) {
      return fromCookie;
    }
    const auth = request.headers.authorization;
    if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
      return auth.slice('Bearer '.length).trim();
    }
    return undefined;
  }
}
