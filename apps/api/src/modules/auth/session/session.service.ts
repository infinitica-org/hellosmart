import crypto from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  type CreateSessionInput,
  type Session,
  type SessionStore,
  SESSION_STORE,
  SESSION_COOKIE_NAME,
  ROLE_COOKIE_NAME,
  MUST_RESET_COOKIE_NAME,
  MAX_SESSION_TTL_SECONDS,
  IDLE_TIMEOUT_SECONDS,
  ADMIN_IDLE_TIMEOUT_SECONDS,
} from './session.interface.js';

export interface FastifyReplyLike {
  setCookie(name: string, value: string, options?: any): this;
  clearCookie(name: string, options?: any): this;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(@Inject(SESSION_STORE) private readonly store: SessionStore) {}

  /**
   * Generates a 32-byte cryptographically random hex session ID.
   */
  generateSessionId(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Creates a new session in the store.
   */
  async createSession(input: CreateSessionInput): Promise<Session> {
    const id = this.generateSessionId();
    const now = Date.now();

    const session: Session = {
      id,
      userId: input.userId,
      orgId: input.orgId,
      email: input.email,
      name: input.name,
      role: input.role,
      portal: input.portal,
      mustResetPassword: input.mustResetPassword,
      createdAt: now,
      lastActiveAt: now,
      ip: input.ip,
      userAgent: input.userAgent,
    };

    await this.store.createSession(session, MAX_SESSION_TTL_SECONDS);
    return session;
  }

  /**
   * Validates a session by ID.
   * Checks idle inactivity timeout (30 min regular, 15 min platform admin).
   * Touches session on success to refresh sliding window.
   */
  async validateSession(sessionId: string): Promise<Session | null> {
    if (!sessionId || typeof sessionId !== 'string') {
      return null;
    }

    const session = await this.store.getSession(sessionId);
    if (!session) {
      return null;
    }

    // Inactivity timeout check (CLAUDE.md: idle 30 min, admin 15 min)
    const idleLimitSeconds =
      session.role === 'platform_admin' ? ADMIN_IDLE_TIMEOUT_SECONDS : IDLE_TIMEOUT_SECONDS;
    const idleLimitMs = idleLimitSeconds * 1000;

    if (Date.now() - session.lastActiveAt > idleLimitMs) {
      this.logger.debug(`Session ${sessionId.slice(0, 8)} expired due to inactivity.`);
      await this.store.destroySession(sessionId);
      return null;
    }

    // Refresh sliding window
    await this.store.touchSession(sessionId, MAX_SESSION_TTL_SECONDS);
    return session;
  }

  /**
   * Revokes a single session.
   */
  async revokeSession(sessionId: string): Promise<void> {
    await this.store.destroySession(sessionId);
  }

  /**
   * Revokes all active sessions for a user (e.g. on password change, account takeover response).
   */
  async revokeAllUserSessions(userId: string): Promise<void> {
    await this.store.destroyUserSessions(userId);
  }

  /**
   * Sets signed session cookie and routing hint cookies on the HTTP reply.
   */
  setSessionCookies(reply: FastifyReplyLike, session: Session, isSecure = false): void {
    // 1. Signed, HttpOnly session cookie
    reply.setCookie(SESSION_COOKIE_NAME, session.id, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      signed: true,
      maxAge: MAX_SESSION_TTL_SECONDS,
    });

    // 2. Non-sensitive routing hint cookie for Next.js middleware (BR-25 coarse routing)
    reply.setCookie(ROLE_COOKIE_NAME, session.role, {
      httpOnly: false,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: MAX_SESSION_TTL_SECONDS,
    });

    // 3. Reset-required hint cookie
    reply.setCookie(MUST_RESET_COOKIE_NAME, session.mustResetPassword ? 'true' : 'false', {
      httpOnly: false,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: MAX_SESSION_TTL_SECONDS,
    });
  }

  /**
   * Clears session cookies on logout or revocation.
   */
  clearSessionCookies(reply: FastifyReplyLike, isSecure = false): void {
    reply.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      signed: true,
    });
    reply.clearCookie(ROLE_COOKIE_NAME, {
      httpOnly: false,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
    });
    reply.clearCookie(MUST_RESET_COOKIE_NAME, {
      httpOnly: false,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
    });
  }
}
