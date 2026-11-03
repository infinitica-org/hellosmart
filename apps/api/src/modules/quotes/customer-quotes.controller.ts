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
import type { FastifyRequest } from 'fastify';
import {
  AcceptQuoteDtoSchema,
  type AcceptQuoteResponseDto,
  type CustomerQuoteDto,
} from '@hs/contracts';
import { Public } from '../../common/decorators/public.decorator.js';
import { problem } from '../../common/errors/app-http.exception.js';
import { flattenZodErrors } from '../../common/validation/zod-errors.js';
import { REQUEST_USER_KEY } from '../../common/guards/session.guard.js';
import type { AuthenticatedUser } from '../../common/constants/auth.constants.js';
import { QuotesService } from './quotes.service.js';

const QUOTE_THROTTLE_LIMIT = process.env.NODE_ENV === 'production' ? 60 : 1000;

@Public()
@Controller('quotes')
export class CustomerQuotesController {
  constructor(
    @Inject(QuotesService) private readonly quotesService: QuotesService,
  ) {}

  /**
   * GET /api/v1/quotes/:token
   * Customer Quote Review Screen endpoint.
   * Access is secured by the cryptographic public token generated at issuance.
   * Returns immutable quote details and line item breakdown.
   */
  @Public()
  @Get(':token')
  @Throttle({ default: { limit: QUOTE_THROTTLE_LIMIT, ttl: 60000 } })
  async getQuoteByToken(
    @Param('token') token: string,
    @Req() _req: FastifyRequest,
  ): Promise<CustomerQuoteDto> {
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      throw problem({
        title: 'Not Found',
        status: 404,
        detail: 'Quotation not found or invalid access token',
        code: 'QUOTE_NOT_FOUND',
      });
    }

    const quote = await this.quotesService.getQuoteByToken(token);
    if (!quote) {
      throw problem({
        title: 'Not Found',
        status: 404,
        detail: 'Quotation not found or invalid access token',
        code: 'QUOTE_NOT_FOUND',
      });
    }

    return quote;
  }

  /**
   * POST /api/v1/quotes/:token/accept
   * Customer One-Click Quote Approval endpoint.
   * Atomically and idempotently accepts an issued quote and writes an append-only audit event.
   */
  @Public()
  @Post(':token/accept')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: QUOTE_THROTTLE_LIMIT, ttl: 60000 } })
  async acceptQuote(
    @Param('token') token: string,
    @Body() body: unknown,
    @Req() req: FastifyRequest,
  ): Promise<AcceptQuoteResponseDto> {
    const parseResult = AcceptQuoteDtoSchema.safeParse(body ?? {});
    if (!parseResult.success) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Invalid quotation acceptance request data',
        code: 'VALIDATION_FAILED',
        errors: flattenZodErrors(parseResult.error),
      });
    }

    // IP Evidence Trust Boundary:
    // Requests reaching this endpoint via the Next.js BFF arrive with the BFF host address (127.0.0.1).
    // Storing 127.0.0.1 would misattribute internal infrastructure IP as customer client IP.
    // In addition, leftmost client-supplied X-Forwarded-For headers from untrusted callers cannot be
    // reliably trusted without upstream cryptographic attestation or ingress header-stripping.
    // In accordance with security audit recommendations, untrusted IP evidence is recorded as null
    // rather than recording a fabricated or loopback IP address.
    const clientIp = null;
    const userAgent = req.headers['user-agent'] as string | undefined;
    const requestId =
      (req.headers['x-request-id'] as string | undefined) || (req.id as string | undefined);
    const authUser = (req as any)[REQUEST_USER_KEY] as AuthenticatedUser | undefined;

    return this.quotesService.acceptQuote({
      token,
      acceptedByName: parseResult.data.acceptedByName,
      confirmationAcknowledged: parseResult.data.confirmationAcknowledged,
      clientIp,
      userAgent,
      userId: authUser?.userId || null,
      userRole: authUser?.role || null,
      requestId,
    });
  }
}
