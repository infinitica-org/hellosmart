import type { FastifyReply } from 'fastify';
import type { Config } from '../../config/config.js';
import {
  COOKIE_HOST_SESSION_NAME,
  COOKIE_SESSION_NAME,
  SessionService,
  SESSION_TTL_SECONDS,
} from '../session/session.service.js';

export function setSessionCookie(reply: FastifyReply, config: Config, rawToken: string): void {
  const cookieName = SessionService.cookieName(config);
  reply.setCookie(cookieName, rawToken, {
    path: '/',
    httpOnly: true,
    secure: config.NODE_ENV !== 'development' && config.NODE_ENV !== 'test',
    sameSite: 'lax',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(COOKIE_SESSION_NAME, { path: '/' });
  reply.clearCookie(COOKIE_HOST_SESSION_NAME, { path: '/', secure: true });
}
