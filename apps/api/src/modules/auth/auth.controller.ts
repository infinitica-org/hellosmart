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
  LoginDtoSchema,
  LogoutResponseDtoSchema,
  MeDtoSchema,
  MfaVerifyDtoSchema,
} from '@hs/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { problem } from '../../common/errors/app-http.exception.js';
import { flattenZodErrors } from '../../common/validation/zod-errors.js';
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

@SkipThrottle()
@Roles('platform_admin', 'company_admin', 'candidate')
@Controller()
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: Config,
  ) {}

  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('auth/login')
  async login(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const parsed = LoginDtoSchema.safeParse(body);
    if (!parsed.success) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Invalid login payload',
        code: 'VALIDATION_ERROR',
        errors: flattenZodErrors(parsed.error),
      });
    }
    const meta = requestMeta(request);
    const result = await this.auth.login(parsed.data, meta);
    if ('mfaRequired' in result) {
      return result;
    }
    const mfaCompleted = result.role === 'platform_admin' && Boolean(parsed.data.mfaCode);
    const session = await this.auth.createSessionForUserId(result.id, meta, {
      mfaVerified: mfaCompleted,
    });
    setSessionCookie(reply, this.config, session.rawToken);
    return MeDtoSchema.parse(session.me);
  }

  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('auth/mfa/verify')
  async mfaVerify(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const parsed = MfaVerifyDtoSchema.safeParse(body);
    if (!parsed.success) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Invalid MFA payload',
        code: 'VALIDATION_ERROR',
        errors: flattenZodErrors(parsed.error),
      });
    }
    const meta = requestMeta(request);
    const me = await this.auth.verifyMfa(parsed.data, meta);
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
