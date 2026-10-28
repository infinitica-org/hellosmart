import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type {
  AcceptInvitationRequest,
  AcceptInvitationResponse,
  InvitationDetailsResponse,
} from '@hs/contracts';
import { Public } from '../../common/decorators/public.decorator.js';
import { InvitationsService } from './invitations.service.js';

interface FastifyRequestLike {
  headers: Record<string, string | string[] | undefined>;
  id?: string;
  ip?: string;
}

const INVITATION_THROTTLE_LIMIT = process.env.NODE_ENV === 'production' ? 10 : 1000;

@Public()
@Controller('auth/invitations')
export class InvitationsController {
  constructor(
    @Inject(InvitationsService) private readonly invitationsService: InvitationsService,
  ) {}

  /**
   * GET /auth/invitations/:token
   * Validates invitation token and returns public non-sensitive details.
   */
  @Public()
  @Get(':token')
  @Throttle({ default: { limit: INVITATION_THROTTLE_LIMIT, ttl: 3600000 } }) // 10 attempts per hour in prod, 1000 in dev
  async validateToken(
    @Param('token') token: string,
    @Req() req: FastifyRequestLike,
  ): Promise<InvitationDetailsResponse> {
    const requestId =
      (req.headers['x-request-id'] as string | undefined) || (req.id as string | undefined);
    return this.invitationsService.lookupInvitation(token, requestId);
  }

  /**
   * POST /auth/invitations/accept
   * Validates password, consumes token atomically, activates user, and logs audit event.
   */
  @Public()
  @Post('accept')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: INVITATION_THROTTLE_LIMIT, ttl: 3600000 } }) // 10 attempts per hour per IP in prod, 1000 in dev
  async acceptInvitation(
    @Body() body: AcceptInvitationRequest,
    @Req() req: FastifyRequestLike,
  ): Promise<AcceptInvitationResponse> {
    const requestId =
      (req.headers['x-request-id'] as string | undefined) || (req.id as string | undefined);
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;
    const userAgent = req.headers['user-agent'] as string | undefined;

    return this.invitationsService.acceptInvitation(body, {
      clientIp,
      userAgent,
      requestId,
    });
  }
}
