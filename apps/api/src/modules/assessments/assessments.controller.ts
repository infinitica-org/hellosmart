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
  CreateAssessmentDtoSchema,
  UpdateAssessmentBriefDtoSchema,
} from '@hs/contracts';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { problem } from '../../common/errors/app-http.exception.js';
import {
  REQUEST_USER_KEY,
  type AuthenticatedRequest,
} from '../../common/guards/session.guard.js';
import { flattenZodErrors } from '../../common/validation/zod-errors.js';
import { AssessmentsService } from './assessments.service.js';

@Controller('company/assessments')
@Roles('company_admin')
export class AssessmentsController {
  constructor(
    @Inject(AssessmentsService)
    private readonly assessmentsService: AssessmentsService,
  ) {}

  @Post()
  @HttpCode(201)
  async create(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request[REQUEST_USER_KEY];
    const parsed = CreateAssessmentDtoSchema.safeParse(body);
    if (!parsed.success) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Invalid assessment creation payload',
        code: 'VALIDATION_ERROR',
        errors: flattenZodErrors(parsed.error),
      });
    }
    return await this.assessmentsService.create(parsed.data, actor);
  }
  @Get()
  async list(@Req() request: AuthenticatedRequest) {
    const actor = request[REQUEST_USER_KEY];
    return await this.assessmentsService.list(actor);
  }

  @Get(':id')
  async getById(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request[REQUEST_USER_KEY];
    return await this.assessmentsService.getById(id, actor);
  }

  @Patch(':id/brief')
  @HttpCode(200)
  async updateBrief(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request[REQUEST_USER_KEY];
    const parsed = UpdateAssessmentBriefDtoSchema.safeParse(body);
    if (!parsed.success) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Invalid brief override payload',
        code: 'VALIDATION_ERROR',
        errors: flattenZodErrors(parsed.error),
      });
    }

    return await this.assessmentsService.updateBrief(id, parsed.data, actor);
  }
}
