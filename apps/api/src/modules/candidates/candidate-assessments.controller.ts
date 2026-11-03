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
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  REQUEST_USER_KEY,
  type AuthenticatedRequest,
} from '../../common/guards/session.guard.js';
import type { RequestMeta } from '../auth/auth.service.js';
import { CandidateAssessmentsService } from './candidate-assessments.service.js';
import {
  RecordConsentDtoSchema,
  type RecordConsentDto,
} from './dto/record-consent.dto.js';
import {
  StartAssessmentDtoSchema,
  type StartAssessmentDto,
} from './dto/start-assessment.dto.js';
import {
  SubmitDeliverablesDtoSchema,
  type SubmitDeliverablesDto,
} from './dto/submit-deliverables.dto.js';
import {
  SaveCandidateDraftDtoSchema,
  type SaveCandidateDraftDto,
} from './dto/candidate-draft.dto.js';

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

@Controller('candidate')
@Roles('candidate')
export class CandidateAssessmentsController {
  constructor(
    @Inject(CandidateAssessmentsService)
    private readonly service: CandidateAssessmentsService,
  ) {}

  @Get('assignments')
  async getAssignments(@Req() request: AuthenticatedRequest) {
    const actor = request[REQUEST_USER_KEY];
    return this.service.getAssignments(actor);
  }

  @Get('assessments/:id')
  async getAssessment(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request[REQUEST_USER_KEY];
    return this.service.getAssessmentDetails(id, actor);
  }

  @Post('assessments/:id/consent')
  @HttpCode(201)
  async recordConsent(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RecordConsentDtoSchema)) body: RecordConsentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request[REQUEST_USER_KEY];
    return this.service.recordConsent(id, body, actor, requestMeta(request));
  }

  @Post('assessments/:id/start')
  @HttpCode(200)
  async startAssessment(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(StartAssessmentDtoSchema)) body: StartAssessmentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request[REQUEST_USER_KEY];
    return this.service.startAssessment(id, body, actor, requestMeta(request));
  }

  @Post('assessments/:id/submit')
  @HttpCode(200)
  async submitDeliverables(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SubmitDeliverablesDtoSchema)) body: SubmitDeliverablesDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request[REQUEST_USER_KEY];
    return this.service.submitDeliverables(id, body, actor, requestMeta(request));
  }

  @Get('assessments/:id/timing')
  async getTiming(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request[REQUEST_USER_KEY];
    return this.service.getTiming(id, actor);
  }

  @Get('assessments/:id/draft')
  async getDraft(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request[REQUEST_USER_KEY];
    return this.service.getDraft(id, actor);
  }

  @Post('assessments/:id/draft')
  @HttpCode(200)
  async saveDraft(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SaveCandidateDraftDtoSchema)) body: SaveCandidateDraftDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request[REQUEST_USER_KEY];
    return this.service.saveDraft(id, body, actor);
  }

  @Post('artifacts/upload')
  @HttpCode(200)
  async uploadArtifact(@Req() request: AuthenticatedRequest) {
    const actor = request[REQUEST_USER_KEY];
    return this.service.uploadArtifact(request, actor, requestMeta(request));
  }

  @Get('ping')
  async ping() {
    return {
      ok: true,
      timestamp: Date.now(),
      service: 'hellosmart-candidate-api',
    };
  }
}
