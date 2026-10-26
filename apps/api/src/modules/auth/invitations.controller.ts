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
import { REQUEST_ID_HEADER } from '../observability/index.js';
import { InvitationsService } from './invitations.service.js';

interface FastifyRequestLike {
  headers: Record<string, string | string[] | undefined>;
  id?: string;
  ip?: string;
}

@Controller('auth/invitations')
export class InvitationsController {
  constructor(
    @Inject(InvitationsService) private readonly invitationsService: InvitationsService,
  ) {}

  /**
   * GET /auth/invitations/:token
   * Validates invitation token and returns public non-sensitive details.
   */
  @Get(':token')
  @Throttle({ default: { limit: 10, ttl: 3600000 } }) // 10 attempts per hour
  async validateToken(
    @Param('token') token: string,
    @Req() req: FastifyRequestLike,
  ): Promise<InvitationDetailsResponse> {
    const requestId = (req.headers[REQUEST_ID_HEADER] as string) || (req.id as string);
    return this.invitationsService.lookupInvitation(token, requestId);
  }

  /**
   * POST /auth/invitations/accept
   * Validates password, consumes token atomically, activates user, and logs audit event.
   */
  @Post('accept')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 3600000 } }) // 10 attempts per hour per IP
  async acceptInvitation(
    @Body() body: AcceptInvitationRequest,
    @Req() req: FastifyRequestLike,
  ): Promise<AcceptInvitationResponse> {
    const requestId = (req.headers[REQUEST_ID_HEADER] as string) || (req.id as string);
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;
    const userAgent = req.headers['user-agent'] as string;

    return this.invitationsService.acceptInvitation(body, {
      clientIp,
      userAgent,
      requestId,
    });
  }
}
