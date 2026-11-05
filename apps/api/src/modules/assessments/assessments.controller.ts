import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Put,
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
    const raw = (body && typeof body === 'object') ? { ...(body as Record<string, any>) } : {};

    // Normalize briefOverrides if client sent candidateInstructions or deliverables at root
    if (!raw.briefOverrides && (raw.candidateInstructions || raw.deliverables)) {
      raw.briefOverrides = {
        instructions: raw.candidateInstructions,
        deliverables: raw.deliverables,
      };
    }

    // Normalize templateVersionId if not a valid UUID (allow backend repo to resolve by templateId)
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (raw.templateVersionId && !UUID_REGEX.test(raw.templateVersionId)) {
      delete raw.templateVersionId;
    }

    // Clean empty window strings in timing config to avoid z.datetime() parse failures
    if (raw.timing && typeof raw.timing === 'object') {
      const timing = { ...raw.timing };
      if (!timing.windowStartUtc) delete timing.windowStartUtc;
      if (!timing.windowEndUtc) delete timing.windowEndUtc;
      raw.timing = timing;
    }

    const parsed = CreateAssessmentDtoSchema.safeParse(raw);
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

  @Get(':id/rubric')
  async getRubric(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request[REQUEST_USER_KEY];
    return await this.assessmentsService.getRubric(id, actor);
  }

  @Put(':id/rubric')
  @HttpCode(200)
  async updateRubric(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request[REQUEST_USER_KEY];
    return await this.assessmentsService.updateRubric(id, body, actor);
  }
}
