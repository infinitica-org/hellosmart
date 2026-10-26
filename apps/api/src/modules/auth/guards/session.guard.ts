import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { SESSION_COOKIE_NAME } from '../session/session.interface.js';
import { SessionService } from '../session/session.service.js';

export interface FastifyRequestLike {
  cookies?: Record<string, string | undefined>;
  unsignCookie?: (val: string) => { valid: boolean; value: string | null };
  headers: Record<string, string | string[] | undefined>;
  url: string;
  user?: any;
  session?: any;
}

export class SessionUnauthorizedException extends HttpException {
  constructor(detail = 'Authentication is required to access this resource.', requestId?: string) {
    super(
      {
        type: 'https://hellosmart.ai/problems/unauthorized',
        title: 'Unauthorized',
        status: HttpStatus.UNAUTHORIZED,
        detail,
        code: 'UNAUTHORIZED',
        ...(requestId ? { requestId } : {}),
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class PasswordResetRequiredException extends HttpException {
  constructor(requestId?: string) {
    super(
      {
        type: 'https://hellosmart.ai/problems/password-reset-required',
        title: 'Password Reset Required',
        status: HttpStatus.FORBIDDEN,
        detail: 'Password reset is required before accessing protected resources.',
        code: 'PASSWORD_RESET_REQUIRED',
        ...(requestId ? { requestId } : {}),
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

@Injectable()
export class SessionGuard implements CanActivate {
  private readonly logger = new Logger(SessionGuard.name);

  constructor(@Inject(SessionService) private readonly sessionService: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequestLike>();
    const headerReqId = request.headers['x-request-id'];
    const requestId = typeof headerReqId === 'string' ? headerReqId : '';

    let sessionId: string | null = null;

    // 1. Extract from signed cookie
    const rawCookie = request.cookies?.[SESSION_COOKIE_NAME];
    if (rawCookie) {
      if (typeof request.unsignCookie === 'function') {
        const unsigned = request.unsignCookie(rawCookie);
        if (unsigned.valid && unsigned.value) {
          sessionId = unsigned.value;
        } else {
          // Cookie signature is invalid or tampered with
          this.logger.warn(`Tampered or invalid session cookie received for request ${requestId}`);
          throw new SessionUnauthorizedException(
            'Authentication required: invalid or forged session cookie signature.',
            requestId,
          );
        }
      } else {
        sessionId = rawCookie;
      }
    }

    // 2. Fallback to Authorization: Bearer <sessionId>
    const authHeader = request.headers.authorization;
    if (!sessionId && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      sessionId = authHeader.slice(7).trim();
    }

    if (!sessionId) {
      throw new SessionUnauthorizedException(
        'Authentication required: missing or invalid session cookie.',
        requestId,
      );
    }

    const session = await this.sessionService.validateSession(sessionId);
    if (!session) {
      throw new SessionUnauthorizedException(
        'The session is invalid or has expired due to inactivity. Please log in again.',
        requestId,
      );
    }

    // Forced password reset check (BR-24, CA-001, S0-T10)
    // If mustResetPassword is true, user may ONLY hit /me, /auth/password/change, or /auth/logout
    if (session.mustResetPassword) {
      const url = request.url.split('?')[0] || '';
      const allowedPaths = [
        '/api/v1/me',
        '/api/v1/auth/password/change',
        '/api/v1/auth/logout',
        '/me',
        '/auth/password/change',
        '/auth/logout',
      ];

      const isAllowed = allowedPaths.some((p) => url.endsWith(p));
      if (!isAllowed) {
        throw new PasswordResetRequiredException(requestId);
      }
    }

    request.user = session;
    request.session = session;
    return true;
  }
}
