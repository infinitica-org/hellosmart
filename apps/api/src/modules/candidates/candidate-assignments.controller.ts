import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import {
  type CandidateAssignmentDto,
  type StartAssignmentDto,
  StartAssignmentDtoSchema,
} from '@hs/contracts';
import type { FastifyRequest } from 'fastify';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  REQUEST_USER_KEY,
  type AuthenticatedRequest,
} from '../../common/guards/session.guard.js';
import type { RequestMeta } from '../auth/auth.service.js';
import { CandidatesService } from './candidates.service.js';

@Controller('candidate/assignments')
@Roles('candidate')
export class CandidateAssignmentsController {
  constructor(
    @Inject(CandidatesService) private readonly candidatesService: CandidatesService,
  ) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest): Promise<CandidateAssignmentDto[]> {
    const actor = request[REQUEST_USER_KEY];
    return this.candidatesService.listAssignments(actor);
  }

  @Post(':id/start')
  @HttpCode(200)
  async start(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(StartAssignmentDtoSchema)) body: StartAssignmentDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<CandidateAssignmentDto> {
    const actor = request[REQUEST_USER_KEY];
    return this.candidatesService.startAssignment(id, actor, body.consent, requestMeta(request));
  }

  @Post(':id/submit')
  @HttpCode(200)
  async submit(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<CandidateAssignmentDto> {
    const actor = request[REQUEST_USER_KEY];
    return this.candidatesService.submitAssignment(id, actor, requestMeta(request));
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
