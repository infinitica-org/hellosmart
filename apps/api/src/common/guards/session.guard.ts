import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import {
  IS_PUBLIC_KEY,
  AuthenticatedUser,
} from '../constants/auth.constants.js';
import {
  COOKIE_HOST_SESSION_NAME,
  COOKIE_SESSION_NAME,
  SessionService,
} from '../../modules/session/session.service.js';
import { DatabaseService } from '../database/database.service.js';
import { ProblemDetailsException } from '../exceptions/problem-details.exception.js';

export const REQUEST_USER_KEY = 'user';

function parseCookieHeader(header: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const part of header.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx !== -1) {
      const key = part.slice(0, eqIdx).trim();
      const val = part.slice(eqIdx + 1).trim();
      map[key] = decodeURIComponent(val);
    }
  }
  return map;
}

export type AuthenticatedRequest = FastifyRequest & {
  [REQUEST_USER_KEY]: AuthenticatedUser;
  user: AuthenticatedUser;
  requestId?: string;
};

@Injectable()
export class SessionGuard implements CanActivate {
  private readonly logger = new Logger(SessionGuard.name);

  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(SessionService) private readonly sessionService: SessionService,
    @Optional() private readonly databaseService?: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Check if route is marked @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();

    // 2. Cookie validation (Strict security: Cookie ONLY, NO Authorization header fallback)
    // Supports __Host-hs_session (production HTTPS) and hs_session (dev/test)
    const cookies = request.cookies || (request.raw as any)?.cookies || {};
    let sessionToken = cookies[COOKIE_HOST_SESSION_NAME] || cookies[COOKIE_SESSION_NAME];

    if (!sessionToken && typeof request.headers.cookie === 'string') {
      const headerCookies = parseCookieHeader(request.headers.cookie);
      sessionToken = headerCookies[COOKIE_HOST_SESSION_NAME] || headerCookies[COOKIE_SESSION_NAME];
    }

    if (!sessionToken || typeof sessionToken !== 'string' || sessionToken.trim() === '') {
      throw ProblemDetailsException.unauthorized(
        'Authentication is required. Missing or empty hs_session cookie.',
        'AUTH_REQUIRED',
      );
    }

    // 3. Load session from SessionService (Fail-closed on store failure)
    let sessionData;
    try {
      sessionData = await this.sessionService.resolveSession(sessionToken.trim());
    } catch (err: any) {
      this.logger.error(`Session store failure during session verification: ${err.message}`);
      throw ProblemDetailsException.serviceUnavailable(
        'Session verification service is currently unavailable.',
        'SESSION_STORE_UNAVAILABLE',
      );
    }

    if (!sessionData || !sessionData.userId || !sessionData.role) {
      throw ProblemDetailsException.unauthorized(
        'Session is invalid or has expired.',
        'SESSION_EXPIRED',
      );
    }

    // 4. Live user and organization suspension check (if DatabaseService is available)
    if (this.databaseService) {
      try {
        const { userStatus, orgStatus } = await this.databaseService.checkAccountStatus(
          sessionData.userId,
          sessionData.orgId,
        );

        if (userStatus === null) {
          throw ProblemDetailsException.unauthorized(
            'User account not found or has been removed.',
            'USER_NOT_FOUND',
          );
        }

        if (userStatus === 'suspended') {
          throw ProblemDetailsException.forbidden(
            'Your user account is suspended.',
            'USER_SUSPENDED',
          );
        }

        if (userStatus === 'deleted') {
          throw ProblemDetailsException.forbidden(
            'Your user account has been deleted.',
            'USER_DELETED',
          );
        }

        if (sessionData.orgId && orgStatus === 'suspended') {
          throw ProblemDetailsException.forbidden(
            'Your organization is currently suspended.',
            'ORGANIZATION_SUSPENDED',
          );
        }
      } catch (err: any) {
        if (err instanceof ProblemDetailsException) {
          throw err;
        }
        this.logger.error(`Database error during suspension check: ${err.message}`);
        throw ProblemDetailsException.serviceUnavailable(
          'Account status verification is currently unavailable.',
          'ACCOUNT_CHECK_UNAVAILABLE',
        );
      }
    }

    // 5. Attach authenticated user to request
    const user: AuthenticatedUser = {
      userId: sessionData.userId,
      orgId: sessionData.orgId,
      role: sessionData.role,
      email: sessionData.email,
    };

    request.user = user;
    (request as any)[REQUEST_USER_KEY] = user;
    (request.raw as any).user = user;
    (request.raw as any)[REQUEST_USER_KEY] = user;
    (request as any).session = sessionData;

    return true;
  }
}
