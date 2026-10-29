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
import {
  COOKIE_HOST_SESSION_NAME,
  COOKIE_SESSION_NAME,
  SessionService,
} from '../session/session.service.js';
import { clearSessionCookie } from './auth.cookies.js';

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

export function extractRawToken(request: FastifyRequest): string | undefined {
  const cookies = request.cookies || (request.raw as any)?.cookies || {};
  let hostCookie = cookies[COOKIE_HOST_SESSION_NAME];
  let regularCookie = cookies[COOKIE_SESSION_NAME];

  if (!hostCookie && !regularCookie && typeof request.headers.cookie === 'string') {
    const parsed = parseCookieHeader(request.headers.cookie);
    hostCookie = parsed[COOKIE_HOST_SESSION_NAME];
    regularCookie = parsed[COOKIE_SESSION_NAME];
  }

  if (typeof hostCookie === 'string' && hostCookie.trim().length > 0) {
    return hostCookie.trim();
  }
  if (typeof regularCookie === 'string' && regularCookie.trim().length > 0) {
    return regularCookie.trim();
  }
  const authHeader = request.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }
  return undefined;
}

@Roles('platform_admin', 'company_admin', 'candidate')
@Controller('auth')
export class SessionsController {
  constructor(
    @Inject(SessionService) private readonly sessionService: SessionService,
  ) {}

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
