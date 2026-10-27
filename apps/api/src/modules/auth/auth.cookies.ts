import type { FastifyReply } from 'fastify';
import type { Config } from '../../config/config.js';
import { SessionService, SESSION_TTL_SECONDS } from '../session/session.service.js';

export function setSessionCookie(reply: FastifyReply, config: Config, sessionId: string): void {
  reply.setCookie(SessionService.cookieName(), sessionId, {
    path: '/',
    httpOnly: true,
    secure: config.NODE_ENV !== 'development' && config.NODE_ENV !== 'test',
    sameSite: 'lax',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SessionService.cookieName(), { path: '/' });
}
