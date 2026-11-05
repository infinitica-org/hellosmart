import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import {
  IS_PUBLIC_KEY,
  AuthenticatedUser,
} from '../constants/auth.constants.js';
import { SessionService } from '../../modules/session/session.service.js';
import { extractRawSessionToken } from '../../modules/session/session-cookie.js';
import { DatabaseService } from '../database/database.service.js';
import { ProblemDetailsException } from '../exceptions/problem-details.exception.js';

export const REQUEST_USER_KEY = 'user';
const STATUS_CACHE_TTL_MS = 30_000;

function requestPath(request: FastifyRequest): string {
  const raw = request.url ?? '';
  return raw.split('?')[0] ?? '';
}

function pathAllowedDuringPasswordReset(path: string): boolean {
  return (
    path.endsWith('/me') ||
    path.includes('/auth/password/change') ||
    path.includes('/auth/logout')
  );
}

function pathAllowedDuringMfaEnrollment(path: string): boolean {
  return (
    path.endsWith('/me') ||
    path.includes('/auth/mfa') ||
    path.includes('/auth/logout') ||
    path.includes('/auth/password/change')
  );
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
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const sessionToken = extractRawSessionToken(request);

    if (!sessionToken) {
      throw ProblemDetailsException.unauthorized(
        'Authentication is required. Missing or empty hs_session cookie.',
        'AUTH_REQUIRED',
      );
    }

    let sessionData;
    try {
      sessionData = await this.sessionService.resolveSession(sessionToken);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(`Session store failure during session verification: ${message}`);
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

    const now = Date.now();
    const cacheFresh =
      Boolean(sessionData.statusCachedAt) &&
      now - (sessionData.statusCachedAt ?? 0) < STATUS_CACHE_TTL_MS &&
      Boolean(sessionData.cachedUserStatus);

    let userStatus: string | null;
    let orgStatus: string | null;
    let mustResetPassword = Boolean(sessionData.mustResetPassword);

    if (cacheFresh) {
      userStatus = sessionData.cachedUserStatus ?? null;
      orgStatus = sessionData.cachedOrgStatus ?? null;
    } else {
      try {
        const status = await this.databaseService.checkAccountStatus(
          sessionData.userId,
          sessionData.orgId,
        );
        userStatus = status.userStatus;
        orgStatus = status.orgStatus;
        mustResetPassword = Boolean(status.mustResetPassword);
        await this.sessionService.cacheAccountStatus(sessionToken, status);
      } catch (err: unknown) {
        if (err instanceof ProblemDetailsException) {
          throw err;
        }
        const message = err instanceof Error ? err.message : 'unknown error';
        this.logger.error(`Database error during suspension check: ${message}`);
        throw ProblemDetailsException.serviceUnavailable(
          'Account status verification is currently unavailable.',
          'ACCOUNT_CHECK_UNAVAILABLE',
        );
      }
    }

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

    const path = requestPath(request);

    if (mustResetPassword && !pathAllowedDuringPasswordReset(path)) {
      throw ProblemDetailsException.forbidden(
        'Password reset is required before continuing.',
        'PASSWORD_RESET_REQUIRED',
      );
    }

    if (sessionData.role === 'platform_admin' && sessionData.mfaVerified !== true) {
      if (!pathAllowedDuringMfaEnrollment(path)) {
        throw ProblemDetailsException.forbidden(
          'Multi-factor authentication is required.',
          'MFA_REQUIRED',
        );
      }
    }

    const user: AuthenticatedUser = {
      userId: sessionData.userId,
      orgId: sessionData.orgId,
      role: sessionData.role,
      email: sessionData.email,
    };

    request.user = user;
    (request as AuthenticatedRequest)[REQUEST_USER_KEY] = user;
    (request.raw as { user?: AuthenticatedUser })[REQUEST_USER_KEY] = user;
    (request.raw as { user?: AuthenticatedUser }).user = user;
    (request as { session?: typeof sessionData }).session = sessionData;

    return true;
  }
}
