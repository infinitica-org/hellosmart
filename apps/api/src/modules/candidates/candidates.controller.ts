import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
  Req,
} from '@nestjs/common';
import { type CreateCandidateDto, CreateCandidateDtoSchema } from '@hs/contracts';
import type { FastifyRequest } from 'fastify';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  REQUEST_USER_KEY,
  type AuthenticatedRequest,
} from '../../common/guards/session.guard.js';
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
  async create(
    @Body(new ZodValidationPipe(CreateCandidateDtoSchema)) body: CreateCandidateDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request[REQUEST_USER_KEY];
    return this.candidatesService.create(body, actor, requestMeta(request));
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
