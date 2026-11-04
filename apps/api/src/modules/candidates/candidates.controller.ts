import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
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
import { problem } from '../../common/errors/app-http.exception.js';
import type { RequestMeta } from '../auth/auth.service.js';
import { CandidatesService } from './candidates.service.js';

@Controller(['candidates', 'company/candidates'])
@Roles('company_admin')
export class CandidatesController {
  constructor(
    @Inject(CandidatesService) private readonly candidatesService: CandidatesService,
  ) {}

  @Get('metrics')
  async metrics(@Req() request: AuthenticatedRequest) {
    const actor = request[REQUEST_USER_KEY];
    return this.candidatesService.getMetrics(actor);
  }

  @Get()
  async findAll(
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('search') search: string | undefined,
    @Query('q') q: string | undefined,
    @Query('status') status: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request[REQUEST_USER_KEY];
    return this.candidatesService.findAll(
      {
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 10,
        search: (search || q)?.trim(),
        status: status?.trim().toLowerCase(),
      },
      actor,
    );
  }

  @Post()
  @HttpCode(201)
  async create(
    @Body(new ZodValidationPipe(CreateCandidateDtoSchema)) body: CreateCandidateDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request[REQUEST_USER_KEY];
    return this.candidatesService.create(body, actor, requestMeta(request));
  }

  @Post('bulk')
  @HttpCode(200)
  async bulk(
    @Req() request: AuthenticatedRequest,
    @Query('assessment_id') assessmentId?: string,
  ) {
    const contentType = (request.headers['content-type'] || '').toLowerCase();
    const actor = request[REQUEST_USER_KEY];

    // Support JSON candidate payload from client wizard/importer
    if (contentType.includes('application/json')) {
      const body = request.body as any;
      if (Array.isArray(body) || Array.isArray(body?.candidates)) {
        const candidates = Array.isArray(body) ? body : body.candidates;
        return this.candidatesService.bulkCreate({ candidates }, actor, requestMeta(request));
      }
      throw problem({
        title: 'Unsupported Media Type',
        status: 415,
        detail: `Bulk candidate upload requires 'text/csv' or JSON object with candidates array. Received: '${contentType || 'none'}'`,
        code: 'UNSUPPORTED_MEDIA_TYPE',
      });
    }

    if (!contentType.includes('text/csv') && !contentType.includes('application/csv')) {
      throw problem({
        title: 'Unsupported Media Type',
        status: 415,
        detail: `Bulk candidate upload requires 'text/csv', 'application/csv', or 'application/json' content-type. Received: '${contentType || 'none'}'`,
        code: 'UNSUPPORTED_MEDIA_TYPE',
      });
    }

    const stream = (request.body as any) || request.raw;
    return this.candidatesService.processBulkCsvStream(
      stream,
      assessmentId,
      actor,
      requestMeta(request),
    );
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { name?: string; email?: string },
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request[REQUEST_USER_KEY];
    return this.candidatesService.update(id, body, actor, requestMeta(request));
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request[REQUEST_USER_KEY];
    return this.candidatesService.delete(id, actor, requestMeta(request));
  }

  @Post(':candidateId/assignments/:assignmentId/resend-invite')
  @HttpCode(200)
  async resendAssignmentInvite(
    @Param('candidateId') candidateId: string,
    @Param('assignmentId') assignmentId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request[REQUEST_USER_KEY];
    return this.candidatesService.resendInvite(
      candidateId,
      assignmentId,
      actor,
      requestMeta(request),
    );
  }

  @Post(':id/resend-invite')
  @HttpCode(200)
  async resendInvite(
    @Param('id') id: string,
    @Query('assignment_id') queryAssignmentId: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request[REQUEST_USER_KEY];
    const body = request.body as { assignment_id?: string } | undefined;
    const assignmentId = queryAssignmentId || body?.assignment_id;
    return this.candidatesService.resendInvite(
      id,
      assignmentId,
      actor,
      requestMeta(request),
    );
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
