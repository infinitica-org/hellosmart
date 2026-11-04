import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SessionGuard, REQUEST_USER_KEY } from '../session.guard.js';
import { RolesGuard } from '../roles.guard.js';
import { OrgScopeGuard } from '../org-scope.guard.js';
import { ProblemDetailsException } from '../../exceptions/problem-details.exception.js';
import { ProblemDetailsFilter } from '../../exceptions/problem-details.filter.js';
import { SessionService, COOKIE_HOST_SESSION_NAME, COOKIE_SESSION_NAME } from '../../../modules/session/session.service.js';
import { DatabaseService } from '../../database/database.service.js';
import {
  IS_PUBLIC_KEY,
  ROLES_KEY,
  SessionData,
} from '../../constants/auth.constants.js';
import { Public } from '../../decorators/public.decorator.js';
import { Roles } from '../../decorators/roles.decorator.js';

describe('Auth & Role Guards Suite (Subtask 9.1)', () => {
  let reflector: Reflector;
  let sessionService: SessionService;
  let databaseService: DatabaseService;
  let sessionGuard: SessionGuard;
  let rolesGuard: RolesGuard;

  const mockValidSession: any = {
    id: '33333333-3333-3333-3333-333333333333',
    sessionId: '33333333-3333-3333-3333-333333333333',
    user: {
      userId: '11111111-1111-1111-1111-111111111111',
      orgId: '22222222-2222-2222-2222-222222222222',
      role: 'company_admin',
      email: 'admin@acme.corp',
    },
    userId: '11111111-1111-1111-1111-111111111111',
    orgId: '22222222-2222-2222-2222-222222222222',
    role: 'company_admin',
    email: 'admin@acme.corp',
    createdAt: Date.now(),
    lastSeenAt: Date.now(),
    absoluteExpiresAt: Date.now() + 3600000,
  };

  const createMockContext = (options: {
    isPublic?: boolean;
    roles?: string[];
    cookies?: Record<string, string>;
    headers?: Record<string, string>;
    user?: any;
  }): ExecutionContext => {
      const req: any = {
        cookies: options.cookies || {},
        headers: options.headers || {},
        url: '/api/v1/protected-resource',
        params: {},
        query: {},
        body: {},
      raw: {
        cookies: options.cookies || {},
      },
      user: options.user,
    };

    const res: any = {
      status: vi.fn().mockReturnThis(),
      header: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    return {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    reflector = new Reflector();
    sessionService = {
      resolveSession: vi.fn(),
      cacheAccountStatus: vi.fn().mockResolvedValue(undefined),
      markMfaVerified: vi.fn().mockResolvedValue(undefined),
    } as unknown as SessionService;
    databaseService = new DatabaseService();

    // Default mock behavior for DatabaseService: active user and active org
    databaseService.setStatusChecker(async () => ({
      userStatus: 'active',
      orgStatus: 'paid_active',
    }));

    sessionGuard = new SessionGuard(reflector, sessionService, databaseService);
    rolesGuard = new RolesGuard(reflector);
  });

  describe('SessionGuard', () => {
    it('allows access to routes marked with @Public() without a session cookie', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === IS_PUBLIC_KEY) return true;
        return undefined;
      });

      const ctx = createMockContext({ isPublic: true });
      const canActivate = await sessionGuard.canActivate(ctx);

      expect(canActivate).toBe(true);
    });

    it('returns 401 Unauthorized when hs_session cookie is missing', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      const ctx = createMockContext({ cookies: {} });

      await expect(sessionGuard.canActivate(ctx)).rejects.toThrowError(
        ProblemDetailsException,
      );

      try {
        await sessionGuard.canActivate(ctx);
      } catch (err: any) {
        expect(err.problem.status).toBe(401);
        expect(err.problem.code).toBe('AUTH_REQUIRED');
      }
    });

    it('strictly rejects Authorization: Bearer fallback when hs_session cookie is missing', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      // Sending Bearer header without the HttpOnly cookie
      const ctx = createMockContext({
        cookies: {},
        headers: { authorization: 'Bearer some-jwt-or-token' },
      });

      await expect(sessionGuard.canActivate(ctx)).rejects.toThrowError(
        ProblemDetailsException,
      );

      try {
        await sessionGuard.canActivate(ctx);
      } catch (err: any) {
        expect(err.problem.status).toBe(401);
        expect(err.problem.code).toBe('AUTH_REQUIRED');
      }
    });

    it('returns 503 Service Unavailable (fails closed) when session store is down or throws error', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      vi.spyOn(sessionService, 'resolveSession').mockRejectedValue(
        new Error('ECONNREFUSED 127.0.0.1:6379'),
      );

      const ctx = createMockContext({
        cookies: { [COOKIE_SESSION_NAME]: 'valid-looking-token' },
      });

      try {
        await sessionGuard.canActivate(ctx);
        expect.unreachable('Should have thrown 503');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ProblemDetailsException);
        expect(err.problem.status).toBe(503);
        expect(err.problem.code).toBe('SESSION_STORE_UNAVAILABLE');
      }
    });

    it('returns 401 Unauthorized when session token is expired or not found', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      vi.spyOn(sessionService, 'resolveSession').mockResolvedValue(null);

      const ctx = createMockContext({
        cookies: { [COOKIE_SESSION_NAME]: 'expired-token' },
      });

      try {
        await sessionGuard.canActivate(ctx);
        expect.unreachable('Should have thrown 401');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ProblemDetailsException);
        expect(err.problem.status).toBe(401);
        expect(err.problem.code).toBe('SESSION_EXPIRED');
      }
    });

    it('returns 403 Forbidden when the user is suspended (even if session is active)', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      vi.spyOn(sessionService, 'resolveSession').mockResolvedValue(mockValidSession);
      databaseService.setStatusChecker(async () => ({
        userStatus: 'suspended',
        orgStatus: 'paid_active',
      }));

      const ctx = createMockContext({
        cookies: { [COOKIE_SESSION_NAME]: 'active-token-for-suspended-user' },
      });

      try {
        await sessionGuard.canActivate(ctx);
        expect.unreachable('Should have thrown 403');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ProblemDetailsException);
        expect(err.problem.status).toBe(403);
        expect(err.problem.code).toBe('USER_SUSPENDED');
      }
    });

    it('returns 403 Forbidden when the organization is suspended (even if session is active)', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      vi.spyOn(sessionService, 'resolveSession').mockResolvedValue(mockValidSession);
      databaseService.setStatusChecker(async () => ({
        userStatus: 'active',
        orgStatus: 'suspended',
      }));

      const ctx = createMockContext({
        cookies: { [COOKIE_SESSION_NAME]: 'active-token-for-suspended-org' },
      });

      try {
        await sessionGuard.canActivate(ctx);
        expect.unreachable('Should have thrown 403');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ProblemDetailsException);
        expect(err.problem.status).toBe(403);
        expect(err.problem.code).toBe('ORGANIZATION_SUSPENDED');
      }
    });

    it('attaches user to request and permits access when session and account are active', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      vi.spyOn(sessionService, 'resolveSession').mockResolvedValue(mockValidSession);
      databaseService.setStatusChecker(async () => ({
        userStatus: 'active',
        orgStatus: 'paid_active',
      }));

      const ctx = createMockContext({
        cookies: { [COOKIE_SESSION_NAME]: 'valid-token' },
      });

      const allowed = await sessionGuard.canActivate(ctx);
      expect(allowed).toBe(true);

      const req = ctx.switchToHttp().getRequest<any>();
      expect(req.user).toEqual({
        userId: mockValidSession.userId,
        orgId: mockValidSession.orgId,
        role: mockValidSession.role,
        email: mockValidSession.email,
      });
    });

    it('blocks platform_admin sessions that are not MFA-verified', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      vi.spyOn(sessionService, 'resolveSession').mockResolvedValue({
        ...mockValidSession,
        role: 'platform_admin',
        orgId: null,
        mfaVerified: false,
      });

      const ctx = createMockContext({
        cookies: { [COOKIE_SESSION_NAME]: 'admin-token' },
      });

      try {
        await sessionGuard.canActivate(ctx);
        expect.unreachable('Should have thrown 403');
      } catch (err: any) {
        expect(err.problem.code).toBe('MFA_REQUIRED');
      }
    });

    it('blocks authenticated users who must reset their password', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      vi.spyOn(sessionService, 'resolveSession').mockResolvedValue(mockValidSession);
      databaseService.setStatusChecker(async () => ({
        userStatus: 'active',
        orgStatus: 'paid_active',
        mustResetPassword: true,
      }));

      const ctx = createMockContext({
        cookies: { [COOKIE_SESSION_NAME]: 'reset-token' },
      });

      try {
        await sessionGuard.canActivate(ctx);
        expect.unreachable('Should have thrown 403');
      } catch (err: any) {
        expect(err.problem.code).toBe('PASSWORD_RESET_REQUIRED');
      }
    });

    it('attaches user to request when authenticated via __Host-hs_session cookie', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      vi.spyOn(sessionService, 'resolveSession').mockResolvedValue(mockValidSession);
      databaseService.setStatusChecker(async () => ({
        userStatus: 'active',
        orgStatus: 'paid_active',
      }));

      const ctx = createMockContext({
        cookies: { [COOKIE_HOST_SESSION_NAME]: 'valid-host-token' },
      });

      const allowed = await sessionGuard.canActivate(ctx);
      expect(allowed).toBe(true);

      const req = ctx.switchToHttp().getRequest<any>();
      expect(req.user).toEqual({
        userId: mockValidSession.userId,
        orgId: mockValidSession.orgId,
        role: mockValidSession.role,
        email: mockValidSession.email,
      });
    });
  });

  describe('RolesGuard', () => {
    it('allows access to routes marked with @Public()', () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === IS_PUBLIC_KEY) return true;
        return undefined;
      });

      const ctx = createMockContext({});
      expect(rolesGuard.canActivate(ctx)).toBe(true);
    });

    it('allows access when no @Roles(...) metadata is defined on the route', () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === IS_PUBLIC_KEY) return false;
        if (key === ROLES_KEY) return undefined;
        return undefined;
      });

      const ctx = createMockContext({ user: mockValidSession });
      expect(rolesGuard.canActivate(ctx)).toBe(true);
    });

    it('allows access when user role matches @Roles(...) metadata', () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === IS_PUBLIC_KEY) return false;
        if (key === ROLES_KEY) return ['company_admin', 'platform_admin'];
        return undefined;
      });

      const ctx = createMockContext({
        user: { ...mockValidSession, role: 'company_admin' },
      });
      expect(rolesGuard.canActivate(ctx)).toBe(true);
    });

    it('returns 403 Forbidden with RFC 7807 body when candidate tries to access platform_admin route', () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === IS_PUBLIC_KEY) return false;
        if (key === ROLES_KEY) return ['platform_admin'];
        return undefined;
      });

      const ctx = createMockContext({
        user: { ...mockValidSession, role: 'candidate' },
      });

      try {
        rolesGuard.canActivate(ctx);
        expect.unreachable('Should have thrown 403');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ProblemDetailsException);
        expect(err.problem.status).toBe(403);
        expect(err.problem.code).toBe('ROLE_FORBIDDEN');
      }
    });

    it('returns 403 Forbidden when candidate tries to access company_admin route', () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === IS_PUBLIC_KEY) return false;
        if (key === ROLES_KEY) return ['company_admin'];
        return undefined;
      });

      const ctx = createMockContext({
        user: { ...mockValidSession, role: 'candidate' },
      });

      try {
        rolesGuard.canActivate(ctx);
        expect.unreachable('Should have thrown 403');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ProblemDetailsException);
        expect(err.problem.status).toBe(403);
        expect(err.problem.code).toBe('ROLE_FORBIDDEN');
      }
    });
  });

  describe('ProblemDetailsFilter (RFC 7807 formatting)', () => {
    it('formats ProblemDetailsException as application/problem+json', () => {
      const filter = new ProblemDetailsFilter();

      const sendMock = vi.fn();
      const headerMock = vi.fn().mockReturnThis();
      const statusMock = vi.fn().mockReturnThis();

      const host: any = {
        switchToHttp: () => ({
          getRequest: () => ({ url: '/api/v1/admin/users' }),
          getResponse: () => ({
            status: statusMock,
            header: headerMock,
            send: sendMock,
          }),
        }),
      };

      const exception = ProblemDetailsException.forbidden('Access denied', 'ROLE_FORBIDDEN');
      filter.catch(exception, host);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(headerMock).toHaveBeenCalledWith('content-type', 'application/problem+json');
      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'https://hellosmart.ai/errors/role-forbidden',
          title: 'Forbidden',
          status: 403,
          detail: 'Access denied',
          code: 'ROLE_FORBIDDEN',
          instance: '/api/v1/admin/users',
        }),
      );
    });
  });

  describe('Decorators (@Public, @Roles)', () => {
    it('@Public sets isPublic metadata to true', () => {
      class TestController {
        @Public()
        testEndpoint() {}
      }
      const instance = new TestController();
      const metadata = Reflect.getMetadata(IS_PUBLIC_KEY, instance.testEndpoint);
      expect(metadata).toBe(true);
    });

    it('test(BR-01): OrgScopeGuard returns 404 when body org_id does not match session', () => {
      const orgGuard = new OrgScopeGuard(reflector);
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      const ctx = createMockContext({
        user: {
          userId: mockValidSession.userId,
          orgId: mockValidSession.orgId,
          role: 'company_admin',
          email: mockValidSession.email,
        },
      });
      const req = ctx.switchToHttp().getRequest<any>();
      req[REQUEST_USER_KEY] = req.user;
      req.body = { org_id: '00000000-0000-4000-8000-000000000099' };
      expect(() => orgGuard.canActivate(ctx)).toThrow();
    });

    it('@Roles sets roles array metadata', () => {
      class TestController {
        @Roles('platform_admin', 'company_admin')
        adminEndpoint() {}
      }
      const instance = new TestController();
      const metadata = Reflect.getMetadata(ROLES_KEY, instance.adminEndpoint);
      expect(metadata).toEqual(['platform_admin', 'company_admin']);
    });
  });
});

