
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  type CreateOrgDto,
  CreateOrgDtoSchema,
  OrgDtoSchema,
  type UpdateOrgStatusDto,
  UpdateOrgStatusDtoSchema,
} from '@hs/contracts';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { problem } from '../../common/errors/app-http.exception.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  REQUEST_USER_KEY,
  type AuthenticatedRequest,
} from '../../common/guards/session.guard.js';
import type { RequestMeta } from '../auth/auth.service.js';
import { AdminOrganizationsService } from './admin-organizations.service.js';

@Controller('admin/organizations')
@Roles('platform_admin')
export class AdminOrganizationsController {
  constructor(
    @Inject(AdminOrganizationsService)
    private readonly orgs: AdminOrganizationsService,
  ) {}

  @Get()
  async list() {
    const organizations = await this.orgs.list();

    return {
      organizations: organizations.map((org) => OrgDtoSchema.parse(org)),
      total: organizations.length,
    };
  }

  @Post()
  @HttpCode(201)
  async provision(
    @Body(new ZodValidationPipe(CreateOrgDtoSchema)) body: CreateOrgDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request[REQUEST_USER_KEY];

    const org = await this.orgs.provision(
      body,
      actor,
      requestMeta(request),
    );

    return OrgDtoSchema.parse(org);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateOrgStatusDtoSchema)) body: UpdateOrgStatusDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const orgId = z.string().uuid().safeParse(id);

    if (!orgId.success) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Invalid organization id',
        code: 'VALIDATION_ERROR',
      });
    }

    const actor = request[REQUEST_USER_KEY];

    const org = await this.orgs.updateStatus(
      orgId.data,
      body,
      actor,
      requestMeta(request),
    );

    return OrgDtoSchema.parse(org);
  }
}

function requestMeta(request: FastifyRequest): RequestMeta {
  const meta: RequestMeta = {};

  if (request.ip) {
    meta.ip = request.ip;
  }

  const userAgent = request.headers['user-agent'];

  if (typeof userAgent === 'string') {
    meta.userAgent = userAgent;
  }

  if (typeof request.id === 'string') {
    meta.requestId = request.id;
  }

  return meta;
}
