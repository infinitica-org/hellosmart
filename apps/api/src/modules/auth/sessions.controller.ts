import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  LogoutAllResponseSchema,
  RevokeSessionResponseSchema,
  SessionListResponseSchema,
} from '@hs/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { problem } from '../../common/errors/app-http.exception.js';
import {
  AuthenticatedRequest,
  REQUEST_USER_KEY,
} from '../../common/guards/session.guard.js';
import { SessionService } from '../session/session.service.js';
import { extractRawSessionToken } from '../session/session-cookie.js';
import { clearSessionCookie } from './auth.cookies.js';

export function extractRawToken(request: FastifyRequest): string | undefined {
  return extractRawSessionToken(request);
}

@Roles('platform_admin', 'company_admin', 'candidate')
@Controller('auth')
export class SessionsController {
  constructor(
    @Inject(SessionService) private readonly sessionService: SessionService,
  ) {}

  @SkipThrottle()
  @Get('sessions')
  async listSessions(@Req() request: AuthenticatedRequest) {
    const user = request[REQUEST_USER_KEY];
    const currentToken = extractRawToken(request);
    const sessions = await this.sessionService.listUserSessions(user.userId, currentToken);
    return SessionListResponseSchema.parse({ sessions });
  }

  @Delete('sessions/:id')
  async revokeSession(
    @Param('id') sessionId: string,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const user = request[REQUEST_USER_KEY];
    const currentToken = extractRawToken(request);

    // Validate that target session exists and belongs to current user
    const userSessions = await this.sessionService.listUserSessions(user.userId, currentToken);
    const target = userSessions.find((s) => s.sessionId === sessionId);

    if (!target) {
      throw problem({
        title: 'Not Found',
        status: 404,
        detail: 'Session not found',
        code: 'SESSION_NOT_FOUND',
      });
    }

    await this.sessionService.revokeSessionByPublicId(user.userId, sessionId);

    // If revoking current session, clear cookie
    if (target.current) {
      clearSessionCookie(reply);
    }

    return RevokeSessionResponseSchema.parse({
      success: true,
      message: 'Session revoked successfully',
    });
  }

  @HttpCode(200)
  @Post('logout-all')
  async logoutAll(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const user = request[REQUEST_USER_KEY];
    await this.sessionService.revokeAllSessionsForUser(user.userId);
    clearSessionCookie(reply);
    return LogoutAllResponseSchema.parse({
      success: true,
      message: 'All sessions logged out successfully',
    });
  }
}
