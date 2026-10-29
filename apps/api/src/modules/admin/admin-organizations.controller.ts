
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  CreateOrgDtoSchema,
  OrgDtoSchema,
  OrgListQueryDtoSchema,
  UpdateOrgStatusDtoSchema,
} from '@hs/contracts';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { problem } from '../../common/errors/app-http.exception.js';
import {
  REQUEST_USER_KEY,
  type AuthenticatedRequest,
} from '../../common/guards/session.guard.js';
import { flattenZodErrors } from '../../common/validation/zod-errors.js';
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
  async list(@Query() query: unknown) {
    const parsed = OrgListQueryDtoSchema.safeParse(query);

    if (!parsed.success) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Invalid query parameters',
        code: 'VALIDATION_ERROR',
        errors: flattenZodErrors(parsed.error),
      });
    }

    return await this.orgs.listOrganizations(parsed.data);
  }

  @Post()
  @HttpCode(201)
  async provision(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const parsed = CreateOrgDtoSchema.safeParse(body);

    if (!parsed.success) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Invalid organization payload',
        code: 'VALIDATION_ERROR',
        errors: flattenZodErrors(parsed.error),
      });
    }

    const actor = request[REQUEST_USER_KEY];

    const org = await this.orgs.provision(
      parsed.data,
      actor,
      requestMeta(request),
    );

    return OrgDtoSchema.parse(org);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: unknown,
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

    const parsed = UpdateOrgStatusDtoSchema.safeParse(body);

    if (!parsed.success) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Invalid status payload',
        code: 'VALIDATION_ERROR',
        errors: flattenZodErrors(parsed.error),
      });
    }

    const actor = request[REQUEST_USER_KEY];

    const org = await this.orgs.updateStatus(
      orgId.data,
      parsed.data,
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
