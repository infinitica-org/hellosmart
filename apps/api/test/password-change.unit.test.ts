import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AuthController } from '../src/modules/auth/auth.controller.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { PasswordPolicyService } from '../src/modules/auth/password-policy.service.js';
import { SessionService } from '../src/modules/session/session.service.js';
import { hashPassword } from '../src/modules/auth/password.js';
import type { Config } from '../src/config/config.js';
import type { UserContext } from '../src/common/types/user-context.js';
import { HttpException } from '@nestjs/common';

describe('Password Change (unit)', () => {
  let controller: AuthController;
  let authService: AuthService;
  let sessionService: SessionService;
  let passwordPolicy: PasswordPolicyService;
  let mockPool: any;
  let mockClient: any;
  let mockConfig: Config;

  const mockUser: UserContext = {
    userId: '11111111-2222-3333-4444-555555555555',
    email: 'admin@asterridge.com',
    role: 'company_admin',
    orgId: '43598d97-152e-5fe9-95e5-f55db8858a7f',
  };

  beforeEach(() => {
    mockConfig = {
      NODE_ENV: 'test',
      PORT: 4000,
      DATABASE_URL: 'postgres://localhost:5432/test',
      SESSION_SECRET: 'test-session-secret-32-bytes-minimum!!',
      CORS_ORIGINS: ['http://localhost:3000'],
      PAYMENT_GATEWAY: 'fake',
      EMAIL_PROVIDER: 'fake',
      WORKSPACE_RUNTIME: 'fake',
      HIBP_FAIL_OPEN: true,
    };

    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };

    mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
    };

    sessionService = {
      revokeOtherSessionsForUser: vi.fn().mockResolvedValue(undefined),
      revokeAllSessionsForUser: vi.fn().mockResolvedValue(undefined),
    } as any;

    passwordPolicy = {
      evaluateLocal: vi.fn(),
      checkBreached: vi.fn().mockResolvedValue({ breached: false }),
      checkHistory: vi.fn().mockResolvedValue({ reused: false }),
      recordPasswordHistory: vi.fn().mockResolvedValue(undefined),
    } as any;

    authService = new AuthService(
      mockPool,
      sessionService,
      {} as any,
      {} as any,
      {} as any,
      passwordPolicy,
    );

    controller = new AuthController(authService, mockConfig);
  });

  describe('AuthController.changePassword validation', () => {
    it('rejects invalid payload missing fields with 422 VALIDATION_ERROR', async () => {
      const mockReq: any = {
        user: mockUser,
        headers: {},
        cookies: {},
      };

      try {
        await controller.changePassword({}, mockReq);
        expect.unreachable('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        const res = err.getResponse();
        expect(res.status).toBe(422);
        expect(res.code).toBe('VALIDATION_ERROR');
      }
    });
  });

  describe('AuthService.changePassword business rules', () => {
    it('throws 400 INVALID_CREDENTIALS when currentPassword does not match', async () => {
      const currentHash = await hashPassword('CorrectPassword1!');
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // set_config
        .mockResolvedValueOnce({
          rows: [
            {
              id: mockUser.userId,
              org_id: mockUser.orgId,
              email: mockUser.email,
              name: 'Jane Doe',
              role: mockUser.role,
              password_hash: currentHash,
              status: 'active',
              must_reset_password: true,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      await expect(
        authService.changePassword(
          mockUser,
          'sess-1',
          { currentPassword: 'WrongPassword!', newPassword: 'BrandNewPassword123!' },
          {},
        ),
      ).rejects.toMatchObject({
        response: {
          status: 400,
          code: 'INVALID_CREDENTIALS',
        },
      });
    });

    it('throws 422 PASSWORD_POLICY_VIOLATION when newPassword fails local rules', async () => {
      const currentHash = await hashPassword('CorrectPassword1!');
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // set_config
        .mockResolvedValueOnce({
          rows: [
            {
              id: mockUser.userId,
              org_id: mockUser.orgId,
              email: mockUser.email,
              name: 'Jane Doe',
              role: mockUser.role,
              password_hash: currentHash,
              status: 'active',
              must_reset_password: true,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      (passwordPolicy.evaluateLocal as any).mockReturnValueOnce({
        ok: false,
        score: 1,
        reasons: ['too_short', 'weak'],
      });

      await expect(
        authService.changePassword(
          mockUser,
          'sess-1',
          { currentPassword: 'CorrectPassword1!', newPassword: 'short' },
          {},
        ),
      ).rejects.toMatchObject({
        response: {
          status: 422,
          code: 'PASSWORD_POLICY_VIOLATION',
          reasons: ['too_short', 'weak'],
        },
      });
    });

    it('throws 422 PASSWORD_BREACHED when newPassword is found in breach corpus', async () => {
      const currentHash = await hashPassword('CorrectPassword1!');
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // set_config
        .mockResolvedValueOnce({
          rows: [
            {
              id: mockUser.userId,
              org_id: mockUser.orgId,
              email: mockUser.email,
              name: 'Jane Doe',
              role: mockUser.role,
              password_hash: currentHash,
              status: 'active',
              must_reset_password: false,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      (passwordPolicy.evaluateLocal as any).mockReturnValueOnce({
        ok: true,
        score: 4,
        reasons: [],
      });
      (passwordPolicy.checkBreached as any).mockResolvedValueOnce({
        breached: true,
        count: 10500,
      });

      await expect(
        authService.changePassword(
          mockUser,
          'sess-1',
          { currentPassword: 'CorrectPassword1!', newPassword: 'BreachedPassword123!' },
          {},
        ),
      ).rejects.toMatchObject({
        response: {
          status: 422,
          code: 'PASSWORD_BREACHED',
          reasons: ['breached'],
        },
      });
    });

    it('throws 422 PASSWORD_REUSED when newPassword matches history', async () => {
      const currentHash = await hashPassword('CorrectPassword1!');
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // set_config
        .mockResolvedValueOnce({
          rows: [
            {
              id: mockUser.userId,
              org_id: mockUser.orgId,
              email: mockUser.email,
              name: 'Jane Doe',
              role: mockUser.role,
              password_hash: currentHash,
              status: 'active',
              must_reset_password: false,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      (passwordPolicy.evaluateLocal as any).mockReturnValueOnce({
        ok: true,
        score: 4,
        reasons: [],
      });
      (passwordPolicy.checkBreached as any).mockResolvedValueOnce({ breached: false });
      (passwordPolicy.checkHistory as any).mockResolvedValueOnce({ reused: true });

      await expect(
        authService.changePassword(
          mockUser,
          'sess-1',
          { currentPassword: 'CorrectPassword1!', newPassword: 'OldReusedPassword123!' },
          {},
        ),
      ).rejects.toMatchObject({
        response: {
          status: 422,
          code: 'PASSWORD_REUSED',
          reasons: ['reused'],
        },
      });
    });

    it('successfully changes password, updates user, records history, revokes other sessions', async () => {
      const currentHash = await hashPassword('CorrectPassword1!');
      mockClient.query = vi.fn().mockImplementation(async (sql: string) => {
        if (typeof sql === 'string' && sql.includes('SELECT u.id')) {
          return {
            rows: [
              {
                id: mockUser.userId,
                org_id: mockUser.orgId,
                email: mockUser.email,
                name: 'Jane Doe',
                role: mockUser.role,
                password_hash: currentHash,
                status: 'active',
                must_reset_password: true,
              },
            ],
          };
        }
        if (typeof sql === 'string' && sql.includes('SELECT hash FROM audit.events')) {
          return { rows: [] };
        }
        return { rows: [], rowCount: 1 };
      });

      (passwordPolicy.evaluateLocal as any).mockReturnValueOnce({
        ok: true,
        score: 4,
        reasons: [],
      });
      (passwordPolicy.checkBreached as any).mockResolvedValueOnce({ breached: false });
      (passwordPolicy.checkHistory as any).mockResolvedValueOnce({ reused: false });

      const result = await authService.changePassword(
        mockUser,
        'current-session-id',
        { currentPassword: 'CorrectPassword1!', newPassword: 'FreshStrongPassword2026!' },
        { ip: '127.0.0.1', userAgent: 'test-agent' },
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe('Password changed successfully.');

      // Check that history was recorded
      expect(passwordPolicy.recordPasswordHistory).toHaveBeenCalledWith(
        mockUser.userId,
        expect.any(String),
        expect.anything(),
      );

      // Check that other sessions were revoked while keeping current session
      expect(sessionService.revokeOtherSessionsForUser).toHaveBeenCalledWith(
        mockUser.userId,
        'current-session-id',
      );
    });
  });
});
