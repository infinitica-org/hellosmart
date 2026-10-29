import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
  Req,
} from '@nestjs/common';
import { CreateCandidateDtoSchema } from '@hs/contracts';
import type { FastifyRequest } from 'fastify';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { problem } from '../../common/errors/app-http.exception.js';
import {
  REQUEST_USER_KEY,
  type AuthenticatedRequest,
} from '../../common/guards/session.guard.js';
import { flattenZodErrors } from '../../common/validation/zod-errors.js';
import type { RequestMeta } from '../auth/auth.service.js';
import { CandidatesService } from './candidates.service.js';

@Controller('candidates')
@Roles('company_admin')
export class CandidatesController {
  constructor(
    @Inject(CandidatesService) private readonly candidatesService: CandidatesService,
  ) {}

  @Post()
  @HttpCode(201)
  async create(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const parsed = CreateCandidateDtoSchema.safeParse(body);
    if (!parsed.success) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Invalid candidate payload',
        code: 'VALIDATION_ERROR',
        errors: flattenZodErrors(parsed.error),
      });
    }

    const actor = request[REQUEST_USER_KEY];
    return this.candidatesService.create(parsed.data, actor, requestMeta(request));
  }
}

function requestMeta(request: FastifyRequest): RequestMeta {
  const meta: RequestMeta = {};
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
