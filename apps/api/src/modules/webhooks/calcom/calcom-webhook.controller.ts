import { Controller, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Public } from '../../../common/decorators/public.decorator.js';
import { SkipCsrf } from '../../../common/decorators/skip-csrf.decorator.js';
import { problem } from '../../../common/errors/app-http.exception.js';
import { CalcomWebhookService } from './calcom-webhook.service.js';

@Controller('webhooks/calcom')
export class CalcomWebhookController {
  constructor(private readonly service: CalcomWebhookService) {}

  @Post()
  @Public()
  @SkipCsrf()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    // 1. Extract raw wire buffer
    const rawBody: Buffer | undefined = (req as any).rawBody || (Buffer.isBuffer(req.body) ? req.body : undefined);

    // 2. Extract signature header (supports both x-cal-signature-256 and cal-signature-256)
    const signatureHeader = (
      req.headers['x-cal-signature-256'] ||
      req.headers['cal-signature-256']
    ) as string | undefined;

    // 3. Verify HMAC signature; fail closed if invalid or missing
    const isValid = this.service.verifyHmac(rawBody, signatureHeader);
    if (!isValid) {
      throw problem({
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid, malformed, or missing Cal.com webhook signature',
        code: 'INVALID_WEBHOOK_SIGNATURE',
      });
    }

    // 4. Ingest and process webhook
    const result = await this.service.processWebhook({
      rawBody: rawBody!,
      headers: req.headers,
      parsedBody: req.body,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: (req as any).id,
    });

    void reply.status(result.statusCode).send({
      received: true,
      outcome: result.outcome,
      reason: result.reason,
    });
  }
}
