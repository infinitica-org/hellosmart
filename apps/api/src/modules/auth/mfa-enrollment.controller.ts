import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  MfaBackupRegenerateDtoSchema,
  MfaSetupConfirmDtoSchema,
  MfaSetupConfirmResponseSchema,
  MfaSetupStartResponseSchema,
  MfaStatusResponseSchema,
  type MfaBackupRegenerateDto,
  type MfaSetupConfirmDto,
} from '@hs/contracts';
import type { FastifyRequest } from 'fastify';
import { Roles } from '../../common/decorators/roles.decorator.js';
import {
  AuthenticatedRequest,
  REQUEST_USER_KEY,
} from '../../common/guards/session.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { extractRawSessionToken } from '../session/session-cookie.js';
import { AuthService } from './auth.service.js';

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

@Roles('platform_admin')
@Controller('auth/mfa')
export class MfaEnrollmentController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @SkipThrottle()
  @Get('status')
  async status(@Req() request: AuthenticatedRequest) {
    const user = request[REQUEST_USER_KEY];
    const result = await this.auth.getMfaStatus(user.userId);
    return MfaStatusResponseSchema.parse(result);
  }

  @HttpCode(200)
  @Post('setup/start')
  async startSetup(@Req() request: AuthenticatedRequest) {
    const user = request[REQUEST_USER_KEY];
    const meta = requestMeta(request);
    const result = await this.auth.startMfaEnrollment(user.userId, meta);
    return MfaSetupStartResponseSchema.parse(result);
  }

  @HttpCode(200)
  @Post('setup/confirm')
  async confirmSetup(
    @Body(new ZodValidationPipe(MfaSetupConfirmDtoSchema)) body: MfaSetupConfirmDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const user = request[REQUEST_USER_KEY];
    const meta = requestMeta(request);
    const result = await this.auth.confirmMfaEnrollment(user.userId, body, meta);
    await this.auth.markCurrentSessionMfaVerified(extractRawSessionToken(request));
    return MfaSetupConfirmResponseSchema.parse(result);
  }

  @HttpCode(200)
  @Post('backup-codes/regenerate')
  async regenerateBackupCodes(
    @Body(new ZodValidationPipe(MfaBackupRegenerateDtoSchema)) body: MfaBackupRegenerateDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const user = request[REQUEST_USER_KEY];
    const meta = requestMeta(request);
    const result = await this.auth.regenerateBackupCodes(user.userId, body, meta);
    return MfaSetupConfirmResponseSchema.parse(result);
  }
}
