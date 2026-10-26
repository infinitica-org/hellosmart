import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Ip,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  type ChangePasswordRequest,
  type LoginRequest,
  type SimpleSuccessResponse,
} from '@hs/contracts';
import { AuthService, type UserMe } from './auth.service.js';
import { CurrentUser } from './guards/current-user.decorator.js';
import { SessionGuard } from './guards/session.guard.js';
import type { Session } from './session/session.interface.js';
import { type FastifyReplyLike, SessionService } from './session/session.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(SessionService) private readonly sessionService: SessionService,
  ) {}

  /**
   * POST /api/v1/auth/login
   * Throttled: 5 attempts per minute per IP.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(
    @Body() body: LoginRequest,
    @Ip() clientIp: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
    @Res({ passthrough: true }) reply: FastifyReplyLike,
  ): Promise<UserMe> {
    const isSecure = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';

    const result = await this.authService.login(body, {
      ip: clientIp,
      userAgent,
      requestId,
    });

    this.sessionService.setSessionCookies(reply, result.session, isSecure);
    return result.me;
  }

  /**
   * POST /api/v1/auth/logout
   * Requires active session. Destroys session in store and clears browser cookies.
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionGuard)
  async logout(
    @CurrentUser() session: Session,
    @Res({ passthrough: true }) reply: FastifyReplyLike,
  ): Promise<SimpleSuccessResponse> {
    const isSecure = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';
    await this.sessionService.revokeSession(session.id);
    this.sessionService.clearSessionCookies(reply, isSecure);

    return {
      success: true,
      message: 'Logged out successfully.',
    };
  }

  /**
   * POST /api/v1/auth/password/change
   * Handles both forced password reset and authenticated elective password change.
   */
  @Post('password/change')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionGuard)
  async changePassword(
    @CurrentUser() session: Session,
    @Body() body: ChangePasswordRequest,
    @Ip() clientIp: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
    @Res({ passthrough: true }) reply: FastifyReplyLike,
  ): Promise<SimpleSuccessResponse> {
    const isSecure = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';

    const result = await this.authService.changePassword(session, body, {
      ip: clientIp,
      userAgent,
      requestId,
    });

    this.sessionService.setSessionCookies(reply, result.updatedSession, isSecure);

    return {
      success: true,
      message: result.message,
    };
  }
}

@Controller()
export class MeController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  /**
   * GET /api/v1/me
   * Requires active session. Returns current user and portal routing target.
   */
  @Get('me')
  @UseGuards(SessionGuard)
  async getMe(@CurrentUser() session: Session): Promise<UserMe> {
    return this.authService.getMe(session);
  }
}
