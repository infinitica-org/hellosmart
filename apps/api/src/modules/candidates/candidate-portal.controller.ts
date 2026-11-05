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
import type { FastifyRequest } from 'fastify';
import { Roles } from '../../common/decorators/roles.decorator.js';
import {
  REQUEST_USER_KEY,
  type AuthenticatedRequest,
} from '../../common/guards/session.guard.js';
import { CandidatesService } from './candidates.service.js';
import type { RequestMeta } from '../auth/auth.service.js';

@Controller('candidate')
@Roles('candidate')
export class CandidatePortalController {
  constructor(
    @Inject(CandidatesService) private readonly candidatesService: CandidatesService,
  ) {}

  @Get('assessments')
  async getAssessments(@Req() request: AuthenticatedRequest) {
    const actor = request[REQUEST_USER_KEY];
    return this.candidatesService.getCandidateAssessments(actor);
  }

  @Get('assessments/:id')
  async getAssessmentById(
    @Param('id') assignmentId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request[REQUEST_USER_KEY];
    return this.candidatesService.getCandidateAssessmentDetail(assignmentId, actor);
  }

  @HttpCode(200)
  @Post('workspace/:id/consent')
  async acceptConsent(
    @Param('id') assignmentId: string,
    @Body() body: { textVersion?: string },
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request[REQUEST_USER_KEY];
    const meta = extractMeta(request);
    return this.candidatesService.recordCandidateConsent(
      assignmentId,
      { textVersion: body?.textVersion || 'v1.0' },
      actor,
      meta,
    );
  }

  @HttpCode(200)
  @Post('workspace/:id/draft')
  async saveDraft(
    @Param('id') assignmentId: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request[REQUEST_USER_KEY];
    return this.candidatesService.saveCandidateDraft(assignmentId, body, actor);
  }

  @HttpCode(200)
  @Post('workspace/:id/submit')
  async submitAssessment(
    @Param('id') assignmentId: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request[REQUEST_USER_KEY];
    const meta = extractMeta(request);
    return this.candidatesService.submitCandidateAssessment(assignmentId, body, actor, meta);
  }
}

function extractMeta(request: FastifyRequest): RequestMeta {
  const meta: RequestMeta = {};
  if (request.ip) meta.ip = request.ip;
  const ua = request.headers['user-agent'];
  if (typeof ua === 'string') meta.userAgent = ua;
  return meta;
}
