import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import {
  ChangePasswordDtoSchema,
  ChangePasswordResponseDto,
  ChangePasswordResponseDtoSchema,
  type LoginDto,
  LoginDtoSchema,
  LogoutResponseDtoSchema,
  MeDtoSchema,
  type MfaVerifyDto,
  MfaVerifyDtoSchema,
} from '@hs/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { problem } from '../../common/errors/app-http.exception.js';
import { flattenZodErrors } from '../../common/validation/zod-errors.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  AuthenticatedRequest,
  REQUEST_USER_KEY,
} from '../../common/guards/session.guard.js';
import { APP_CONFIG } from '../../config/config.tokens.js';
import type { Config } from '../../config/config.js';
import {
  COOKIE_HOST_SESSION_NAME,
  COOKIE_SESSION_NAME,
  SessionService,
} from '../session/session.service.js';
import { clearSessionCookie, setSessionCookie } from './auth.cookies.js';
import { AuthService } from './auth.service.js';

const IdentifyLoginDtoSchema = z.object({
  email: z.string().email(),
});

@Roles('platform_admin', 'company_admin', 'candidate')
@Controller()
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: Config,
  ) {}

  @Public()
  @HttpCode(200)
  @Throttle({ login: { limit: 5, ttl: 60_000 } })
  @Post('auth/login')
  async login(
    @Body(new ZodValidationPipe(LoginDtoSchema)) body: LoginDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const meta = requestMeta(request);
    const result = await this.auth.login(body, meta);
    if ('mfaRequired' in result) {
      return result;
    }
    const mfaCompleted = result.role === 'platform_admin' && Boolean(body.mfaCode);
    const session = await this.auth.createSessionForUserId(result.id, meta, {
      mfaVerified: mfaCompleted,
    });
    setSessionCookie(reply, this.config, session.rawToken);
    return MeDtoSchema.parse(session.me);
  }

  @Public()
  @HttpCode(200)
  @Throttle({ login: { limit: 20, ttl: 60_000 } })
  @Post('auth/identify')
  async identify(
    @Body(new ZodValidationPipe(IdentifyLoginDtoSchema)) body: z.infer<typeof IdentifyLoginDtoSchema>,
  ) {
    return this.auth.identifyLoginEmail(body.email);
  }

  @Public()
  @HttpCode(200)
  @Throttle({ login: { limit: 5, ttl: 60_000 } })
  @Post('auth/mfa/verify')
  async mfaVerify(
    @Body(new ZodValidationPipe(MfaVerifyDtoSchema)) body: MfaVerifyDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const meta = requestMeta(request);
    const me = await this.auth.verifyMfa(body, meta);
    const session = await this.auth.createSessionForUserId(me.id, meta, {
      mfaVerified: true,
    });
    setSessionCookie(reply, this.config, session.rawToken);
    return MeDtoSchema.parse(session.me);
  }

  @HttpCode(200)
  @Post('auth/logout')
  async logout(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const rawToken = extractSessionId(request);
    const result = await this.auth.logout(rawToken);
    clearSessionCookie(reply);
    return LogoutResponseDtoSchema.parse(result);
  }

  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('auth/password/change')
  async changePassword(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<ChangePasswordResponseDto> {
    const parsed = ChangePasswordDtoSchema.safeParse(body);
    if (!parsed.success) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Invalid password change payload',
        code: 'VALIDATION_ERROR',
        errors: flattenZodErrors(parsed.error),
      });
    }

    const user = request[REQUEST_USER_KEY];
    const sessionId = extractSessionId(request);
    const meta = requestMeta(request);

    const result = await this.auth.changePassword(user, sessionId, parsed.data, meta);
    return ChangePasswordResponseDtoSchema.parse(result);
  }

  @SkipThrottle()
  @Get('me')
  async me(@Req() request: AuthenticatedRequest) {
    const user = request[REQUEST_USER_KEY];
    const me = await this.auth.getMe(user.userId);
    return MeDtoSchema.parse(me);
  }
}

function requestMeta(request: FastifyRequest): {
  ip?: string;
  userAgent?: string;
  requestId?: string;
} {
  const meta: { ip?: string; userAgent?: string; requestId?: string } = {};
  if (request.ip) {
    meta.ip = request.ip;
  }
  const ua = request.headers['user-agent'];
  if (typeof ua === 'string') {
    meta.userAgent = ua;
  }
  if (typeof request.id === 'string') {
    meta.requestId = request.id;
  }
  return meta;
}

function extractSessionId(request: FastifyRequest): string | undefined {
  const cookies = request.cookies || (request.raw as any)?.cookies || {};
  const hostCookie = cookies[COOKIE_HOST_SESSION_NAME];
  if (typeof hostCookie === 'string' && hostCookie.trim().length > 0) {
    return hostCookie.trim();
  }
  const regularCookie = cookies[COOKIE_SESSION_NAME];
  if (typeof regularCookie === 'string' && regularCookie.trim().length > 0) {
    return regularCookie.trim();
  }
  const auth = request.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return auth.slice('Bearer '.length).trim();
  }
  return undefined;
}
