import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import {
  AssignTemplateDtoSchema,
  BulkAssignTemplateDtoSchema,
  CloneTemplateDtoSchema,
  CreateTemplateDtoSchema,
  type AssignTemplateDto,
  type BulkAssignTemplateDto,
  type CloneTemplateDto,
  type CreateTemplateDto,
} from '@hs/contracts';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { problem } from '../../common/errors/app-http.exception.js';
import {
  REQUEST_USER_KEY,
  type AuthenticatedRequest,
} from '../../common/guards/session.guard.js';
import { flattenZodErrors } from '../../common/validation/zod-errors.js';
import { TemplatesService } from './templates.service.js';

@Controller('admin/templates')
@Roles('platform_admin')
export class AdminTemplatesController {
  constructor(
    @Inject(TemplatesService)
    private readonly templatesService: TemplatesService,
  ) {}

  @Get()
  async listAll(@Req() request: AuthenticatedRequest) {
    const actor = request[REQUEST_USER_KEY];
    return await this.templatesService.listAllForAdmin(actor);
  }

  @Post()
  @HttpCode(201)
  async createTemplate(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request[REQUEST_USER_KEY];
    const parsed = CreateTemplateDtoSchema.safeParse(body);
    if (!parsed.success) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Invalid template payload',
        code: 'VALIDATION_ERROR',
        errors: flattenZodErrors(parsed.error),
      });
    }

    return await this.templatesService.createTemplate(parsed.data, actor);
  }

  @Post(':id/assign')
  @HttpCode(200)
  async assignTemplate(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request[REQUEST_USER_KEY];
    const parsed = AssignTemplateDtoSchema.safeParse(body);
    if (!parsed.success) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Invalid assignment payload: orgId must be a valid UUID',
        code: 'VALIDATION_ERROR',
        errors: flattenZodErrors(parsed.error),
      });
    }

    return await this.templatesService.assignTemplate(id, parsed.data, actor);
  }

  @Post(':id/assign/bulk')
  @HttpCode(200)
  async bulkAssignTemplate(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request[REQUEST_USER_KEY];
    const parsed = BulkAssignTemplateDtoSchema.safeParse(body);
    if (!parsed.success) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Invalid bulk assignment payload: orgIds must be an array of valid UUIDs',
        code: 'VALIDATION_ERROR',
        errors: flattenZodErrors(parsed.error),
      });
    }

    return await this.templatesService.bulkAssignTemplate(id, parsed.data, actor);
  }

  @Delete(':id/assign/:orgId')
  @HttpCode(200)
  async revokeTemplateAssignment(
    @Param('id') id: string,
    @Param('orgId') orgId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request[REQUEST_USER_KEY];
    return await this.templatesService.revokeTemplate(id, orgId, actor);
  }

  @Post(':id/clone')
  @HttpCode(201)
  async cloneVersion(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request[REQUEST_USER_KEY];
    const parsed = CloneTemplateDtoSchema.safeParse(body || {});
    if (!parsed.success) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Invalid clone payload',
        code: 'VALIDATION_ERROR',
        errors: flattenZodErrors(parsed.error),
      });
    }

    return await this.templatesService.cloneVersion(id, parsed.data, actor);
  }

  @Post(':id/versions/:version/publish')
  @HttpCode(200)
  async publishVersion(
    @Param('id') id: string,
    @Param('version') version: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request[REQUEST_USER_KEY];
    return await this.templatesService.publishVersion(id, version, actor);
  }
}
